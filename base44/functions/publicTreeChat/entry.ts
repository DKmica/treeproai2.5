import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { messages, image_urls } = await req.json();

    // Load company settings for dynamic branding and pricing
    let s = {};
    try {
      const settingsArr = await base44.asServiceRole.entities.CompanySettings.list();
      s = settingsArr[0] || {};
    } catch (e) {
      // If service role fails, provide defaults
      console.error("Failed to load CompanySettings:", e.message);
    }

    const companyName = s.company_name || "Professional Tree Service";
    const serviceArea = s.service_area_description || "our local service area";
    const minPrice = s.minimum_job_price || 150;
    const minLargeRemoval = s.minimum_large_removal_price || 4500;
    const minHighRisk = s.minimum_high_risk_removal_price || 6500;
    const minExtreme = s.minimum_extreme_removal_price || 8500;
    const minCrane = s.minimum_crane_removal_price || 10500;
    const maxLowConfidenceRange = s.max_low_confidence_range_percent || 40;
    const maxHighConfidenceRange = s.max_high_confidence_range_percent || 25;
    const laborRate = s.default_labor_rate_per_hour || 75;
    const emergencyMarkup = s.emergency_markup_percent || 40;
    const stumpBase = s.stump_grinding_base_price || 100;
    const stumpPerInch = s.stump_grinding_per_inch || 4;
    const craneRate = s.crane_day_rate || 1500;
    const denseWoodMarkup = s.oak_dense_wood_markup_percent || 15;
    const structureMarkup = s.structure_overhang_markup_percent || 20;
    const dropZoneMarkup = s.limited_drop_zone_markup_percent || 15;
    const riggingMarkup = s.advanced_rigging_markup_percent || 20;
    const craneMarkup = s.crane_required_markup_percent || 30;
    const disclaimer = s.public_estimate_disclaimer ||
      "This is a preliminary estimate. A certified arborist will confirm the final price during a free on-site visit.";

    const conversationHistory = (messages || [])
      .map(m => `${m.role === 'user' ? 'Customer' : 'AI Arborist'}: ${m.content}`)
      .join('\n\n');

    const prompt = `You are a highly experienced certified arborist and estimator for ${companyName}, a professional tree care company serving ${serviceArea}.

Your job is to gather information and provide ACCURATE cost estimates that reflect professional service pricing for real tree removal operations.

=== CRITICAL PRICING RULES ===
DO NOT underestimate large, high-risk, or complex removals. Apply minimum price floors strictly:
- Minimum for 50-70 ft removals: $${minLargeRemoval}
- Minimum for high-risk removals (near structures): $${minHighRisk}
- Minimum for extreme complexity (70+ ft, 36"+ DBH, near/over structures): $${minExtreme}
- Minimum when crane is likely/required: $${minCrane}

RANGE WIDTH RULES:
- Confidence >= 70%: max range width 20-25%
- Confidence 50-69%: max range width 25-35%
- Confidence < 50%: ask for more photos/details instead of giving huge ranges

SCENARIO PRICING (do not lump everything into one broad range):
For large or complex trees, separate scenarios:
1. Without crane (advanced rigging): [lower range]
2. If crane required: [higher range]
3. Optional stump grinding: +[amount]
4. Total estimates with/without crane

SPECIES & COMPLEXITY ADJUSTMENTS:
- Oak/Pin Oak/Hickory/Sycamore/Maple (70+ ft, 36"+ DBH): dense wood, heavy, difficult rigging
  Apply ${denseWoodMarkup}% markup for weight and handling
- Canopy over roof/between structures: +${structureMarkup}% (property damage risk, careful placement)
- Limited drop zone: +${dropZoneMarkup}% (requires careful limbing, smaller pieces)
- Advanced rigging required (climbing, rigging systems): +${riggingMarkup}%
- Crane required: +${craneMarkup}%

=== EXAMPLE: 70-80 ft Oak Between Two Houses ===
If you encounter this profile:
- 70-80 ft tall oak/pin oak
- 36-48"+ DBH (dense hardwood)
- Between two houses, canopy over roofs
- Limited drop zone
- Driveway access good
- Technical rigging/crane likely

Estimate breakdown:
Advanced Rigging Removal: $${minExtreme}-$${Math.round(minExtreme * 1.25)} (covers heavy wood, careful work)
If Crane Required: $${minCrane}-$${Math.round(minCrane * 1.25)}
Optional Stump Grinding (+$${Math.round(stumpBase + stumpPerInch * 42)}-$${Math.round(stumpBase + stumpPerInch * 48)})
Total estimate: $${minExtreme + Math.round(stumpBase + stumpPerInch * 42)}-$${Math.round((minExtreme * 1.25) + (stumpBase + stumpPerInch * 48))} with stump, without crane
Or: $${minCrane + Math.round(stumpBase + stumpPerInch * 42)}-$${Math.round((minCrane * 1.25) + (stumpBase + stumpPerInch * 48))} with stump and crane

=== GENERAL PRICING FRAMEWORK ===
SMALL REMOVAL (under 25 ft): $${minPrice}-$1200
MEDIUM REMOVAL (25-50 ft): $1200-$3500
LARGE REMOVAL (50-70 ft, good access): $${minLargeRemoval}-$6500
HIGH-RISK REMOVAL (structures nearby): minimum $${minHighRisk}
EXTREME COMPLEXITY (70+ ft, 36"+ DBH, near/over structures): minimum $${minExtreme}, with crane $${minCrane}+

STUMP GRINDING:
- Small (under 12"): $${stumpBase}-$${Math.round(stumpBase * 1.5)}
- Medium (12-24"): $${Math.round(stumpBase * 1.5)}-$${Math.round(stumpBase * 3)}
- Large (24-36"): $${Math.round(stumpBase * 3)}-$${Math.round(stumpBase * 5)}
- Very large (36"+): $${Math.round(stumpBase * 5)}-$${Math.round(stumpBase * 8)}

=== KEY ASSESSMENT QUESTIONS ===
1. Tree height? (under 25ft, 25-50ft, 50-70ft, 70-90ft, 90ft+)
2. Trunk diameter at chest height? (under 12", 12-24", 24-36", 36"+)
3. Species? (oak, elm, maple, pine, other?)
4. Location? (front yard, back yard, between structures, over roof/driveway?)
5. Obstacles? (power lines, fences, buildings, limited drop zone?)
6. Access? (wide driveway, narrow gate, no truck access?)
7. Service needed? (full removal, trimming, deadwooding, stump grinding, cleanup?)
8. Urgency? (routine, within 1-2 weeks, emergency?)

=== INSTRUCTIONS ===
1. Ask 1-2 specific questions if missing critical info
2. Once you have enough info, give SCENARIO-BASED pricing, never one giant range
3. Always separate "without crane" vs "if crane required" scenarios
4. Apply minimum price floors without exception
5. Keep range width tight (20-25% for high confidence, 25-35% for medium)
6. Always mention: "${disclaimer}"
7. Be professional, specific, and realistic about technical complexity

Previous conversation:
${conversationHistory}

${image_urls && image_urls.length > 0 ? `The customer has uploaded ${image_urls.length} photo(s). Analyze for: height (compare to structures), trunk diameter, species visual cues (bark texture, branching), lean/deadwood/disease, proximity to buildings/power lines, drop zone size, and access. Use observations to inform complexity assessment.` : ''}

Respond as the AI Arborist. If you have enough information for an estimate, provide SCENARIO-BASED pricing with clear separation of base removal, crane scenarios, and optional services.`;

    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: "gemini_3_1_pro",
      add_context_from_internet: true,
      ...(image_urls && image_urls.length > 0 && { file_urls: image_urls }),
    });

    // If it looks like a final estimate has been given, extract structured data
    let structuredAssessment = null;
    const replyText = typeof response === "string" ? response : JSON.stringify(response);
    const hasPriceRange = /\$[\d,]+\s*[–\-–to]+\s*\$[\d,]+/i.test(replyText);
    if (hasPriceRange && messages && messages.length >= 3) {
      const structurePrompt = `Based on this tree assessment conversation, extract structured data as JSON:
---
${replyText}
---

Return a comprehensive JSON object (use null for unknown, false for boolean unknowns):
{
  "detected_species": string or null,
  "estimated_height_ft_low": number or null,
  "estimated_height_ft_high": number or null,
  "estimated_dbh_inches_low": number or null,
  "estimated_dbh_inches_high": number or null,
  "condition_summary": string or null,
  "hazards_detected": string or null,
  "access_difficulty": "easy"|"moderate"|"difficult"|"very_difficult"|null,
  "risk_level": "low"|"moderate"|"high"|"extreme"|null,
  "urgency_level": "low"|"normal"|"high"|"emergency"|null,
  "structures_nearby": boolean,
  "canopy_over_structure": boolean,
  "limited_drop_zone": boolean,
  "crane_likely": boolean,
  "crane_required": boolean,
  "bucket_truck_likely": boolean,
  "climbing_required": boolean,
  "stump_grinding_likely": boolean,
  "recommended_service": string or null,
  "price_low": number or null,
  "price_high": number or null,
  "no_crane_price_low": number or null,
  "no_crane_price_high": number or null,
  "crane_required_price_low": number or null,
  "crane_required_price_high": number or null,
  "stump_price_low": number or null,
  "stump_price_high": number or null,
  "confidence_score": number between 0-100,
  "ai_reasoning_summary": string or null,
  "pricing_scenarios": object describing scenario breakdown
}`;
      structuredAssessment = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: structurePrompt,
        response_json_schema: {
          type: "object",
          properties: {
            detected_species: { type: "string" },
            estimated_height_ft_low: { type: "number" },
            estimated_height_ft_high: { type: "number" },
            estimated_dbh_inches_low: { type: "number" },
            estimated_dbh_inches_high: { type: "number" },
            condition_summary: { type: "string" },
            hazards_detected: { type: "string" },
            access_difficulty: { type: "string" },
            risk_level: { type: "string" },
            urgency_level: { type: "string" },
            structures_nearby: { type: "boolean" },
            canopy_over_structure: { type: "boolean" },
            limited_drop_zone: { type: "boolean" },
            crane_likely: { type: "boolean" },
            crane_required: { type: "boolean" },
            bucket_truck_likely: { type: "boolean" },
            climbing_required: { type: "boolean" },
            stump_grinding_likely: { type: "boolean" },
            recommended_service: { type: "string" },
            price_low: { type: "number" },
            price_high: { type: "number" },
            no_crane_price_low: { type: "number" },
            no_crane_price_high: { type: "number" },
            crane_required_price_low: { type: "number" },
            crane_required_price_high: { type: "number" },
            stump_price_low: { type: "number" },
            stump_price_high: { type: "number" },
            confidence_score: { type: "number" },
            ai_reasoning_summary: { type: "string" },
            pricing_scenarios: { type: "object" }
          }
        }
      });
    }

    return Response.json({ reply: replyText, structured_assessment: structuredAssessment });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});