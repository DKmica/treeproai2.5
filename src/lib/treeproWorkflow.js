/**
 * TreePro AI — shared workflow helpers (frontend)
 * Settings-driven pricing, quote versioning, audit/activity logging,
 * and secure portal token generation.
 *
 * NOTE: For pricing calculations, prefer importing from @/lib/pricingEngine.
 * This file re-exports buildLineItemsFromAnalysis for backwards compatibility.
 */
import { base44 } from "@/api/base44Client";
export { buildLineItemsFromAnalysis, calculateScenarioPricing, calculateComplexity, calculateQuoteTotals, determinePriority } from "@/lib/pricingEngine";

// ── Quote Versioning ──────────────────────────────────────────────────────────

/** Save the CURRENT state of a quote as version v1 (or next version number). */
export async function saveQuoteVersion(quote, versions, changedBy = "staff", reason = "Initial version") {
  const versionNumber = (versions?.length || 0) + 1;
  return base44.entities.QuoteVersion.create({
    quote_id: quote.id,
    version_number: versionNumber,
    line_items: quote.line_items || [],
    subtotal: quote.subtotal || 0,
    discount_amount: quote.discount_amount || 0,
    tax_amount: quote.tax_amount || 0,
    total: quote.total_amount || 0,
    changed_by: changedBy,
    change_reason: reason,
    status_at_save: quote.status,
  });
}

// ── Activity / Audit Logging ─────────────────────────────────────────────────

/** Log a user-facing activity entry (visible in Recent Activity feed). */
export async function logActivity({ relatedType, relatedId, actor = "staff", action, notes = "" }) {
  return base44.entities.ActivityLog.create({
    related_type: relatedType,
    related_id: relatedId,
    actor,
    action,
    notes,
  });
}

/** Log a detailed audit trail entry. */
export async function logAudit({ actorId = "", actorName = "staff", action, entityType, entityId, oldValue, newValue, notes = "" }) {
  return base44.entities.AuditLog.create({
    actor_id: actorId,
    actor_name: actorName,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: oldValue || {},
    new_value: newValue || {},
    notes,
  });
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function createNotification({ type = "general", title, message, relatedType, relatedId }) {
  return base44.entities.Notification.create({
    type,
    title,
    message,
    related_type: relatedType || "",
    related_id: relatedId || "",
    read: false,
  });
}

// ── Quote → Job Auto-Conversion ───────────────────────────────────────────────

/**
 * Creates a Job from an approved Quote and links them bidirectionally.
 * Marks the quote as converted_to_job and stores job_id on the quote.
 * Returns the created Job record.
 */
export async function convertQuoteToJob(quote, customer = null, actor = "staff") {
  const riskLevel = quote.risk_level;
  let priority = "normal";
  if (riskLevel === "extreme") priority = "emergency";
  else if (riskLevel === "high" || quote.crane_required) priority = "high";

  const address = quote.customer_address || customer?.address || "";

  const job = await base44.entities.Job.create({
    customer_id: quote.customer_id,
    customer_name: quote.customer_name,
    customer_phone: quote.customer_phone || customer?.phone || "",
    customer_email: quote.customer_email || customer?.email || "",
    customer_address: address,
    address,
    quote_id: quote.id,
    ai_analysis_id: quote.ai_analysis_id || "",
    status: "unscheduled",
    priority,
    description: quote.scope_of_work || quote.notes || "From approved quote",
    scope_of_work: quote.scope_of_work || "",
    total_cost: quote.total_amount || 0,
    line_items: quote.line_items || [],
    risk_level: riskLevel || undefined,
    access_notes: quote.access_notes || "",
    crane_required: quote.crane_required || false,
    estimated_duration_hours: quote.estimated_duration_hours || 4,
    required_crew_size: quote.required_crew_size || 2,
    notes: `Auto-created from approved quote #${quote.quote_number || quote.id.slice(0, 8)}`,
  });

  // Link quote → job bidirectionally
  await base44.entities.Quote.update(quote.id, {
    status: "converted_to_job",
    job_id: job.id,
  });

  // Mark associated lead as "won" with the final job value
  if (quote.lead_id) {
    await base44.entities.Lead.update(quote.lead_id, {
      status: "won",
      estimated_value: quote.total_amount || 0,
      converted_customer_id: quote.customer_id || "",
    }).catch(() => {});
  }

  await logActivity({ relatedType: "Job", relatedId: job.id, actor, action: `Job auto-created from approved quote #${quote.quote_number || quote.id.slice(0, 8)}`, notes: quote.customer_name });
  await logAudit({ actorName: actor, action: "quote_converted_to_job", entityType: "Job", entityId: job.id, newValue: { quote_id: quote.id, customer: quote.customer_name, total: quote.total_amount } });
  await createNotification({ type: "job_assigned", title: `New job created: ${quote.customer_name}`, message: `Quote #${quote.quote_number || quote.id.slice(0, 8)} approved — job is ready to schedule.`, relatedType: "Job", relatedId: job.id });

  return job;
}

// ── Portal Token Generation ───────────────────────────────────────────────────

/**
 * Create a secure customer portal session and return the full link.
 * Uses crypto random bytes for unpredictable tokens.
 */
export async function createPortalLink(quoteId, customerId, expiryDays = 7) {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const token = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  await base44.entities.CustomerPortalSession.create({
    customer_id: customerId,
    quote_id: quoteId,
    token,
    expires_at: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
  });
  return `${window.location.origin}/portal/${token}`;
}