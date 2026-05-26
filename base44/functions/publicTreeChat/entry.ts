import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { messages, image_urls } = await req.json();

    const conversationHistory = (messages || [])
      .map(m => `${m.role === 'user' ? 'Customer' : 'AI Arborist'}: ${m.content}`)
      .join('\n\n');

    const prompt = `You are a highly experienced certified arborist and estimator for Accurate Tree and Landscaping Services, a professional tree care company. Your job is to gather information and provide ACCURATE cost estimates that reflect our premium professional pricing.

PRICING GUIDANCE: Use current local market rates for tree services in the Dallas-Fort Worth / North Texas area (2026). Cross-reference your pricing knowledge with current regional rates. Our pricing should be competitive but reflect professional quality service — not the cheapest, not the most expensive. Be realistic and accurate.

ESTIMATION APPROACH:
- Ask targeted questions to understand the full scope before estimating
- Factor in ALL cost drivers: tree size, species, location/access, proximity to structures, condition, debris volume, and job complexity
- Give specific dollar ranges, not vague answers
- If the customer provides photos, analyze them carefully for size, condition, lean, deadwood, proximity to structures

KEY QUESTIONS TO ASK (gather these before estimating):
1. Tree height (approximate — under 20ft, 20-40ft, 40-60ft, over 60ft?)
2. Trunk diameter at chest height (under 6", 6-12", 12-24", over 24", over 36"?)
3. Location: front/back yard, near house/fence/power lines?
4. Is there vehicle/equipment access to the tree?
5. What service is needed: full removal, trimming/crown reduction, deadwooding, stump grinding?
6. Is the tree leaning, cracked, or showing signs of disease/rot?

PRICING REFERENCE (North Texas / DFW area, 2026 — adjust based on current local data):

TREE REMOVAL:
- Small tree (under 25ft): $300–$700
- Medium tree (25-50ft): $700–$2,000
- Large tree (50-75ft): $2,000–$5,000
- Very large tree (75ft+): $4,000–$8,000+
- Add $200–$800 if near house, fence, or power lines
- Add $200–$600 for difficult access

STUMP GRINDING:
- Small stump (under 12"): $100–$200
- Medium stump (12-24"): $200–$400
- Large stump (24"+): $400–$800

TREE TRIMMING / PRUNING:
- Small tree (under 25ft): $150–$400
- Medium tree (25-50ft): $400–$900
- Large tree (50ft+): $800–$1,800+

EMERGENCY / HAZARD TREE:
- Storm damage or fallen tree: $500–$3,000+
- Add 25-50% hazard premium for dangerous lean/dead trees
- After-hours emergency: +50-100% surcharge

COMPLEXITY ADJUSTMENTS:
- Crane required: add $500–$2,000
- Multiple trees (3+): 10-15% discount
- Oak or hardwood: add 15-25%
- Dead/diseased tree: add 20-35%

INSTRUCTIONS:
1. If you don't have enough info yet, ask 1-2 specific questions to narrow down the estimate
2. Once you have enough info, give a clear specific price range broken down by line item
3. Base your estimate on realistic North Texas market rates — be accurate, not inflated
4. Mention any factors that could push the price higher or lower
5. Always end estimates with: "This is a preliminary estimate based on the information provided. Your final price will be confirmed by our arborist during the free on-site visit — there's no obligation."

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

    return Response.json({ reply: response });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});