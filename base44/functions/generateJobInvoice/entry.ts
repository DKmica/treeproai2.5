import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.2.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Resolve job from automation payload or direct call
    let jobId = body.job_id;
    let job = null;
    if (body.event && body.event.entity_name === "Job") {
      jobId = body.event.entity_id;
      job = body.data;
      if (body.payload_too_large || !job) {
        job = await base44.asServiceRole.entities.Job.get(jobId);
      }
    } else if (jobId) {
      job = await base44.asServiceRole.entities.Job.get(jobId);
    }

    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    // Guard: only act on completed jobs
    if (job.status !== "completed") {
      return Response.json({ skipped: true, reason: `job status is '${job.status}', not 'completed'` });
    }

    // Guard: don't double-invoice
    if (job.invoice_id) {
      return Response.json({ skipped: true, reason: "job already has an invoice", invoice_id: job.invoice_id });
    }

    if (!job.customer_id && !job.customer_name) {
      return Response.json({ skipped: true, reason: "job has no customer attached" });
    }

    // Load linked quote
    let quote = null;
    if (job.quote_id) {
      try {
        const qArr = await base44.asServiceRole.entities.Quote.filter({ id: job.quote_id });
        quote = qArr[0] || null;
      } catch (_) { /* proceed without quote */ }
    }

    // Load customer
    let customer = null;
    if (job.customer_id) {
      try {
        customer = await base44.asServiceRole.entities.Customer.get(job.customer_id);
      } catch (_) { /* proceed without customer */ }
    }

    // Load time entries (labor)
    let timeEntries = [];
    try {
      timeEntries = await base44.asServiceRole.entities.TimeEntry.filter({ job_id: job.id });
    } catch (_) { /* proceed without time entries */ }

    // Load company settings
    let company = {};
    try {
      const cArr = await base44.asServiceRole.entities.CompanySettings.list();
      company = cArr[0] || {};
    } catch (_) { /* proceed without company settings */ }

    // ── Build line items ────────────────────────────────────────────────
    let lineItems;
    let source;
    if (quote && quote.line_items && quote.line_items.length) {
      lineItems = quote.line_items.map(i => ({
        description: i.description || "",
        quantity: parseFloat(i.quantity) || 1,
        unit_price: parseFloat(i.unit_price) || 0,
        total: parseFloat(i.total) || 0,
      }));
      source = "quote";
    } else if (job.line_items && job.line_items.length) {
      lineItems = job.line_items.map(i => ({
        description: i.description || "",
        quantity: parseFloat(i.quantity) || 1,
        unit_price: parseFloat(i.unit_price) || 0,
        total: parseFloat(i.total) || 0,
      }));
      source = "job";
    } else {
      const fallbackTotal = parseFloat(job.total_cost) || 0;
      lineItems = [{
        description: job.description || job.scope_of_work || "Tree Service",
        quantity: 1,
        unit_price: fallbackTotal,
        total: fallbackTotal,
      }];
      source = "estimated";
    }

    const subtotal = lineItems.reduce((s, i) => s + (i.total || 0), 0);
    const taxRate = quote ? (parseFloat(quote.tax_rate) || 0) : 0;
    const taxAmount = Math.round(subtotal * taxRate / 100 * 100) / 100;
    const discount = quote ? (parseFloat(quote.discount_amount) || 0) : 0;
    const total = Math.round((subtotal + taxAmount - discount) * 100) / 100;

    // ── Labor summary ───────────────────────────────────────────────────
    let laborHours = 0;
    for (const te of timeEntries) {
      if (te.clock_in && te.clock_out) {
        const ms = new Date(te.clock_out).getTime() - new Date(te.clock_in).getTime();
        const hrs = ms / 3600000 - (parseFloat(te.break_minutes) || 0) / 60;
        laborHours += Math.max(hrs, 0);
      }
    }
    if (!laborHours) {
      laborHours = parseFloat(job.actual_duration_hours) || parseFloat(job.estimated_duration_hours) || 0;
    }
    const crewRate = parseFloat(company.crew_hourly_rate) || 65;

    // ── Due date ─────────────────────────────────────────────────────────
    const expDays = parseInt(company.quote_expiration_days, 10) || 30;
    const dueDate = new Date(Date.now() + expDays * 86400000).toISOString().split("T")[0];

    // ── Create invoice record ───────────────────────────────────────────
    const invNum = `INV-${Date.now().toString().slice(-6)}`;
    const customerName = job.customer_name || (customer ? `${customer.first_name} ${customer.last_name}`.trim() : "Customer");

    const inv = await base44.asServiceRole.entities.Invoice.create({
      customer_id: job.customer_id || "",
      customer_name: customerName,
      job_id: job.id,
      quote_id: job.quote_id || "",
      invoice_number: invNum,
      line_items: lineItems,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      discount_amount: discount,
      total,
      amount_paid: 0,
      balance_due: total,
      status: "draft",
      due_date: dueDate,
      notes: company.terms_and_conditions || "",
    });

    // ── Generate PDF ────────────────────────────────────────────────────
    let pdfUrl = "";
    let pdfBuilt = false;
    try {
      const pdfBytes = buildInvoicePDF({
        company, invoiceNumber: invNum, dueDate, customerName, customer, job,
        lineItems, subtotal, taxAmount, discount, total, laborHours, crewRate,
        terms: company.terms_and_conditions || "",
      });
      pdfBuilt = true;

      // Upload PDF to file storage
      try {
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const up = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
        pdfUrl = (up && up.file_url) || "";
        if (pdfUrl) {
          await base44.asServiceRole.entities.Invoice.update(inv.id, { pdf_url: pdfUrl });
        }
      } catch (uploadErr) {
        console.error("PDF upload failed:", uploadErr.message);
      }
    } catch (pdfErr) {
      console.error("PDF generation failed:", pdfErr.message);
    }

    // ── Update job to invoiced ──────────────────────────────────────────
    await base44.asServiceRole.entities.Job.update(job.id, { status: "invoiced", invoice_id: inv.id });

    // ── Sync linked quote ───────────────────────────────────────────────
    if (job.quote_id) {
      try {
        await base44.asServiceRole.entities.Quote.update(job.quote_id, { status: "invoiced" });
      } catch (_) { /* non-blocking */ }
    }

    // ── Activity / Audit / Notification ─────────────────────────────────
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        related_type: "Invoice", related_id: inv.id, actor: "system",
        action: `Invoice ${invNum} auto-generated from completed job`,
        notes: `${customerName} — $${total.toFixed(2)} (source: ${source}, labor: ${laborHours.toFixed(1)}h, pdf: ${pdfUrl ? "yes" : "no"})`,
      });
    } catch (_) { /* non-blocking */ }
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_name: "system", action: "invoice_auto_generated_from_job",
        entity_type: "Invoice", entity_id: inv.id,
        new_value: { job_id: job.id, customer: customerName, total, source, labor_hours: laborHours, pdf_url: pdfUrl, pdf_built: pdfBuilt },
      });
    } catch (_) { /* non-blocking */ }
    try {
      await base44.asServiceRole.entities.Notification.create({
        type: "general",
        title: `Invoice ${invNum} auto-generated`,
        message: `${customerName} — $${total.toFixed(2)}. ${pdfUrl ? "PDF ready to send." : "Review in Invoices."}`,
        related_type: "Invoice", related_id: inv.id, read: false,
      });
    } catch (_) { /* non-blocking */ }

    return Response.json({
      success: true,
      invoice_id: inv.id,
      invoice_number: invNum,
      total,
      source,
      labor_hours: laborHours,
      pdf_built: pdfBuilt,
      pdf_url: pdfUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ── Professional PDF builder ─────────────────────────────────────────────
function buildInvoicePDF({ company, invoiceNumber, dueDate, customerName, customer, job, lineItems, subtotal, taxAmount, discount, total, laborHours, crewRate, terms }) {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const M = 50;
  let y = 40;

  // Company header (left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(22, 163, 74);
  doc.text(company.company_name || "Tree Service", M, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  const contactLines = [
    company.address ? `${company.address}${company.city || company.state || company.zip ? ", " + [company.city, company.state, company.zip].filter(Boolean).join(" ") : ""}` : "",
    company.phone ? `Phone: ${company.phone}` : "",
    company.email ? `Email: ${company.email}` : "",
    company.website ? `Web: ${company.website}` : "",
  ].filter(Boolean);
  contactLines.forEach(l => { y += 5; doc.text(l, M, y); });

  // Invoice title (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(20);
  doc.text("INVOICE", W - M, 40, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Invoice #: ${invoiceNumber}`, W - M, 48, { align: "right" });
  doc.text(`Date: ${new Date().toLocaleDateString()}`, W - M, 54, { align: "right" });
  doc.text(`Due: ${dueDate || ""}`, W - M, 60, { align: "right" });

  // Bill To
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("BILL TO", M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(customerName || "", M, y);
  const billLines = [
    customer && customer.address ? customer.address : "",
    job && job.customer_address ? job.customer_address : "",
    job && job.customer_phone ? job.customer_phone : "",
    job && job.customer_email ? job.customer_email : "",
  ].filter(Boolean);
  billLines.forEach(l => { y += 5; doc.text(l, M, y); });

  // Job info
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20);
  const jobDesc = (job && (job.description || job.scope_of_work)) ? (job.description || job.scope_of_work) : "Tree Service";
  doc.text(`Job: ${String(jobDesc).slice(0, 70)}`, M, y);
  if (job && job.completion_date) {
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90);
    doc.text(`Completed: ${job.completion_date}`, M, y);
  }

  // Line items table
  y += 12;
  const tableX = M;
  const tableW = W - 2 * M;
  const descW = tableW * 0.5;
  const qtyX = tableX + descW;
  const qtyW = tableW * 0.15;
  const priceX = qtyX + qtyW;
  const priceW = tableW * 0.2;

  // Header row
  doc.setFillColor(238, 244, 240);
  doc.rect(tableX, y - 5, tableW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40);
  doc.text("DESCRIPTION", tableX + 2, y);
  doc.text("QTY", qtyX + 2, y);
  doc.text("UNIT PRICE", priceX + 2, y);
  doc.text("TOTAL", W - M - 2, y, { align: "right" });
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);
  (lineItems || []).forEach((item) => {
    if (y > 250) { doc.addPage(); y = 40; }
    const desc = String(item.description || "").slice(0, 55);
    const descLines = doc.splitTextToSize(desc, descW - 4);
    doc.text(descLines, tableX + 2, y);
    doc.text(String(item.quantity || 1), qtyX + 2, y);
    doc.text(`$${(item.unit_price || 0).toFixed(2)}`, priceX + 2, y);
    doc.text(`$${(item.total || 0).toFixed(2)}`, W - M - 2, y, { align: "right" });
    y += 6 + Math.max(0, descLines.length - 1) * 5;
  });

  // Totals
  y += 4;
  const labelX = W - M - 80;
  const valueX = W - M - 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text("Subtotal", labelX, y); doc.text(`$${(subtotal || 0).toFixed(2)}`, valueX, y, { align: "right" }); y += 6;
  if (taxAmount) { doc.text("Tax", labelX, y); doc.text(`$${taxAmount.toFixed(2)}`, valueX, y, { align: "right" }); y += 6; }
  if (discount) { doc.text("Discount", labelX, y); doc.text(`-$${discount.toFixed(2)}`, valueX, y, { align: "right" }); y += 6; }
  doc.setLineWidth(0.5);
  doc.line(labelX, y - 2, valueX, y - 2);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text("TOTAL DUE", labelX, y);
  doc.text(`$${(total || 0).toFixed(2)}`, valueX, y, { align: "right" });

  // Labor summary
  if (laborHours > 0) {
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(20);
    doc.text("LABOR SUMMARY", M, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Total labor hours: ${laborHours.toFixed(1)} hrs`, M, y);
    y += 5;
    doc.text(`Crew rate: $${crewRate.toFixed(2)}/hr (reference only)`, M, y);
  }

  // Terms & notes
  if (terms) {
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text("TERMS & NOTES", M, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90);
    const splitNotes = doc.splitTextToSize(terms, W - 2 * M);
    doc.text(splitNotes, M, y);
  }

  // Footer
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text(`Thank you for your business — ${company.company_name || "Tree Service"}`, W / 2, 285, { align: "center" });

  return doc.output("arraybuffer");
}