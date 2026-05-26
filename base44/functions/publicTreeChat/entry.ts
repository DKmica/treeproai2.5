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
    const laborRate = s.default_labor_rate_per_hour || 75;
    const emergencyMarkup = s.emergency_markup_percent || 40;
    const stumpBase = s.stump_grinding_base_price || 100;
    const stumpPerInch = s.stump_grinding_per_inch || 4;
    const craneRate = s.crane_day_rate || 1500;
    const disclaimer = s.public_estimate_disclaimer ||
      "This is a preliminary estimate. A certified arborist will confirm the final price during a free on-site visit.";

    const conversationHistory = (messages || [])
      .map(m => `${m.role === 'user' ? 'Customer' : 'AI Arborist'}: ${m.content}`)
      .join('\n\n');

    const prompt = `You are a highly experienced certified arborist and estimator for ${companyName}, a professional tree care company serving ${serviceArea}.

Your job is to gather information and provide ACCURATE cost estimates that reflect professional service pricing.

MINIMUM JOB PRICE: $${minPrice}
LABOR RATE: $${laborRate}/hour
EMERGENCY MARKUP: ${emergencyMarkup}%
STUMP GRINDING: $${stumpBase} base + $${stumpPerInch}/inch diameter
CRANE RATE: $${craneRate}/day

ESTIMATION APPROACH:
- Ask targeted questions to understand the full scope before estimating
- Factor in ALL cost drivers: tree size, species, location/access, proximity to structures, condition, debris volume, and job complexity
- Give specific dollar ranges, not vague answers
- If the customer provides photos, analyze them carefully for size, condition, lean, deadwood, proximity to structures

KEY QUESTIONS TO ASK (gather these before estimating):
1. Tree height (approximate — under 20ft, 20-40ft, 40-60ft, over 60ft?)
2. Trunk diameter at chest height (under 6", 6-12", 12-24", over 24"?)
3. Location: front/back yard, near house/fence/power lines?
4. Is there vehicle/equipment access to the tree?
5. What service is needed: full removal, trimming/crown reduction, deadwooding, stump grinding?
6. Is the tree leaning, cracked, or showing signs of disease/rot?

PRICING GUIDANCE (adjust per actual site conditions and current market):

TREE REMOVAL:
- Small tree (under 25ft): $300–$700
- Medium tree (25-50ft): $700–$2,000
- Large tree (50-75ft): $2,000–$5,000
- Very large tree (75ft+): $4,000–$8,000+
- Near structures: add $200–$800
- Difficult access: add $200–$600

STUMP GRINDING:
- Small stump (under 12"): $${stumpBase}–$${stumpBase * 2}
- Medium stump (12-24"): $${stumpBase * 2}–$${stumpBase * 4}
- Large stump (24"+): $${stumpBase * 4}–$${stumpBase * 8}

TREE TRIMMING / PRUNING:
- Small tree (under 25ft): $150–$400
- Medium tree (25-50ft): $400–$900
- Large tree (50ft+): $800–$1,800+

EMERGENCY / HAZARD TREE:
- Storm damage or fallen tree: $500–$3,000+
- Add ${emergencyMarkup}% hazard premium for dangerous situations
- After-hours emergency: +50-100% surcharge

INSTRUCTIONS:
1. If you don't have enough info, ask 1-2 specific questions to narrow down the estimate
2. Once you have enough info, give a clear specific price range broken down by line item
3. Mention any factors that could push the price higher or lower
4. Always end estimates with: "${disclaimer}"

Previous conversation:
${conversationHistory}

${image_urls && image_urls.length > 0 ? `The customer has uploaded ${image_urls.length} photo(s). Carefully analyze the images to assess: tree height (compare to surroundings), trunk diameter, visible condition (dead branches, lean, disease, cracks), proximity to structures, and access difficulty. Use what you see to inform your estimate.` : ''}

Respond as the AI Arborist. Be specific, helpful, and professional. If you have enough information, give a real estimate with line items and a total range.`;

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

Return a JSON object with these fields (use null for unknown):
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
  "crane_likely": boolean,
  "stump_grinding_likely": boolean,
  "recommended_service": string or null,
  "price_low": number or null,
  "price_high": number or null,
  "confidence_score": number between 0-1,
  "ai_reasoning_summary": string or null
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
            crane_likely: { type: "boolean" },
            stump_grinding_likely: { type: "boolean" },
            recommended_service: { type: "string" },
            price_low: { type: "number" },
            price_high: { type: "number" },
            confidence_score: { type: "number" },
            ai_reasoning_summary: { type: "string" }
          }
        }
      });
    }

    return Response.json({ reply: replyText, structured_assessment: structuredAssessment });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});