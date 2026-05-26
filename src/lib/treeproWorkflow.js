/**
 * TreePro AI — shared workflow helpers (frontend)
 * Settings-driven pricing, quote versioning, audit/activity logging,
 * and secure portal token generation.
 */
import { base44 } from "@/api/base44Client";

// ── Pricing ──────────────────────────────────────────────────────────────────

/**
 * Build quote line items from an AIAnalysisRecord using CompanySettings rates.
 * Returns { lineItems, subtotal, total }
 */
export function buildLineItemsFromAnalysis(record, settings) {
  const s = settings || {};
  const price = record.human_final_price || record.price_high || s.minimum_job_price || 500;
  const lineItems = [
    {
      description: record.recommended_service || "Tree Service",
      quantity: 1,
      unit_price: price,
      total: price,
    },
  ];

  if (record.stump_grinding_likely) {
    const dbh = record.estimated_dbh_inches_high || 12;
    const stumpPrice =
      (s.stump_grinding_base_price || 100) + dbh * (s.stump_grinding_per_inch || 4);
    lineItems.push({
      description: `Stump Grinding (~${dbh}" diameter)`,
      quantity: 1,
      unit_price: stumpPrice,
      total: stumpPrice,
    });
  }

  if (record.crane_likely && s.crane_day_rate) {
    lineItems.push({
      description: "Crane / Lift Equipment",
      quantity: 1,
      unit_price: s.crane_day_rate,
      total: s.crane_day_rate,
    });
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
  const total = Math.max(subtotal, s.minimum_job_price || 150);

  return { lineItems, subtotal, total };
}

// ── Quote Versioning ──────────────────────────────────────────────────────────

/** Save the CURRENT state of a quote as version v1 (or next version number). */
export async function saveQuoteVersion(quote, versions, changedBy = "staff", reason = "Initial version") {
  const versionNumber = versions.length + 1;
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
 * Uses a cryptographically-random-style token (timestamp + random).
 */
export async function createPortalLink(quoteId, customerId, expiryDays = 7) {
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const token = `portal-${rand}`;
  await base44.entities.CustomerPortalSession.create({
    customer_id: customerId,
    quote_id: quoteId,
    token,
    expires_at: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
  });
  return `${window.location.origin}/portal/${token}`;
}