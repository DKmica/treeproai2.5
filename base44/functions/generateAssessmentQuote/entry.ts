import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * generateAssessmentQuote — CompanySettings-driven pricing engine.
 * Replaces hardcoded PRICING matrix. Uses CompanySettings for all rates.
 * Creates Quote + QuoteVersion v1 automatically.
 */

function getSizeCategory(heightFt) {
  if (!heightFt || heightFt < 25) return 'small';
  if (heightFt < 50) return 'medium';
  if (heightFt < 75) return 'large';
  return 'xlarge';
}

/**
 * Core pricing engine — reads CompanySettings, returns line_items + totals.
 * Applies complexity-based minimum price floors.
 */
function buildPricingFromSettings(trees, extractedData, s) {
  const laborRate = s.default_labor_rate_per_hour || 75;
  const crewRate = s.crew_hourly_rate || 65;
  const emergencyPct = (s.emergency_markup_percent || 40) / 100;
  const riskPct = (s.risk_markup_percent || 20) / 100;
  const profitPct = (s.profit_margin_percent || 35) / 100;
  const stumpBase = s.stump_grinding_base_price || 100;
  const stumpPerInch = s.stump_grinding_per_inch || 4;
  const craneRate = s.crane_day_rate || 1500;
  const dumpBase = s.dump_fee_base || 75;
  const disposalPerYard = s.disposal_fee_per_cubic_yard || 25;
  const minPrice = s.minimum_job_price || 150;
  const minLargeRemoval = s.minimum_large_removal_price || 4500;
  const minHighRisk = s.minimum_high_risk_removal_price || 6500;
  const minExtreme = s.minimum_extreme_removal_price || 8500;
  const minCrane = s.minimum_crane_removal_price || 10500;

  // Base crew hours and pricing by size/service
  const BASE_HOURS = {
    small: { removal: 2, trimming: 1.5, stump_grinding: 1 },
    medium: { removal: 4, trimming: 3, stump_grinding: 1.5 },
    large: { removal: 8, trimming: 5, stump_grinding: 2 },
    xlarge: { removal: 14, trimming: 8, stump_grinding: 3 },
  };

  const lineItems = [];
  let totalAmount = 0;

  for (const tree of trees) {
    const size = getSizeCategory(tree.height_ft);
    const risk = tree.risk_level || 'low';
    const isEmergency = risk === 'extreme' || extractedData.urgency === 'emergency';
    const service = tree.recommended_service || 'removal';

    const treeLabel = tree.species && tree.species !== 'Unknown' ? `${tree.species} tree` : 'Tree';
    const sizeLabel = tree.height_ft ? ` (~${tree.height_ft}ft)` : '';

    const baseHours = BASE_HOURS[size]?.[service.replace('emergency_', '').replace('pruning', 'trimming')] || 4;
    let laborCost = baseHours * crewRate;

    // Risk markup
    if (risk === 'moderate') laborCost *= (1 + riskPct * 0.5);
    else if (risk === 'high') laborCost *= (1 + riskPct);
    else if (risk === 'extreme') laborCost *= (1 + riskPct * 1.5);

    // Emergency markup
    if (isEmergency) laborCost *= (1 + emergencyPct);

    // Profit margin
    const withProfit = laborCost / (1 - profitPct);
    const price = Math.round(Math.max(withProfit, minPrice) / 5) * 5;

    if (service === 'removal' || service === 'emergency_removal') {
      lineItems.push({
        description: `${isEmergency ? 'Emergency ' : ''}Tree Removal – ${treeLabel}${sizeLabel}`,
        quantity: 1, unit_price: price, total: price,
      });
      totalAmount += price;

      // Crane
      if (tree.needs_crane || tree.height_ft > 60) {
        lineItems.push({ description: 'Crane / Lift Equipment', quantity: 1, unit_price: craneRate, total: craneRate });
        totalAmount += craneRate;
      }

      // Stump grinding
      if (tree.needs_stump_grinding !== false) {
        const dbh = tree.diameter_in || 12;
        const stumpPrice = Math.round(stumpBase + dbh * stumpPerInch);
        lineItems.push({ description: `Stump Grinding & Root Flare (~${dbh}" dia.)`, quantity: 1, unit_price: stumpPrice, total: stumpPrice });
        totalAmount += stumpPrice;
      }

      // Debris disposal
      const debrisYards = size === 'small' ? 2 : size === 'medium' ? 4 : size === 'large' ? 7 : 12;
      const debrisCost = Math.round(dumpBase + debrisYards * disposalPerYard);
      lineItems.push({ description: 'Debris Removal & Site Cleanup', quantity: 1, unit_price: debrisCost, total: debrisCost });
      totalAmount += debrisCost;

    } else if (service === 'trimming' || service === 'pruning') {
      lineItems.push({
        description: `Tree Trimming & Crown Maintenance – ${treeLabel}${sizeLabel}`,
        quantity: 1, unit_price: price, total: price,
      });
      totalAmount += price;
      const cleanupCost = Math.round((dumpBase + 2 * disposalPerYard) * 0.6);
      lineItems.push({ description: 'Debris Cleanup', quantity: 1, unit_price: cleanupCost, total: cleanupCost });
      totalAmount += cleanupCost;

    } else if (service === 'stump_grinding') {
      const dbh = tree.diameter_in || 12;
      const stumpPrice = Math.round(stumpBase + dbh * stumpPerInch);
      lineItems.push({ description: `Stump Grinding – ${treeLabel}${sizeLabel}`, quantity: 1, unit_price: stumpPrice, total: stumpPrice });
      totalAmount += stumpPrice;
    }
  }

  // Travel fee
  if (s.travel_fee_base > 0) {
    lineItems.push({ description: 'Travel & Mobilization Fee', quantity: 1, unit_price: s.travel_fee_base, total: s.travel_fee_base });
    totalAmount += s.travel_fee_base;
  }

  // Determine complexity-based minimum price floor
  let appliedMinimum = minPrice;
  for (const tree of trees) {
    if (tree.recommended_service === 'removal' || tree.recommended_service === 'emergency_removal') {
      const height = tree.height_ft || 0;
      const diameter = tree.diameter_in || 0;
      const risk = tree.risk_level || 'low';
      const craneNeeded = tree.needs_crane || height > 60;
      
      // Apply complexity-based minimum
      if (height >= 70 && diameter >= 36 && (tree.hazards?.includes('structure') || risk === 'extreme')) {
        // Extreme complexity
        appliedMinimum = Math.max(appliedMinimum, craneNeeded ? minCrane : minExtreme);
      } else if (height >= 50 && (tree.hazards?.includes('structure') || risk === 'high')) {
        // High risk
        appliedMinimum = Math.max(appliedMinimum, craneNeeded ? minCrane : minHighRisk);
      } else if (height >= 50 || diameter >= 24) {
        // Large tree
        appliedMinimum = Math.max(appliedMinimum, minLargeRemoval);
      }
    }
  }

  // Ensure minimum
  if (totalAmount < appliedMinimum && lineItems.length > 0) {
    const diff = appliedMinimum - totalAmount;
    lineItems[0].unit_price += diff;
    lineItems[0].total += diff;
    totalAmount = appliedMinimum;
  }

  return { lineItems, totalAmount };
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

    // Load CompanySettings for pricing
    const settingsArr = await base44.asServiceRole.entities.CompanySettings.list();
    const s = settingsArr[0] || {};
    const expiryDays = s.quote_expiration_days || 30;

    let extracted;

    // If we already have structured analysis from the public estimate AI, use it directly
    if (structured_analysis && (structured_analysis.estimated_height_ft_high || structured_analysis.detected_species)) {
      const avgHeight = ((structured_analysis.estimated_height_ft_low || 0) + (structured_analysis.estimated_height_ft_high || 0)) / 2 || null;
      const avgDiameter = ((structured_analysis.estimated_dbh_inches_low || 0) + (structured_analysis.estimated_dbh_inches_high || 0)) / 2 || null;
      const service = structured_analysis.recommended_service || 
        (structured_analysis.risk_level === 'extreme' || structured_analysis.risk_level === 'high' ? 'removal' : 'removal');
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
          hazards: structured_analysis.hazards_detected || '',
          location_notes: structured_analysis.access_difficulty || '',
        }],
        urgency: structured_analysis.urgency_level || 'normal',
        overall_notes: structured_analysis.ai_reasoning_summary || structured_analysis.condition_summary || '',
        customer_name_from_chat: customer_name || '',
        address_from_chat: '',
        scope_summary: structured_analysis.recommended_service || 'Tree removal',
      };
    } else {
      // Step 1: AI extraction of structured tree data from text
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

    if (trees.length > 0) {
      // Use CompanySettings pricing engine
      const result = buildPricingFromSettings(trees, extracted, s);
      lineItems = result.lineItems;
      totalAmount = result.totalAmount;
    } else {
      // Fallback: AI-generated line items with CompanySettings context
      const fallback = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate a tree service quote based on this assessment. Create realistic line items.
Minimum job price: $${s.minimum_job_price || 150}
Labor rate: $${s.crew_hourly_rate || 65}/hr
Service type: ${service_type || 'general tree service'}
Assessment: ${assessment_text.slice(0, 2000)}`,
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

    // Build quote metadata
    const quoteNumber = `Q-${Date.now().toString(36).toUpperCase()}`;
    const resolvedCustomerName = customer_name || extracted.customer_name_from_chat || 'Property Owner';
    const notes = [
      extracted.overall_notes,
      extracted.address_from_chat ? `Property: ${extracted.address_from_chat}` : null,
      '*Preliminary estimate. Final pricing confirmed after on-site assessment by a certified arborist.',
    ].filter(Boolean).join('\n\n');

    const validUntil = new Date(Date.now() + expiryDays * 86400000).toISOString().split('T')[0];

    // Resolve ai_analysis_id from structured_analysis if not explicitly passed
    const resolvedAnalysisId = ai_analysis_id || structured_analysis?.id || '';

    // Create Quote
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
      notes,
      valid_until: validUntil,
    });

    // Create QuoteVersion v1 automatically
    await base44.asServiceRole.entities.QuoteVersion.create({
      quote_id: quote.id,
      version_number: 1,
      line_items: lineItems,
      subtotal: totalAmount,
      discount_amount: 0,
      tax_amount: 0,
      total: totalAmount,
      changed_by: 'AI Assessment',
      change_reason: 'Auto-generated from AI analysis',
      status_at_save: 'draft',
    });

    // ActivityLog
    await base44.asServiceRole.entities.ActivityLog.create({
      related_type: 'Quote',
      related_id: quote.id,
      actor: user.full_name || user.email || 'staff',
      action: `Quote ${quoteNumber} generated from AI assessment`,
      notes: `${trees.length} tree(s) assessed · $${totalAmount.toLocaleString()}`,
    });

    // Update AIAnalysisRecord if linked
    if (resolvedAnalysisId) {
      await base44.asServiceRole.entities.AIAnalysisRecord.update(resolvedAnalysisId, { quote_id: quote.id }).catch(() => {});
    }

    return Response.json({
      quote,
      trees_assessed: trees.length,
      line_items: lineItems,
      total_amount: totalAmount,
      pricing_source: 'company_settings',
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});