/**
 * TreePro AI — Shared Pricing Engine (frontend)
 * Single source of truth for ALL pricing calculations.
 *
 * PRODUCTION FORMULA (corrected):
 *   productionLaborCost = totalProductionHours × crewProductionRate ($500/hr default)
 *   chipDumpFees = min(chipLoads, 2) × chipDumpRate ($120/load)
 *   woodDumpFees = standardWoodLoads × $220 + oversizedWoodLoads × $440
 *   jobSubtotal = productionLaborCost + chipDumpFees + woodDumpFees + equipmentCharges + riskCharges
 *   finalPrice = jobSubtotal × overheadProfitMultiplier
 *
 * "totalProductionHours" is the FULL job production time:
 *   removal/cutting + rigging + ground work + chipping + log handling + cleanup
 *   It is NOT just cleanup time.
 *
 * TRAINING EXAMPLE — Large mature oak, full removal, full cleanup & haul-away:
 *   totalProductionHours = 16
 *   chipLoads = 2, oversizedLogLoads = 2
 *   productionLaborCost = 16 × $500 = $8,000
 *   chipDumpFees = 2 × $120 = $240
 *   oversizedWoodDumpFees = 2 × $440 = $880
 *   jobSubtotal = $9,120
 *   × 1.20 overhead/profit = $10,944 → quote ~$10,900–$11,500
 */

// ── Default Rate Constants ────────────────────────────────────────────────────

export const PRICING_DEFAULTS = {
  crewProductionRate: 500,   // $/hr — total production crew rate (all tasks combined)
  chipDumpRate: 120,          // $/load, max 2 loads
  standardWoodDumpRate: 220,  // $/load standard logs
  oversizedWoodDumpRate: 440, // $/load for logs over 40" diameter
  maxChipLoads: 2,
  overheadProfitMultiplier: 1.20, // 20% overhead + profit buffer
};

// ── Production Hours Estimator ─────────────────────────────────────────────────

/**
 * Estimate total production hours broken down by task phase.
 * Returns { removalHours, groundChippingHours, logHandlingHours, finalCleanupHours, totalHours }
 *
 * These phases together constitute ALL labor — not just cleanup.
 */
export function estimateProductionHours(analysis) {
  const heightMid = ((analysis.estimated_height_ft_low || 0) + (analysis.estimated_height_ft_high || 30)) / 2;
  const dbhMid = ((analysis.estimated_dbh_inches_low || 0) + (analysis.estimated_dbh_inches_high || 12)) / 2;
  const riskLevel = analysis.risk_level || "low";
  const hasStructure = analysis.canopy_over_structure || analysis.structures_nearby;
  const limitedDrop = analysis.limited_drop_zone;
  const craneRequired = analysis.crane_required;
  const isDenseWood = /oak|hickory|sycamore|elm|ash/.test((analysis.detected_species || "").toLowerCase());

  // Base removal/cutting hours by height band
  let removalHours;
  if (heightMid < 25) removalHours = 0.5;
  else if (heightMid < 40) removalHours = 1.5;
  else if (heightMid < 55) removalHours = 3;
  else if (heightMid < 70) removalHours = 5;
  else if (heightMid < 85) removalHours = 7;
  else removalHours = 10;

  // Risk and access adjustments to removal/rigging time
  if (riskLevel === "moderate") removalHours *= 1.15;
  else if (riskLevel === "high") removalHours *= 1.3;
  else if (riskLevel === "extreme") removalHours *= 1.5;

  if (hasStructure) removalHours *= 1.2;
  if (limitedDrop) removalHours *= 1.15;
  if (craneRequired) removalHours *= 0.7; // crane reduces climbing/rigging time

  // Ground crew + chipping hours (scales with canopy/volume)
  let groundChippingHours;
  if (heightMid < 25) groundChippingHours = 0.5;
  else if (heightMid < 50) groundChippingHours = 1.5;
  else if (heightMid < 70) groundChippingHours = 2.5;
  else groundChippingHours = 4;

  // Log handling/loading hours (dense hardwood takes longer)
  let logHandlingHours;
  if (dbhMid < 12) logHandlingHours = 0.5;
  else if (dbhMid < 24) logHandlingHours = 1;
  else if (dbhMid < 36) logHandlingHours = 1.5;
  else logHandlingHours = 2.5;

  if (isDenseWood) logHandlingHours *= 1.25;

  // Final site cleanup hours
  let finalCleanupHours;
  if (heightMid < 25) finalCleanupHours = 0.5;
  else if (heightMid < 50) finalCleanupHours = 1;
  else if (heightMid < 70) finalCleanupHours = 1.5;
  else finalCleanupHours = 2;

  const totalHours = removalHours + groundChippingHours + logHandlingHours + finalCleanupHours;

  return {
    removalHours: Math.round(removalHours * 10) / 10,
    groundChippingHours: Math.round(groundChippingHours * 10) / 10,
    logHandlingHours: Math.round(logHandlingHours * 10) / 10,
    finalCleanupHours: Math.round(finalCleanupHours * 10) / 10,
    totalHours: Math.round(totalHours * 10) / 10,
  };
}

/**
 * Estimate chip and wood dump loads from analysis.
 * Returns { chipLoads, standardWoodLoads, oversizedWoodLoads }
 */
export function estimateDumpLoads(analysis) {
  const heightMid = ((analysis.estimated_height_ft_low || 0) + (analysis.estimated_height_ft_high || 30)) / 2;
  const dbhMid = ((analysis.estimated_dbh_inches_low || 0) + (analysis.estimated_dbh_inches_high || 12)) / 2;

  // Chip loads (max 2 per PRICING_DEFAULTS.maxChipLoads)
  let rawChipLoads = heightMid < 30 ? 0.5 : heightMid < 50 ? 1 : 2;
  const chipLoads = Math.min(Math.round(rawChipLoads), PRICING_DEFAULTS.maxChipLoads);

  // Wood loads — oversized when DBH > 40"
  const oversizedWoodLoads = dbhMid >= 40 ? Math.ceil(dbhMid / 40) : 0;
  const standardWoodLoads = dbhMid >= 20 && oversizedWoodLoads === 0 ? 1 : 0;

  return { chipLoads, standardWoodLoads, oversizedWoodLoads };
}

// ── Core Production-Based Pricer ─────────────────────────────────────────────

/**
 * Calculate final price from production hours + dump loads + equipment.
 * Uses the corrected formula: productionLabor + dumpFees + equipment × overhead multiplier.
 */
export function calculateProductionPrice(params, settings = {}) {
  const {
    totalProductionHours,
    chipLoads = 0,
    standardWoodLoads = 0,
    oversizedWoodLoads = 0,
    craneRequired = false,
    urgency = "normal",
    includeStump = false,
    dbhMid = 12,
  } = params;

  const s = settings;
  const crewRate = s.crew_production_rate || PRICING_DEFAULTS.crewProductionRate;
  const chipRate = PRICING_DEFAULTS.chipDumpRate;
  const standardWoodRate = PRICING_DEFAULTS.standardWoodDumpRate;
  const oversizedWoodRate = PRICING_DEFAULTS.oversizedWoodDumpRate;
  const maxChip = PRICING_DEFAULTS.maxChipLoads;
  const craneDay = s.crane_day_rate || 1500;
  const stumpBase = s.stump_grinding_base_price || 100;
  const stumpPerInch = s.stump_grinding_per_inch || 4;

  // Production labor cost
  const productionLaborCost = totalProductionHours * crewRate;

  // Dump fees
  const actualChipLoads = Math.min(chipLoads, maxChip);
  const chipDumpFees = actualChipLoads * chipRate;
  const woodDumpFees = standardWoodLoads * standardWoodRate + oversizedWoodLoads * oversizedWoodRate;

  // Equipment
  const equipmentCharges = craneRequired ? craneDay : 0;

  // Emergency surcharge (on top, before multiplier)
  const emergencyAdd = urgency === "emergency" ? productionLaborCost * 0.40 : 0;

  const jobSubtotal = productionLaborCost + chipDumpFees + woodDumpFees + equipmentCharges + emergencyAdd;

  // Overhead + profit multiplier (default 1.20)
  const multiplier = s.overhead_profit_multiplier || PRICING_DEFAULTS.overheadProfitMultiplier;
  const finalPrice = jobSubtotal * multiplier;

  // Stump (add-on, not multiplied by overhead since it's separately priced)
  const stumpPrice = includeStump ? Math.round(stumpBase + dbhMid * stumpPerInch) : 0;

  return {
    productionLaborCost: Math.round(productionLaborCost),
    chipDumpFees: Math.round(chipDumpFees),
    woodDumpFees: Math.round(woodDumpFees),
    equipmentCharges: Math.round(equipmentCharges),
    emergencyAdd: Math.round(emergencyAdd),
    jobSubtotal: Math.round(jobSubtotal),
    finalPrice: Math.round(finalPrice / 5) * 5,
    stumpPrice,
    breakdown: {
      actualChipLoads,
      standardWoodLoads,
      oversizedWoodLoads,
      crewRate,
      multiplier,
    },
  };
}

// ── Complexity Scoring ────────────────────────────────────────────────────────

export function calculateComplexity(analysis, settings = {}) {
  const s = settings;
  let score = 0;

  const heightMid = ((analysis.estimated_height_ft_low || 0) + (analysis.estimated_height_ft_high || 0)) / 2 || (analysis.estimated_height_ft_high || 0);
  const dbhMid = ((analysis.estimated_dbh_inches_low || 0) + (analysis.estimated_dbh_inches_high || 0)) / 2 || (analysis.estimated_dbh_inches_high || 0);
  const isDenseWood = /oak|hickory|sycamore|elm|ash/.test((analysis.detected_species || "").toLowerCase());

  if (heightMid >= 90) score += 25;
  else if (heightMid >= 70) score += 20;
  else if (heightMid >= 50) score += 12;
  else if (heightMid >= 25) score += 5;

  if (dbhMid >= 48) score += 20;
  else if (dbhMid >= 36) score += 15;
  else if (dbhMid >= 24) score += 8;
  else if (dbhMid >= 12) score += 3;

  if (isDenseWood) score += 10;
  if (analysis.canopy_over_structure) score += 20;
  else if (analysis.structures_nearby) score += 10;
  if (analysis.limited_drop_zone) score += 15;
  if (analysis.crane_required) score += 15;
  else if (analysis.crane_likely) score += 10;
  if (analysis.risk_level === "extreme") score += 10;
  else if (analysis.risk_level === "high") score += 5;

  score = Math.min(100, score);

  const minJob = s.minimum_job_price || 150;
  const minLarge = s.minimum_large_removal_price || 4500;
  const minHighRisk = s.minimum_high_risk_removal_price || 6500;
  const minExtreme = s.minimum_extreme_removal_price || 8500;
  const minCrane = s.minimum_crane_removal_price || 10500;

  let tier, pricingFloor, rangeWidthPct;

  if (score >= 75) {
    tier = "extreme";
    pricingFloor = analysis.crane_required ? minCrane : minExtreme;
    rangeWidthPct = 20;
  } else if (score >= 50) {
    tier = "high";
    pricingFloor = analysis.crane_likely ? minCrane : minHighRisk;
    rangeWidthPct = 25;
  } else if (score >= 25) {
    tier = "moderate";
    pricingFloor = minLarge;
    rangeWidthPct = 30;
  } else {
    tier = "low";
    pricingFloor = minJob;
    rangeWidthPct = 35;
  }

  const confidence = analysis.confidence_score || 50;
  if (confidence >= 70) rangeWidthPct = Math.min(rangeWidthPct, s.max_high_confidence_range_percent || 25);
  else if (confidence < 50) rangeWidthPct = Math.max(rangeWidthPct, s.max_low_confidence_range_percent || 40);

  return { score, tier, pricingFloor, rangeWidthPct };
}

// ── Scenario Pricing ──────────────────────────────────────────────────────────

/**
 * Build scenario-based pricing from analysis + settings.
 * Uses the corrected production-labor formula.
 */
export function calculateScenarioPricing(analysis, settings = {}) {
  const s = settings;

  const { score, tier, pricingFloor, rangeWidthPct } = calculateComplexity(analysis, s);

  const heightMid = ((analysis.estimated_height_ft_low || 0) + (analysis.estimated_height_ft_high || 30)) / 2;
  const dbhMid = ((analysis.estimated_dbh_inches_low || 0) + (analysis.estimated_dbh_inches_high || 12)) / 2;

  // Estimate production hours
  const hours = estimateProductionHours(analysis);
  const loads = estimateDumpLoads(analysis);

  // No-crane scenario
  const noCraneCalc = calculateProductionPrice({
    totalProductionHours: hours.totalHours,
    chipLoads: loads.chipLoads,
    standardWoodLoads: loads.standardWoodLoads,
    oversizedWoodLoads: loads.oversizedWoodLoads,
    craneRequired: false,
    urgency: analysis.urgency_level || "normal",
    includeStump: false,
    dbhMid,
  }, s);

  const noCraneLow = Math.max(Math.round(noCraneCalc.finalPrice / 5) * 5, pricingFloor);
  const noCraneHigh = Math.round(noCraneLow * (1 + rangeWidthPct / 100) / 5) * 5;

  // Crane scenario
  const craneCalc = calculateProductionPrice({
    totalProductionHours: hours.totalHours,
    chipLoads: loads.chipLoads,
    standardWoodLoads: loads.standardWoodLoads,
    oversizedWoodLoads: loads.oversizedWoodLoads,
    craneRequired: true,
    urgency: analysis.urgency_level || "normal",
    includeStump: false,
    dbhMid,
  }, s);

  const craneMinFloor = s.minimum_crane_removal_price || 10500;
  const craneLow = Math.max(Math.round(craneCalc.finalPrice / 5) * 5, craneMinFloor);
  const craneHigh = Math.round(craneLow * (1 + rangeWidthPct / 100) / 5) * 5;

  // Stump
  const stumpBase = s.stump_grinding_base_price || 100;
  const stumpPerInch = s.stump_grinding_per_inch || 4;
  const stumpPrice = Math.round(stumpBase + dbhMid * stumpPerInch);
  const stumpLow = Math.max(Math.round(stumpPrice * 0.9 / 5) * 5, stumpBase);
  const stumpHigh = Math.round(stumpPrice * 1.1 / 5) * 5;

  const priceLow = analysis.crane_required ? craneLow : noCraneLow;
  const priceHigh = analysis.crane_required ? craneHigh : noCraneHigh;

  return {
    complexity_score: score,
    complexity_tier: tier,
    pricing_floor: pricingFloor,
    range_width_percent: rangeWidthPct,
    price_low: priceLow,
    price_high: priceHigh,
    no_crane_price_low: noCraneLow,
    no_crane_price_high: noCraneHigh,
    crane_required_price_low: craneLow,
    crane_required_price_high: craneHigh,
    stump_price_low: stumpLow,
    stump_price_high: stumpHigh,
    estimated_hours: hours,
    estimated_loads: loads,
    pricing_scenarios: {
      advanced_rigging: { label: "Advanced Rigging (No Crane)", low: noCraneLow, high: noCraneHigh, recommended: !analysis.crane_required },
      crane_assisted: { label: "Crane-Assisted Removal", low: craneLow, high: craneHigh, recommended: !!(analysis.crane_required || analysis.crane_likely) },
      stump_grinding: { label: "Optional Stump Grinding", low: stumpLow, high: stumpHigh, optional: true },
      haul_grindings: { label: "Haul Grindings (per stump)", flat: 500, optional: true },
      add_dirt_seed: { label: "Add Dirt & Grass Seed (per stump)", flat: 500, optional: true },
      add_sod: { label: "Add Sod (per stump)", flat: 1500, optional: true },
    },
  };
}

// ── Line Items Builder ────────────────────────────────────────────────────────

/**
 * Build customer-facing quote line items from AIAnalysisRecord + CompanySettings.
 * Customer sees: one bundled line item (e.g. "Large tree removal with full cleanup and haul-away")
 * Internal breakdown is stored separately in internal_notes.
 */
export function buildLineItemsFromAnalysis(record, settings, options = {}) {
  const s = settings || {};
  const {
    includeCrane = record.crane_required || false,
    includeStump = record.stump_grinding_likely || false,
    scenario = "no_crane",
  } = options;

  const pricing = calculateScenarioPricing(record, s);
  const mainLow = scenario === "crane" ? pricing.crane_required_price_low : pricing.no_crane_price_low;
  const mainHigh = scenario === "crane" ? pricing.crane_required_price_high : pricing.no_crane_price_high;
  const mainPrice = record.human_final_price || Math.round((mainLow + mainHigh) / 2 / 5) * 5;

  const species = record.detected_species || "Tree";
  const heightStr = record.estimated_height_ft_high ? ` (~${record.estimated_height_ft_high}ft)` : "";
  const service = record.recommended_service || "Tree Removal";

  // Customer-facing: single bundled line item
  const customerDescription = buildCustomerDescription(species, service, record);

  const lineItems = [
    {
      description: customerDescription,
      quantity: 1,
      unit_price: mainPrice,
      total: mainPrice,
      _internal: buildInternalBreakdown(pricing, record),
    },
  ];

  if (includeCrane || record.crane_required) {
    const craneRate = s.crane_day_rate || 1500;
    lineItems.push({ description: "Additional Equipment (Crane / Specialty)", quantity: 1, unit_price: craneRate, total: craneRate });
  }

  if (includeStump) {
    const stumpPrice = Math.round((pricing.stump_price_low + pricing.stump_price_high) / 2 / 5) * 5;
    const dbh = record.estimated_dbh_inches_high || 12;
    lineItems.push({ description: `Stump Grinding (~${Math.round(dbh)}" diameter)`, quantity: 1, unit_price: stumpPrice, total: stumpPrice });
    lineItems.push({ description: "Haul Grindings", quantity: 1, unit_price: 500, total: 500 });
    lineItems.push({ description: "Add Dirt & Grass Seed", quantity: 1, unit_price: 500, total: 500 });
    lineItems.push({ description: "Add Sod", quantity: 1, unit_price: 1500, total: 1500 });
  }

  if (s.travel_fee_base > 0) {
    lineItems.push({ description: "Travel & Mobilization", quantity: 1, unit_price: s.travel_fee_base, total: s.travel_fee_base });
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
  const total = Math.max(subtotal, s.minimum_job_price || 150);

  return { lineItems, subtotal, total, priceLow: pricing.price_low, priceHigh: pricing.price_high, pricing };
}

/**
 * Build a clear, customer-facing description (no internal labor details).
 */
function buildCustomerDescription(species, service, record) {
  const heightStr = record.estimated_height_ft_high ? ` (~${record.estimated_height_ft_high}ft)` : "";
  const serviceLabel = service.includes("remov") ? "removal" : service.includes("trim") ? "trimming & pruning" : service;
  const cleanup = (record.cleanup_volume_estimate && record.cleanup_volume_estimate !== "minimal")
    ? " with full cleanup and haul-away"
    : " with site cleanup";
  return `${species}${heightStr} — ${serviceLabel}${cleanup}`;
}

/**
 * Build internal breakdown string for company-facing notes.
 */
function buildInternalBreakdown(pricing, record) {
  const h = pricing.estimated_hours || {};
  const l = pricing.estimated_loads || {};
  return [
    `Production breakdown (internal):`,
    `  Removal/cutting: ~${h.removalHours || "?"}h`,
    `  Ground crew/chipping: ~${h.groundChippingHours || "?"}h`,
    `  Log handling/loading: ~${h.logHandlingHours || "?"}h`,
    `  Final cleanup: ~${h.finalCleanupHours || "?"}h`,
    `  TOTAL production hours: ~${h.totalHours || "?"}h`,
    `  Chip loads: ${l.chipLoads || 0} (max 2)`,
    `  Standard wood loads: ${l.standardWoodLoads || 0}`,
    `  Oversized wood loads (>40"): ${l.oversizedWoodLoads || 0}`,
  ].join("\n");
}

// ── Quote Totals ──────────────────────────────────────────────────────────────

export function calculateQuoteTotals(lineItems, discountAmount = 0, taxRate = 0) {
  const subtotal = (lineItems || []).reduce((s, i) => s + (i.total || 0), 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.max(0, subtotal - discountAmount + taxAmount);
  return { subtotal, taxAmount, total };
}

// ── Priority from Analysis ────────────────────────────────────────────────────

export function determinePriority(analysis) {
  if (analysis.urgency_level === "emergency") return "emergency";
  const { tier } = calculateComplexity(analysis, {});
  if (tier === "extreme" || analysis.crane_required) return "high";
  if (tier === "high") return "high";
  return "normal";
}