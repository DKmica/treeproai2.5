/**
 * TreePro AI — Fail-Proof Pricing Engine
 * Single source of truth for ALL pricing calculations.
 */

// ── Sanity Checks & Overrides ───────────────────────────────────────────────

/**
 * AI text extractors can hallucinate. This function enforces hard logic rules
 * to override dangerous AI assumptions before pricing is calculated.
 */
function sanitizeAnalysis(rawAnalysis) {
  const analysis = { ...rawAnalysis };

  // 1. Normalize numbers
  const heightLow = parseFloat(analysis.estimated_height_ft_low) || 0;
  const heightHigh = parseFloat(analysis.estimated_height_ft_high) || 0;
  const heightMid = heightHigh > 0 ? (heightLow + heightHigh) / 2 : 25; // Default 25ft

  const dbhLow = parseFloat(analysis.estimated_dbh_inches_low) || 0;
  const dbhHigh = parseFloat(analysis.estimated_dbh_inches_high) || 0;
  const dbhMid = dbhHigh > 0 ? (dbhLow + dbhHigh) / 2 : 12; // Default 12"

  // 2. Logic Overrides: Height + Structure = High Risk
  if (heightMid >= 50 && (analysis.canopy_over_structure || analysis.structures_nearby)) {
    if (analysis.risk_level === "low" || analysis.risk_level === "moderate") {
      analysis.risk_level = "high"; // Force high risk
    }
  }

  // 3. Logic Overrides: Monster Trees = Extreme Risk & Crane
  if (heightMid >= 70 && dbhMid >= 36) {
    analysis.risk_level = "extreme";
    analysis.crane_likely = true; // Force crane consideration
  }

  // 4. Clean up species
  const species = (analysis.detected_species || "").toLowerCase();
  const isDenseWood = /oak|hickory|sycamore|elm|ash|maple/.test(species);

  return { ...analysis, heightMid, dbhMid, isDenseWood };
}


// ── Complexity Scoring ────────────────────────────────────────────────────────

export function calculateComplexity(rawAnalysis, settings = {}) {
  const analysis = sanitizeAnalysis(rawAnalysis);
  let score = 0;

  // Exponential height scoring
  if (analysis.heightMid >= 90) score += 35;
  else if (analysis.heightMid >= 70) score += 25;
  else if (analysis.heightMid >= 50) score += 15;
  else if (analysis.heightMid >= 30) score += 5;

  // Exponential DBH scoring
  if (analysis.dbhMid >= 48) score += 30;
  else if (analysis.dbhMid >= 36) score += 20;
  else if (analysis.dbhMid >= 24) score += 10;
  else if (analysis.dbhMid >= 12) score += 4;

  if (analysis.isDenseWood) score += 10;
  if (analysis.canopy_over_structure) score += 20;
  else if (analysis.structures_nearby) score += 10;
  if (analysis.limited_drop_zone) score += 15;
  if (analysis.crane_required || analysis.crane_likely) score += 15;

  if (analysis.risk_level === "extreme") score += 15;
  else if (analysis.risk_level === "high") score += 10;

  score = Math.min(100, score);

  let tier = "low";
  if (score >= 75) tier = "extreme";
  else if (score >= 50) tier = "high";
  else if (score >= 25) tier = "moderate";

  return { score, tier, sanitizedAnalysis: analysis };
}


// ── Core Physics & Math Pricing ───────────────────────────────────────────────

export function calculateScenarioPricing(rawAnalysis, settings = {}) {
  const s = settings || {};
  const { score, tier, sanitizedAnalysis: a } = calculateComplexity(rawAnalysis, s);

  // -- 1. Load Financial Settings --
  const crewRate = parseFloat(s.crew_hourly_rate) || 65;
  const profitMargin = (parseFloat(s.profit_margin_percent) || 35) / 100;
  const craneRate = parseFloat(s.crane_day_rate) || 1500;
  const stumpBase = parseFloat(s.stump_grinding_base_price) || 100;
  const stumpPerInch = parseFloat(s.stump_grinding_per_inch) || 4;

  // -- 2. Volume-Based Load Estimation (The Physics Layer) --
  const radiusFt = (a.dbhMid / 2) / 12;

  // Trunk Volume (Cylinder) - Assume trunk is ~40% of total height
  const trunkVolumeFt3 = Math.PI * Math.pow(radiusFt, 2) * (a.heightMid * 0.4);

  // Canopy/Brush Volume (Cone) - Assume canopy is ~60% of height, spread is 1.5x radius
  const brushVolumeFt3 = (Math.PI * Math.pow(radiusFt * 1.5, 2) * (a.heightMid * 0.6)) / 3;

  // Calculate distinct loads (1 chip load ~= 250 cu ft brush; 1 log load ~= 150 cu ft solid wood)
  const chipLoads = Math.max(1, Math.ceil(brushVolumeFt3 / 250));
  const logLoads = a.dbhMid >= 12 ? Math.max(1, Math.ceil(trunkVolumeFt3 / 150)) : 0;

  // Base labor: Setup (2hr) + Chipping (~1.5hr/load) + Log handling (~2.5hr/load)
  let baseHours = 2 + (chipLoads * 1.5) + (logLoads * 2.5);

  // Apply Risk & Complexity Multipliers to Time
  if (a.risk_level === "extreme") baseHours *= 1.8; // e.g. 11 base hrs -> ~20 hrs
  else if (a.risk_level === "high") baseHours *= 1.5; // e.g. 11 base hrs -> ~16.5 hrs
  else if (a.risk_level === "moderate") baseHours *= 1.2;

  if (a.isDenseWood) baseHours *= 1.15; // Harder on saws, heavier to rig
  if (a.limited_drop_zone) baseHours *= 1.25;
  if (a.canopy_over_structure) baseHours *= 1.30;

  // Cap base hours for a single tree at 32 hours (4 days for a massive tree)
  baseHours = Math.min(32, Math.max(2, baseHours));

  // -- 3. Calculate Raw Hard Costs --
  const laborCost = baseHours * crewRate;

  // Dynamic Dump Fees based on loads
  const chipLoadCost = parseFloat(s.dump_fee_chips_min) || 120; // Base $120/load
  const logLoadCostLow = parseFloat(s.dump_fee_wood_min) || 220; // Base $220/load
  const logLoadCostHigh = 440; // Max $440/load for massive wood

  const chipsCost = chipLoads * chipLoadCost;
  const logsCostLow = logLoads * logLoadCostLow;
  const logsCostHigh = logLoads * logLoadCostHigh;

  const disposalCostLow = chipsCost + logsCostLow;
  const disposalCostHigh = chipsCost + logsCostHigh;

  // -- 4. Margin Protection (The Financial Floor) --
  // Target Price = Raw Cost / (1 - Profit Margin)
  const baseTargetPriceLow = (laborCost + disposalCostLow) / (1 - profitMargin);
  const baseTargetPriceHigh = (laborCost + disposalCostHigh) / (1 - profitMargin);

  // -- 5. Hardcoded Minimum Floors --
  const minJob = parseFloat(s.minimum_job_price) || 150;
  const minLarge = parseFloat(s.minimum_large_removal_price) || 4500;
  const minHighRisk = parseFloat(s.minimum_high_risk_removal_price) || 6500;
  const minExtreme = parseFloat(s.minimum_extreme_removal_price) || 8500;
  const minCrane = parseFloat(s.minimum_crane_removal_price) || 10500;

  let dynamicFloor = minJob;
  if (tier === "extreme") dynamicFloor = minExtreme;
  else if (tier === "high") dynamicFloor = minHighRisk;
  else if (tier === "moderate") dynamicFloor = minLarge;

  // -- 6. Generate Scenarios --

  // A. No Crane (Advanced Rigging)
  // Rigging takes ~25% longer than standard felling
  let noCraneLow = (baseTargetPriceLow * 1.25);
  noCraneLow = Math.max(noCraneLow, dynamicFloor); // Enforce floor
  let noCraneHigh = (baseTargetPriceHigh * 1.25);

  // B. Crane Assisted
  // Crane speeds up the job by ~30%, but adds hard crane cost
  const craneLaborCost = (baseHours * 0.7) * crewRate;
  const rawCraneCostLow = craneLaborCost + disposalCostLow + craneRate;
  const rawCraneCostHigh = craneLaborCost + disposalCostHigh + craneRate;

  let craneLow = rawCraneCostLow / (1 - profitMargin);
  craneLow = Math.max(craneLow, minCrane); // Force Crane Minimum
  let craneHigh = rawCraneCostHigh / (1 - profitMargin);

  // Apply confidence swing to the high end if the dump fee variation isn't wide enough
  const confidence = a.confidence_score || 50;
  let rangePct = 0.35;
  if (confidence >= 70) rangePct = (parseFloat(s.max_high_confidence_range_percent) || 25) / 100;
  if (confidence < 40) rangePct = (parseFloat(s.max_low_confidence_range_percent) || 45) / 100;

  noCraneHigh = Math.max(noCraneHigh, noCraneLow * (1 + rangePct));
  craneHigh = Math.max(craneHigh, craneLow * (1 + rangePct));

  // Rounding to nearest $50
  const round50 = (num) => Math.round(num / 50) * 50;
  noCraneLow = round50(noCraneLow);
  noCraneHigh = round50(noCraneHigh);
  craneLow = round50(craneLow);
  craneHigh = round50(craneHigh);

  // C. Stump Grinding
  const stumpBasePrice = stumpBase + (a.dbhMid * stumpPerInch);
  const stumpTarget = stumpBasePrice / (1 - profitMargin);
  const stumpLow = round50(stumpTarget * 0.9);
  const stumpHigh = round50(stumpTarget * 1.2);

  // Final Recommended Range
  const priceLow = a.crane_required ? craneLow : noCraneLow;
  const priceHigh = a.crane_required ? craneHigh : noCraneHigh;

  return {
    complexity_score: score,
    complexity_tier: tier,
    pricing_floor: dynamicFloor,
    range_width_percent: Math.round(rangePct * 100),
    estimated_hours: Math.round(baseHours * 10) / 10,
    estimated_chip_loads: chipLoads,
    estimated_log_loads: logLoads,
    price_low: priceLow,
    price_high: priceHigh,
    no_crane_price_low: noCraneLow,
    no_crane_price_high: noCraneHigh,
    crane_required_price_low: craneLow,
    crane_required_price_high: craneHigh,
    stump_price_low: stumpLow,
    stump_price_high: stumpHigh,
    pricing_scenarios: {
      advanced_rigging: { label: "Advanced Rigging (No Crane)", low: noCraneLow, high: noCraneHigh, recommended: !a.crane_required },
      crane_assisted: { label: "Crane-Assisted Removal", low: craneLow, high: craneHigh, recommended: !!(a.crane_required || a.crane_likely) },
      stump_grinding: { label: "Optional Stump Grinding", low: stumpLow, high: stumpHigh, optional: true }
    },
  };
}


// ── Line Items Builder ────────────────────────────────────────────────────────

export function buildLineItemsFromAnalysis(rawAnalysis, settings, options = {}) {
  const s = settings || {};
  const pricing = calculateScenarioPricing(rawAnalysis, s);

  // Re-run sanitization to get clean values for descriptions
  const a = sanitizeAnalysis(rawAnalysis);

  const { includeCrane = a.crane_required || false, includeStump = a.stump_grinding_likely || false, scenario = "no_crane" } = options;

  const mainLow = scenario === "crane" ? pricing.crane_required_price_low : pricing.no_crane_price_low;
  const mainHigh = scenario === "crane" ? pricing.crane_required_price_high : pricing.no_crane_price_high;

  // Use midpoint for line item, or human override
  const mainPrice = rawAnalysis.human_final_price || Math.round((mainLow + mainHigh) / 2 / 50) * 50;

  const lineItems = [
    {
      description: a.recommended_service || "Tree Removal & Disposal",
      quantity: 1,
      unit_price: mainPrice,
      total: mainPrice,
    },
  ];

  if (includeStump) {
    const stumpPrice = Math.round((pricing.stump_price_low + pricing.stump_price_high) / 2 / 10) * 10;
    lineItems.push({
      description: `Stump Grinding (~${Math.round(a.dbhMid)}" diameter)`,
      quantity: 1,
      unit_price: stumpPrice,
      total: stumpPrice,
    });
  }

  if (parseFloat(s.travel_fee_base) > 0) {
    const travel = parseFloat(s.travel_fee_base);
    lineItems.push({ description: "Travel & Mobilization", quantity: 1, unit_price: travel, total: travel });
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.total, 0);
  const total = Math.max(subtotal, parseFloat(s.minimum_job_price) || 150);

  return {
    lineItems,
    subtotal,
    total,
    priceLow: pricing.price_low,
    priceHigh: pricing.price_high,
    pricing,
  };
}

export function calculateQuoteTotals(lineItems, discountAmount = 0, taxRate = 0) {
  const subtotal = (lineItems || []).reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const taxAmount = Math.round(subtotal * (parseFloat(taxRate) || 0) / 100 * 100) / 100;
  const total = Math.max(0, subtotal - parseFloat(discountAmount || 0) + taxAmount);
  return { subtotal, taxAmount, total };
}

export function determinePriority(analysis) {
  if (analysis.urgency_level === "emergency") return "emergency";
  const { tier } = calculateComplexity(analysis, {});
  if (tier === "extreme" || analysis.crane_required) return "high";
  if (tier === "high") return "high";
  return "normal";
}