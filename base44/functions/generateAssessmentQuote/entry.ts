import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * generateAssessmentQuote — Production-labor-based pricing engine.
 *
 * CORRECTED FORMULA:
 *   productionLaborCost = totalProductionHours × crewProductionRate ($500/hr)
 *   chipDumpFees = min(chipLoads, 2) × $120
 *   woodDumpFees = standardWoodLoads × $220 + oversizedWoodLoads × $440
 *   jobSubtotal = productionLaborCost + chipDumpFees + woodDumpFees + equipmentCharges
 *   finalPrice = jobSubtotal × 1.20 overhead/profit multiplier
 *
 * IMPORTANT: totalProductionHours = ALL labor phases combined:
 *   removal/cutting + rigging + ground work + chipping + log handling + cleanup
 *   NOT just cleanup time.
 *
 * TRAINING EXAMPLE — Large mature oak, full removal, 16 total production hours:
 *   16 × $500 = $8,000 + $240 chips + $880 oversized logs = $9,120 × 1.20 = $10,944
 *   → Quote ~$10,900–$11,500
 */

const CREW_PRODUCTION_RATE = 500;  // $/hr — total production rate, ALL tasks
const CHIP_DUMP_RATE = 120;         // $/load
const STANDARD_WOOD_DUMP_RATE = 220; // $/load
const OVERSIZED_WOOD_DUMP_RATE = 440; // $/load, logs > 40" diameter
const MAX_CHIP_LOADS = 2;
const OVERHEAD_PROFIT_MULTIPLIER = 1.20;

function estimateProductionHours(tree, extractedData) {
  const height = tree.height_ft || 30;
  const dbh = tree.diameter_in || 12;
  const risk = tree.risk_level || 'low';
  const hasStructure = tree.structures_nearby || tree.location_notes?.includes('structure');
  const limitedDrop = tree.location_notes?.includes('limited');
  const craneRequired = tree.needs_crane || false;
  const isDenseWood = /oak|hickory|sycamore|elm|ash/i.test(tree.species || '');

  // Removal/cutting/rigging hours
  let removalHours;
  if (height < 25) removalHours = 0.5;
  else if (height < 40) removalHours = 1.5;
  else if (height < 55) removalHours = 3;
  else if (height < 70) removalHours = 5;
  else if (height < 85) removalHours = 7;
  else removalHours = 10;

  if (risk === 'moderate') removalHours *= 1.15;
  else if (risk === 'high') removalHours *= 1.30;
  else if (risk === 'extreme') removalHours *= 1.50;
  if (hasStructure) removalHours *= 1.2;
  if (limitedDrop) removalHours *= 1.15;
  if (craneRequired) removalHours *= 0.7;

  // Ground crew + chipping hours
  let groundChippingHours;
  if (height < 25) groundChippingHours = 0.5;
  else if (height < 50) groundChippingHours = 1.5;
  else if (height < 70) groundChippingHours = 2.5;
  else groundChippingHours = 4;

  // Log handling / loading hours
  let logHandlingHours;
  if (dbh < 12) logHandlingHours = 0.5;
  else if (dbh < 24) logHandlingHours = 1;
  else if (dbh < 36) logHandlingHours = 1.5;
  else logHandlingHours = 2.5;
  if (isDenseWood) logHandlingHours *= 1.25;

  // Final site cleanup
  let finalCleanupHours;
  if (height < 25) finalCleanupHours = 0.5;
  else if (height < 50) finalCleanupHours = 1;
  else if (height < 70) finalCleanupHours = 1.5;
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

function estimateDumpLoads(tree) {
  const height = tree.height_ft || 30;
  const dbh = tree.diameter_in || 12;

  const chipLoads = Math.min(height < 30 ? 1 : 2, MAX_CHIP_LOADS);
  const oversizedWoodLoads = dbh >= 40 ? Math.ceil(dbh / 40) : 0;
  const standardWoodLoads = dbh >= 20 && oversizedWoodLoads === 0 ? 1 : 0;

  return { chipLoads, standardWoodLoads, oversizedWoodLoads };
}

function calculateProductionPrice(productionHours, loads, options, s) {
  const crewRate = s.crew_production_rate || CREW_PRODUCTION_RATE;
  const chipRate = CHIP_DUMP_RATE;
  const stdWoodRate = STANDARD_WOOD_DUMP_RATE;
  const oversizedWoodRate = OVERSIZED_WOOD_DUMP_RATE;
  const craneDay = s.crane_day_rate || 1500;
  const multiplier = s.overhead_profit_multiplier || OVERHEAD_PROFIT_MULTIPLIER;

  const productionLaborCost = productionHours * crewRate;
  const actualChipLoads = Math.min(loads.chipLoads, MAX_CHIP_LOADS);
  const chipDumpFees = actualChipLoads * chipRate;
  const woodDumpFees = loads.standardWoodLoads * stdWoodRate + loads.oversizedWoodLoads * oversizedWoodRate;
  const equipmentCharges = options.craneRequired ? craneDay : 0;
  const emergencyAdd = options.isEmergency ? productionLaborCost * 0.40 : 0;

  const jobSubtotal = productionLaborCost + chipDumpFees + woodDumpFees + equipmentCharges + emergencyAdd;
  const finalPrice = Math.round((jobSubtotal * multiplier) / 5) * 5;

  return {
    productionLaborCost: Math.round(productionLaborCost),
    chipDumpFees: Math.round(chipDumpFees),
    woodDumpFees: Math.round(woodDumpFees),
    equipmentCharges: Math.round(equipmentCharges),
    jobSubtotal: Math.round(jobSubtotal),
    finalPrice,
    breakdown: { crewRate, actualChipLoads, loads, multiplier },
  };
}

function buildPricingFromSettings(trees, extractedData, s) {
  const stumpBase = s.stump_grinding_base_price || 100;
  const stumpPerInch = s.stump_grinding_per_inch || 4;
  const minPrice = s.minimum_job_price || 150;
  const minLargeRemoval = s.minimum_large_removal_price || 4500;
  const minHighRisk = s.minimum_high_risk_removal_price || 6500;
  const minExtreme = s.minimum_extreme_removal_price || 8500;
  const minCrane = s.minimum_crane_removal_price || 10500;

  const lineItems = [];
  let totalAmount = 0;
  const internalBreakdownParts = [];

  for (const tree of trees) {
    const isEmergency = tree.risk_level === 'extreme' || extractedData.urgency === 'emergency';
    const service = (tree.recommended_service || 'removal').replace('emergency_', '');
    const treeLabel = tree.species && tree.species !== 'Unknown' ? tree.species : 'Tree';
    const heightStr = tree.height_ft ? ` (~${tree.height_ft}ft)` : '';

    if (service === 'removal' || service === 'emergency_removal') {
      const hours = estimateProductionHours(tree, extractedData);
      const loads = estimateDumpLoads(tree);
      const priceResult = calculateProductionPrice(hours.totalHours, loads, {
        craneRequired: tree.needs_crane || false,
        isEmergency,
      }, s);

      // Apply complexity-based minimum price floors
      let floorPrice = minPrice;
      if (tree.height_ft >= 70 && tree.diameter_in >= 36) {
        floorPrice = tree.needs_crane ? minCrane : minExtreme;
      } else if (tree.height_ft >= 50 && (tree.risk_level === 'high' || tree.risk_level === 'extreme')) {
        floorPrice = tree.needs_crane ? minCrane : minHighRisk;
      } else if (tree.height_ft >= 50 || tree.diameter_in >= 24) {
        floorPrice = minLargeRemoval;
      }

      const price = Math.max(priceResult.finalPrice, floorPrice);

      // Customer-facing: single bundled description (no labor details)
      const cleanupType = (tree.diameter_in >= 30) ? 'with full cleanup and haul-away' : 'with site cleanup';
      const customerDesc = `${isEmergency ? 'Emergency ' : ''}${treeLabel}${heightStr} — ${service === 'removal' ? 'full removal' : service} ${cleanupType}`;

      lineItems.push({
        description: customerDesc,
        quantity: 1,
        unit_price: price,
        total: price,
      });
      totalAmount += price;

      // Internal breakdown stored separately
      internalBreakdownParts.push(
        `[${treeLabel}${heightStr}]`,
        `  Removal/cutting: ${hours.removalHours}h`,
        `  Ground/chipping: ${hours.groundChippingHours}h`,
        `  Log handling: ${hours.logHandlingHours}h`,
        `  Final cleanup: ${hours.finalCleanupHours}h`,
        `  TOTAL production hours: ${hours.totalHours}h`,
        `  Chip loads: ${loads.chipLoads} (max ${MAX_CHIP_LOADS} @ $${CHIP_DUMP_RATE}/load)`,
        `  Standard wood loads: ${loads.standardWoodLoads} @ $${STANDARD_WOOD_DUMP_RATE}/load`,
        `  Oversized wood loads (>40"): ${loads.oversizedWoodLoads} @ $${OVERSIZED_WOOD_DUMP_RATE}/load`,
        `  Production labor: $${priceResult.productionLaborCost} | Chip fees: $${priceResult.chipDumpFees} | Wood fees: $${priceResult.woodDumpFees}`,
        `  Job subtotal: $${priceResult.jobSubtotal} × ${priceResult.breakdown.multiplier}× = $${priceResult.finalPrice}`,
        `  Applied price (after floor): $${price}`,
        ''
      );

      // Crane if needed
      if (tree.needs_crane) {
        const craneRate = s.crane_day_rate || 1500;
        lineItems.push({ description: 'Crane / Lift Equipment', quantity: 1, unit_price: craneRate, total: craneRate });
        totalAmount += craneRate;
      }

      // Stump grinding
      if (tree.needs_stump_grinding) {
        const dbh = tree.diameter_in || 12;
        const stumpPrice = Math.round(stumpBase + dbh * stumpPerInch);
        lineItems.push({ description: `Stump Grinding & Root Flare (~${dbh}" dia.)`, quantity: 1, unit_price: stumpPrice, total: stumpPrice });
        totalAmount += stumpPrice;
      }

    } else if (service === 'trimming' || service === 'pruning') {
      const hours = estimateProductionHours(tree, extractedData);
      // Trimming uses same production-rate formula but shorter hours
      const trimmingHours = hours.totalHours * 0.6; // trimming is less intensive than full removal
      const laborCost = trimmingHours * (s.crew_production_rate || CREW_PRODUCTION_RATE);
      const price = Math.max(Math.round((laborCost * OVERHEAD_PROFIT_MULTIPLIER) / 5) * 5, minPrice);

      lineItems.push({
        description: `Tree Trimming & Crown Maintenance — ${treeLabel}${heightStr}`,
        quantity: 1, unit_price: price, total: price,
      });
      totalAmount += price;

    } else if (service === 'stump_grinding') {
      const dbh = tree.diameter_in || 12;
      const stumpPrice = Math.round(stumpBase + dbh * stumpPerInch);
      lineItems.push({ description: `Stump Grinding — ${treeLabel}${heightStr}`, quantity: 1, unit_price: stumpPrice, total: stumpPrice });
      totalAmount += stumpPrice;
    }
  }

  // Travel fee
  if (s.travel_fee_base > 0) {
    lineItems.push({ description: 'Travel & Mobilization Fee', quantity: 1, unit_price: s.travel_fee_base, total: s.travel_fee_base });
    totalAmount += s.travel_fee_base;
  }

  const internalBreakdown = internalBreakdownParts.join('\n');
  return { lineItems, totalAmount, internalBreakdown };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assessment_text, customer_name, customer_id, lead_id, ai_analysis_id, service_type, structured_analysis } = await req.json();

    if (!assessment_text && !structured_analysis) {
      return Response.json({ error: 'assessment_text or structured_analysis is required' }, { status: 400 });
    }

    const settingsArr = await base44.asServiceRole.entities.CompanySettings.list();
    const s = settingsArr[0] || {};
    const expiryDays = s.quote_expiration_days || 30;

    let extracted;

    if (structured_analysis && (structured_analysis.estimated_height_ft_high || structured_analysis.detected_species)) {
      const avgHeight = ((structured_analysis.estimated_height_ft_low || 0) + (structured_analysis.estimated_height_ft_high || 0)) / 2 || null;
      const avgDiameter = ((structured_analysis.estimated_dbh_inches_low || 0) + (structured_analysis.estimated_dbh_inches_high || 0)) / 2 || null;
      const service = structured_analysis.recommended_service || 'removal';
      extracted = {
        trees: [{
          species: structured_analysis.detected_species || 'Unknown',
          height_ft: avgHeight,
          diameter_in: avgDiameter,
          condition: structured_analysis.condition_summary?.split(' ')[0] || 'fair',
          risk_level: structured_analysis.risk_level || 'moderate',
          recommended_service: service,
          needs_crane: structured_analysis.crane_required || structured_analysis.crane_likely || false,
          needs_stump_grinding: structured_analysis.stump_grinding_likely || false,
          structures_nearby: structured_analysis.structures_nearby || false,
          location_notes: structured_analysis.access_difficulty || '',
          hazards: structured_analysis.hazards_detected || '',
        }],
        urgency: structured_analysis.urgency_level || 'normal',
        overall_notes: structured_analysis.ai_reasoning_summary || structured_analysis.condition_summary || '',
        customer_name_from_chat: customer_name || '',
        address_from_chat: '',
        scope_summary: structured_analysis.recommended_service || 'Tree removal',
      };
    } else {
      extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Extract tree assessment details from this conversation/assessment text. 
If multiple trees are mentioned, extract data for each one.

Assessment text:
${(assessment_text || '').slice(0, 4000)}

Extract the following for EACH tree mentioned:`,
        response_json_schema: {
          type: "object",
          properties: {
            trees: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  species: { type: "string" },
                  height_ft: { type: "number" },
                  diameter_in: { type: "number" },
                  condition: { type: "string", enum: ["excellent", "good", "fair", "poor", "dead"] },
                  risk_level: { type: "string", enum: ["low", "moderate", "high", "extreme"] },
                  recommended_service: { type: "string", enum: ["removal", "trimming", "pruning", "stump_grinding", "emergency_removal"] },
                  needs_crane: { type: "boolean" },
                  needs_stump_grinding: { type: "boolean" },
                  structures_nearby: { type: "boolean" },
                  hazards: { type: "string" },
                  location_notes: { type: "string" }
                }
              }
            },
            urgency: { type: "string", enum: ["low", "normal", "high", "emergency"] },
            overall_notes: { type: "string" },
            customer_name_from_chat: { type: "string" },
            address_from_chat: { type: "string" },
            scope_summary: { type: "string" }
          }
        }
      });
    }

    const trees = extracted.trees || [];
    let lineItems = [];
    let totalAmount = 0;
    let internalBreakdown = '';

    if (trees.length > 0) {
      const result = buildPricingFromSettings(trees, extracted, s);
      lineItems = result.lineItems;
      totalAmount = result.totalAmount;
      internalBreakdown = result.internalBreakdown;
    } else {
      // Fallback AI-generated line items
      const fallback = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate a tree service quote based on this assessment. Use production-labor pricing.
Crew production rate: $${s.crew_production_rate || 500}/hr (covers ALL tasks: cutting, rigging, chipping, log handling, cleanup)
Minimum job price: $${s.minimum_job_price || 150}
Service type: ${service_type || 'general tree service'}
Assessment: ${(assessment_text || '').slice(0, 2000)}
Generate simple, customer-friendly bundled line items. Do not list cleanup as a separate item from the main removal.`,
        response_json_schema: {
          type: "object",
          properties: {
            line_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  quantity: { type: "number" },
                  unit_price: { type: "number" },
                  total: { type: "number" }
                }
              }
            },
            notes: { type: "string" }
          }
        }
      });
      lineItems = fallback.line_items || [];
      totalAmount = lineItems.reduce((sum, i) => sum + (i.total || 0), 0);
      totalAmount = Math.max(totalAmount, s.minimum_job_price || 150);
    }

    const quoteNumber = `Q-${Date.now().toString(36).toUpperCase()}`;
    const resolvedCustomerName = customer_name || extracted.customer_name_from_chat || 'Property Owner';
    const validUntil = new Date(Date.now() + expiryDays * 86400000).toISOString().split('T')[0];
    const resolvedAnalysisId = ai_analysis_id || structured_analysis?.id || '';

    const customerNotes = [
      extracted.overall_notes,
      extracted.address_from_chat ? `Property: ${extracted.address_from_chat}` : null,
      '*Preliminary estimate. Final pricing confirmed after on-site assessment by a certified arborist.',
    ].filter(Boolean).join('\n\n');

    const quote = await base44.asServiceRole.entities.Quote.create({
      quote_number: quoteNumber,
      customer_id: customer_id || '',
      customer_name: resolvedCustomerName,
      lead_id: lead_id || '',
      ai_analysis_id: resolvedAnalysisId,
      status: 'draft',
      line_items: lineItems,
      subtotal: totalAmount,
      total_amount: totalAmount,
      ai_generated: true,
      ai_analysis: JSON.stringify({ trees, urgency: extracted.urgency }),
      scope_of_work: extracted.scope_summary || (trees.length > 0 ? `${trees[0].recommended_service} – ${trees.length} tree(s)` : 'Tree service'),
      notes: customerNotes,
      internal_notes: internalBreakdown || undefined,
      valid_until: validUntil,
    });

    await base44.asServiceRole.entities.QuoteVersion.create({
      quote_id: quote.id,
      version_number: 1,
      line_items: lineItems,
      subtotal: totalAmount,
      discount_amount: 0,
      tax_amount: 0,
      total: totalAmount,
      changed_by: 'AI Assessment',
      change_reason: 'Auto-generated from AI analysis (production-labor formula)',
      status_at_save: 'draft',
    });

    await base44.asServiceRole.entities.ActivityLog.create({
      related_type: 'Quote',
      related_id: quote.id,
      actor: user.full_name || user.email || 'staff',
      action: `Quote ${quoteNumber} generated from AI assessment`,
      notes: `${trees.length} tree(s) assessed · $${totalAmount.toLocaleString()}`,
    });

    if (resolvedAnalysisId) {
      await base44.asServiceRole.entities.AIAnalysisRecord.update(resolvedAnalysisId, { quote_id: quote.id }).catch(() => {});
    }

    return Response.json({
      quote,
      trees_assessed: trees.length,
      line_items: lineItems,
      total_amount: totalAmount,
      pricing_source: 'production_labor_formula',
      internal_breakdown: internalBreakdown,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});