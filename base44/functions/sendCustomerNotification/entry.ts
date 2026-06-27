import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // ── Direct/test mode: explicit email fields ────────────────────────────
    if (body.to && body.subject && body.body) {
      const company = await loadCompany(base44);
      const result = await sendGmail(base44, {
        to: body.to,
        subject: body.subject,
        body: body.body,
        fromName: body.from_name || company.company_name || "Tree Service",
        fromEmail: body.from_email || company.email || "",
      });
      return Response.json({ success: true, ...result, to: body.to });
    }

    // ── Automation mode: entity event payload ──────────────────────────────
    const { event, data, changed_fields, payload_too_large } = body;
    if (!event) {
      return Response.json({ error: "No event payload or direct email fields provided" }, { status: 400 });
    }

    const entityName = event.entity_name;
    let record = data;
    if (payload_too_large || !record) {
      record = await base44.asServiceRole.entities[entityName].get(event.entity_id);
    }
    if (!record) {
      return Response.json({ skipped: true, reason: "record not found" });
    }

    // Only act on status changes
    if (changed_fields && !changed_fields.includes("status")) {
      return Response.json({ skipped: true, reason: "status not changed" });
    }

    // Job: only notify when marked complete
    if (entityName === "Job" && record.status !== "completed") {
      return Response.json({ skipped: true, reason: "job not completed" });
    }

    // Load company settings for branding
    const company = await loadCompany(base44);
    const companyName = company.company_name || "Tree Service";
    const companyPhone = company.phone || "";

    // Resolve recipient email + name
    let toEmail = record.customer_email;
    let customerName = record.customer_name;
    if (!toEmail && record.customer_id) {
      try {
        const cust = await base44.asServiceRole.entities.Customer.get(record.customer_id);
        if (cust) {
          toEmail = cust.email;
          customerName = customerName || `${cust.first_name} ${cust.last_name}`.trim();
        }
      } catch (_) { /* proceed without customer link */ }
    }
    if (!toEmail) {
      return Response.json({ skipped: true, reason: "no customer email on file" });
    }

    const { subject, textBody } = composeContent(entityName, record, customerName, companyName, companyPhone);

    const result = await sendGmail(base44, {
      to: toEmail,
      subject,
      body: textBody,
      fromName: companyName,
      fromEmail: company.email || "",
    });

    // Log activity for the sent notification
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        related_type: entityName,
        related_id: record.id || event.entity_id,
        actor: "system",
        action: `Customer email sent: ${subject}`,
        notes: `To: ${toEmail}`,
      });
    } catch (_) { /* non-blocking */ }

    return Response.json({ success: true, ...result, to: toEmail, subject });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function loadCompany(base44) {
  try {
    const arr = await base44.asServiceRole.entities.CompanySettings.list();
    return arr[0] || {};
  } catch (_) {
    return {};
  }
}

async function sendGmail(base44, { to, subject, body, fromName, fromEmail }) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

  // Build a minimal RFC 2822 message (ASCII English content).
  const fromHeader = fromEmail ? `"${fromName}" <${fromEmail}>` : fromName;
  const headers = [
    fromHeader ? `From: ${fromHeader}` : null,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
  ].filter(Boolean).join("\r\n");

  const raw = headers + body;
  const encoded = base64UrlEncode(raw);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail send failed (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return { messageId: data.id };
}

function base64UrlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function composeContent(entityName, record, customerName, companyName, companyPhone) {
  const phoneLine = companyPhone ? `\n\nQuestions? Call us at ${companyPhone}.` : "";
  const name = customerName || "there";

  if (entityName === "Quote") {
    const statusMessages = {
      sent: "Your quote has been sent. Please review it at your earliest convenience.",
      viewed: "We see you've reviewed your quote. Let us know if you have any questions.",
      approved: "Thank you for approving your quote! We'll be in touch shortly to schedule your service.",
      rejected: "We've noted your decision. If you change your mind, we're here to help.",
      needs_review: "We've received your change request and will send you an updated quote soon.",
      converted_to_job: "Great news — your quote has been converted to a scheduled job! We'll reach out with scheduling details.",
      invoiced: "An invoice has been generated for your service.",
      paid: "Thank you — your invoice has been paid in full.",
      expired: "Your quote has expired. Contact us if you'd like a refreshed estimate.",
      draft: "Your quote is being prepared.",
    };
    const statusLabel = (record.status || "").replace(/_/g, " ");
    const detail = statusMessages[record.status] || `Your quote status is now: ${statusLabel}.`;
    const subject = `Update on your quote from ${companyName} — ${statusLabel}`;
    const body = `Hi ${name},\n\n${detail}\n\nQuote #: ${record.quote_number || (record.id || "").slice(0, 8)}${phoneLine}\n\nThank you,\n${companyName}`;
    return { subject, textBody: body };
  }

  if (entityName === "Job") {
    const subject = `Your tree service job is complete — ${companyName}`;
    const service = record.description || record.scope_of_work || "Tree service";
    const dateLine = record.completion_date ? `\nCompletion date: ${record.completion_date}` : "";
    const body = `Hi ${name},\n\nWe're pleased to let you know that your job has been marked complete.\n\nService: ${service}${dateLine}${phoneLine}\n\nThank you for choosing ${companyName}.\n\n${companyName}`;
    return { subject, textBody: body };
  }

  return {
    subject: `Update from ${companyName}`,
    textBody: `Hi ${name},\n\nThere's an update to your service.${phoneLine}\n\n${companyName}`,
  };
}