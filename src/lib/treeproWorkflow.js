/**
 * TreePro AI — shared workflow helpers (frontend)
 * Settings-driven pricing, quote versioning, audit/activity logging,
 * and secure portal token generation.
 */
import { base44 } from "@/api/base44Client";

// ── Pricing Engine ─────────────────────────────────────────────────────────────

/**
 * Full pricing engine — builds line items from an AIAnalysisRecord + CompanySettings.
 * Returns { lineItems, subtotal, total, priceLow, priceHigh }
 */
export function buildLineItemsFromAnalysis(record, settings) {
  const s = settings || {};
  const stumpBase = s.stump_grinding_base_price || 100;
  const stumpPerInch = s.stump_grinding_per_inch || 4;
  const craneRate = s.crane_day_rate || 1500;
  const dumpBase = s.dump_fee_base || 75;
  const disposalPerYard = s.disposal_fee_per_cubic_yard || 25;
  const minPrice = s.minimum_job_price || 150;
  const crewRate = s.crew_hourly_rate || 65;
  const emergencyPct = (s.emergency_markup_percent || 40) / 100;
  const riskPct = (s.risk_markup_percent || 20) / 100;
  const profitPct = (s.profit_margin_percent || 35) / 100;

  // Use human override price if set, else use AI price_high
  const basePrice = record.human_final_price || record.price_high || null;

  // Estimate crew hours based on tree size
  const heightMid = ((record.estimated_height_ft_low || 0) + (record.estimated_height_ft_high || 30)) / 2;
  let baseHours = heightMid < 25 ? 2 : heightMid < 50 ? 4 : heightMid < 75 ? 8 : 14;

  // Apply risk markup
  const risk = record.risk_level || 'low';
  if (risk === 'moderate') baseHours *= (1 + riskPct * 0.5);
  else if (risk === 'high') baseHours *= (1 + riskPct);
  else if (risk === 'extreme') baseHours *= (1 + riskPct * 1.5);

  // Emergency markup
  const urgency = record.urgency_level || 'normal';
  if (urgency === 'emergency') baseHours *= (1 + emergencyPct);

  // Calculate labor with profit margin
  const laborCost = baseHours * crewRate;
  const calculatedPrice = Math.round(Math.max(laborCost / (1 - profitPct), minPrice) / 5) * 5;
  const mainPrice = basePrice || calculatedPrice;

  const lineItems = [
    {
      description: record.recommended_service || "Tree Service",
      quantity: 1,
      unit_price: mainPrice,
      total: mainPrice,
    },
  ];

  if (record.stump_grinding_likely) {
    const dbh = record.estimated_dbh_inches_high || 12;
    const stumpPrice = Math.round(stumpBase + dbh * stumpPerInch);
    lineItems.push({
      description: `Stump Grinding (~${dbh}" diameter)`,
      quantity: 1,
      unit_price: stumpPrice,
      total: stumpPrice,
    });
  }

  if (record.crane_likely && craneRate) {
    lineItems.push({
      description: "Crane / Lift Equipment",
      quantity: 1,
      unit_price: craneRate,
      total: craneRate,
    });
  }

  // Debris disposal estimate
  const debrisYards = heightMid < 25 ? 2 : heightMid < 50 ? 4 : heightMid < 75 ? 7 : 12;
  if (record.recommended_service?.toLowerCase().includes('remov') || debrisYards >= 4) {
    const debrisCost = Math.round(dumpBase + debrisYards * disposalPerYard);
    lineItems.push({
      description: "Debris Removal & Site Cleanup",
      quantity: 1,
      unit_price: debrisCost,
      total: debrisCost,
    });
  }

  // Travel fee
  if (s.travel_fee_base > 0) {
    lineItems.push({
      description: "Travel & Mobilization",
      quantity: 1,
      unit_price: s.travel_fee_base,
      total: s.travel_fee_base,
    });
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
  const total = Math.max(subtotal, minPrice);
  const priceLow = record.price_low || Math.round(total * 0.85);
  const priceHigh = record.price_high || total;

  return { lineItems, subtotal, total, priceLow, priceHigh };
}

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