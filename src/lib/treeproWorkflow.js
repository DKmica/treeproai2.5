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

// Legacy body removed — use @/lib/pricingEngine directly for new code.

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

// ── Portal Token Generation ───────────────────────────────────────────────────

/**
 * Create a secure customer portal session and return the full link.
 * Uses crypto random bytes for unpredictable tokens.
 */
export async function createPortalLink(quoteId, customerId, expiryDays = 7) {
  // Use crypto.getRandomValues for better entropy
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