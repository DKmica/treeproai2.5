/**
 * TreePro AI — Shared Pricing Engine (frontend)
 * Single source of truth for ALL pricing calculations.
 * Used by: publicTreeChat, PublicEstimate, AIAnalysis, QuoteDetail, generateAssessmentQuote.
 */

// ── Complexity Scoring ────────────────────────────────────────────────────────

/**
 * Score job complexity 0–100 from AI analysis fields.
 * Returns { score, tier, pricingFloor, rangeWidthPct }
 */
export function calculateComplexity(analysis, settings = {}) {
  const s = settings;
  let score = 0;

  const heightHigh = analysis.estimated_height_ft_high || 0;
  const heightLow = analysis.estimated_height_ft_low || 0;
  const heightMid = (heightLow + heightHigh) / 2 || heightHigh;

  const dbhHigh = analysis.estimated_dbh_inches_high || 0;
  const dbhMid = ((analysis.estimated_dbh_inches_low || 0) + dbhHigh) / 2 || dbhHigh;

  const species = (analysis.detected_species || "").toLowerCase();
  const isDenseWood = /oak|hickory|sycamore|elm|ash/.test(species);

  // Height scoring
  if (heightMid >= 90) score += 25;
  else if (heightMid >= 70) score += 20;
  else if (heightMid >= 50) score += 12;
  else if (heightMid >= 25) score += 5;

  // DBH scoring
  if (dbhMid >= 48) score += 20;
  else if (dbhMid >= 36) score += 15;
  else if (dbhMid >= 24) score += 8;
  else if (dbhMid >= 12) score += 3;

  // Dense hardwood
  if (isDenseWood) score += 10;

  // Structure proximity
  if (analysis.canopy_over_structure) score += 20;
  else if (analysis.structures_nearby) score += 10;

  // Drop zone
  if (analysis.limited_drop_zone) score += 15;

  // Equipment
  if (analysis.crane_required) score += 15;
  else if (analysis.crane_likely) score += 10;

  // Risk
  if (analysis.risk_level === "extreme") score += 10;
  else if (analysis.risk_level === "high") score += 5;

  score = Math.min(100, score);

  let tier, pricingFloor, rangeWidthPct;
  const minJob = s.minimum_job_price || 150;
  const minLarge = s.minimum_large_removal_price || 4500;
  const minHighRisk = s.minimum_high_risk_removal_price || 6500;
  const minExtreme = s.minimum_extreme_removal_price || 8500;
  const minCrane = s.minimum_crane_removal_price || 10500;

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
 * Returns all price scenarios plus recommended defaults.
 */
export function calculateScenarioPricing(analysis, settings = {}) {
  const s = settings;
  const crewRate = s.crew_hourly_rate || 65;
  const profitPct = (s.profit_margin_percent || 35) / 100;
  const riskPct = (s.risk_markup_percent || 20) / 100;
  const emergencyPct = (s.emergency_markup_percent || 40) / 100;
  const stumpBase = s.stump_grinding_base_price || 100;
  const stumpPerInch = s.stump_grinding_per_inch || 4;
  const craneRate = s.crane_day_rate || 1500;
  // Debris disposal removed — included in service price

  const denseWoodMkp = ((analysis.detected_species || "").toLowerCase().match(/oak|hickory|sycamore|elm|ash/) ? (s.oak_dense_wood_markup_percent || 15) : 0) / 100;
  const structureMkp = (analysis.canopy_over_structure ? (s.structure_overhang_markup_percent || 20) : 0) / 100;
  const dropZoneMkp = (analysis.limited_drop_zone ? (s.limited_drop_zone_markup_percent || 15) : 0) / 100;
  const riggingMkp = (s.advanced_rigging_markup_percent || 20) / 100;
  const craneMkp = (s.crane_required_markup_percent || 30) / 100;

  const { score, tier, pricingFloor, rangeWidthPct } = calculateComplexity(analysis, s);

  const heightMid = ((analysis.estimated_height_ft_low || 0) + (analysis.estimated_height_ft_high || 30)) / 2;
  const dbhMid = ((analysis.estimated_dbh_inches_low || 0) + (analysis.estimated_dbh_inches_high || 12)) / 2;

  // Base hours by height
  let baseHours = heightMid < 25 ? 2 : heightMid < 50 ? 4 : heightMid < 75 ? 8 : 14;

  // Risk multiplier
  const riskLevel = analysis.risk_level || "low";
  if (riskLevel === "moderate") baseHours *= (1 + riskPct * 0.5);
  else if (riskLevel === "high") baseHours *= (1 + riskPct);
  else if (riskLevel === "extreme") baseHours *= (1 + riskPct * 1.5);

  // Emergency
  if (analysis.urgency_level === "emergency") baseHours *= (1 + emergencyPct);

  // Base labor cost with profit
  const baseLaborWithProfit = (baseHours * crewRate) / (1 - profitPct);

  // Apply complexity markups
  const complexityMkp = denseWoodMkp + structureMkp + dropZoneMkp;
  const baseWithComplexity = baseLaborWithProfit * (1 + complexityMkp);

  // Advanced rigging removal (no crane)
  const noCraneBase = baseWithComplexity * (1 + riggingMkp);
  const noCraneLow = Math.max(Math.round(noCraneBase / 5) * 5, pricingFloor);
  const noCraneHigh = Math.round(noCraneLow * (1 + rangeWidthPct / 100) / 5) * 5;

  // Crane-assisted removal
  const craneMinFloor = s.minimum_crane_removal_price || 10500;
  const craneBase = baseWithComplexity * (1 + riggingMkp + craneMkp) + craneRate;
  const craneLow = Math.max(Math.round(craneBase / 5) * 5, craneMinFloor);
  const craneHigh = Math.round(craneLow * (1 + rangeWidthPct / 100) / 5) * 5;

  // Stump grinding
  const stumpPrice = Math.round(stumpBase + dbhMid * stumpPerInch);
  const stumpLow = Math.max(Math.round(stumpPrice * 0.9 / 5) * 5, stumpBase);
  const stumpHigh = Math.round(stumpPrice * 1.1 / 5) * 5;

  // Default overall low/high (use no-crane as default unless crane_required)
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
 * Build quote line items from AIAnalysisRecord + CompanySettings.
 * Options: { includeCrane, includeStump, includeHaulaway, scenario }
 */
export function buildLineItemsFromAnalysis(record, settings, options = {}) {
  const s = settings || {};
  const { includeCrane = record.crane_required || false, includeStump = record.stump_grinding_likely || false, scenario = "no_crane" } = options;

  const pricing = calculateScenarioPricing(record, s);

  // Main removal line item
  const mainLow = scenario === "crane" ? pricing.crane_required_price_low : pricing.no_crane_price_low;
  const mainHigh = scenario === "crane" ? pricing.crane_required_price_high : pricing.no_crane_price_high;
  // Use midpoint for line item, or human override
  const mainPrice = record.human_final_price || Math.round((mainLow + mainHigh) / 2 / 5) * 5;

  const lineItems = [
    {
      description: record.recommended_service || "Tree Removal",
      quantity: 1,
      unit_price: mainPrice,
      total: mainPrice,
    },
  ];

  // Additional special equipment (crane or other — custom price, only added when crane_required)
  if (includeCrane || record.crane_required) {
    const craneRate = s.crane_day_rate || 1500;
    lineItems.push({ description: "Additional Equipment (Crane / Specialty)", quantity: 1, unit_price: craneRate, total: craneRate });
  }

  // Stump grinding
  if (includeStump) {
    const stumpPrice = Math.round((pricing.stump_price_low + pricing.stump_price_high) / 2 / 5) * 5;
    const dbh = record.estimated_dbh_inches_high || 12;
    lineItems.push({
      description: `Stump Grinding (~${Math.round(dbh)}" diameter)`,
      quantity: 1,
      unit_price: stumpPrice,
      total: stumpPrice,
    });
    // Stump add-on options (priced per stump, quantity defaults to 1)
    lineItems.push({ description: "Haul Grindings", quantity: 1, unit_price: 500, total: 500 });
    lineItems.push({ description: "Add Dirt & Grass Seed", quantity: 1, unit_price: 500, total: 500 });
    lineItems.push({ description: "Add Sod", quantity: 1, unit_price: 1500, total: 1500 });
  }

  // Travel fee
  if (s.travel_fee_base > 0) {
    lineItems.push({ description: "Travel & Mobilization", quantity: 1, unit_price: s.travel_fee_base, total: s.travel_fee_base });
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
  const total = Math.max(subtotal, s.minimum_job_price || 150);

  return {
    lineItems,
    subtotal,
    total,
    priceLow: pricing.price_low,
    priceHigh: pricing.price_high,
    pricing,
  };
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