import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { messages, image_urls } = await req.json();

    const conversationHistory = (messages || [])
      .map(m => `${m.role === 'user' ? 'Customer' : 'AI Arborist'}: ${m.content}`)
      .join('\n\n');

    const prompt = `You are an expert AI arborist for Accurate Tree and Landscaping Services. You help property owners assess their trees and get free cost estimates.

Your role:
- Ask about the tree(s): species, size (height/trunk diameter), location, and condition
- If photos are provided, analyze them for visible issues (dead branches, disease, structural problems, lean, cracks)
- Assess health, safety risks, and urgency
- Provide a detailed but friendly assessment
- Give a realistic cost estimate range for the recommended service(s)

Pricing guide (use these ranges):
- Tree trimming/pruning: $150–$800 depending on size
- Tree removal (small <30ft): $300–$700
- Tree removal (medium 30–60ft): $700–$1,500
- Tree removal (large >60ft): $1,500–$3,500
- Stump grinding: $100–$400
- Emergency service (hazardous): add 25–50% urgency surcharge
- Lot clearing: $1,000–$5,000+

Always end with: "This is a preliminary estimate. A certified arborist will confirm the exact price during your free on-site visit."

Previous conversation:
${conversationHistory}

${image_urls && image_urls.length > 0 ? `The customer has uploaded ${image_urls.length} photo(s) of their tree(s). Please analyze them.` : ''}

Respond as the AI Arborist in a helpful, professional, and friendly tone. Be specific and detailed.`;

    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      ...(image_urls && image_urls.length > 0 && { file_urls: image_urls }),
    });

    return Response.json({ reply: response });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});