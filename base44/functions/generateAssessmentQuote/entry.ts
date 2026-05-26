import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Pricing matrix based on tree height and risk level
const PRICING = {
  removal: {
    // [heightFt]: base price
    small: { min: 0, max: 25, low: 650, moderate: 850, high: 1200, extreme: 1800 },
    medium: { min: 25, max: 50, low: 1200, moderate: 1600, high: 2400, extreme: 3500 },
    large: { min: 50, max: 75, low: 2200, moderate: 2800, high: 3800, extreme: 5200 },
    xlarge: { min: 75, max: 999, low: 3500, moderate: 4500, high: 6000, extreme: 8500 },
  },
  trimming: {
    small: { low: 200, moderate: 250, high: 350, extreme: 500 },
    medium: { low: 350, moderate: 450, high: 650, extreme: 900 },
    large: { low: 600, moderate: 750, high: 1000, extreme: 1400 },
    xlarge: { low: 900, moderate: 1200, high: 1600, extreme: 2200 },
  },
  stumpGrinding: { small: 175, medium: 275, large: 400, xlarge: 550 },
  craneRental: 800,
  debrisHauling: { small: 150, medium: 250, large: 350, xlarge: 450 },
  emergencySurcharge: 0.40, // 40% surcharge for extreme risk
};

function getSizeCategory(heightFt) {
  if (!heightFt || heightFt < 25) return 'small';
  if (heightFt < 50) return 'medium';
  if (heightFt < 75) return 'large';
  return 'xlarge';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assessment_text, customer_name, customer_id, service_type } = await req.json();

    if (!assessment_text) {
      return Response.json({ error: 'assessment_text is required' }, { status: 400 });
    }

    // Step 1: Use AI to extract structured data from the assessment conversation
    const extracted = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extract tree assessment details from this conversation/assessment text. 
If multiple trees are mentioned, extract data for each one.

Assessment text:
${assessment_text}

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
                height_ft: { type: "number", description: "Estimated height in feet. Use 0 if unknown." },
                diameter_in: { type: "number", description: "Trunk diameter in inches. Use 0 if unknown." },
                condition: { type: "string", enum: ["excellent", "good", "fair", "poor", "dead"] },
                risk_level: { type: "string", enum: ["low", "moderate", "high", "extreme"] },
                recommended_service: { type: "string", enum: ["removal", "trimming", "pruning", "stump_grinding", "emergency_removal"] },
                needs_crane: { type: "boolean" },
                needs_stump_grinding: { type: "boolean" },
                hazards: { type: "string", description: "Key hazards identified" },
                location_notes: { type: "string", description: "Location details, proximity to structures" }
              }
            }
          },
          urgency: { type: "string", enum: ["low", "normal", "high", "emergency"] },
          overall_notes: { type: "string", description: "Professional summary of the assessment for the quote" },
          customer_name_from_chat: { type: "string", description: "Customer name if mentioned in the conversation" },
          address_from_chat: { type: "string", description: "Property address if mentioned" }
        }
      }
    });

    const trees = extracted.trees || [];
    const lineItems = [];
    let totalAmount = 0;

    for (const tree of trees) {
      const size = getSizeCategory(tree.height_ft);
      const risk = tree.risk_level || 'low';
      const isEmergency = tree.risk_level === 'extreme' || extracted.urgency === 'emergency';

      const treeLabel = tree.species && tree.species !== 'Unknown' 
        ? `${tree.species} tree` 
        : `Tree`;
      const sizeLabel = tree.height_ft ? ` (~${tree.height_ft}ft)` : '';

      if (tree.recommended_service === 'removal' || tree.recommended_service === 'emergency_removal') {
        let price = PRICING.removal[size][risk] || PRICING.removal[size].low;
        if (isEmergency) price = Math.round(price * (1 + PRICING.emergencySurcharge));
        lineItems.push({
          description: `${tree.recommended_service === 'emergency_removal' ? 'Emergency ' : ''}Tree Removal – ${treeLabel}${sizeLabel}`,
          quantity: 1,
          unit_price: price,
          total: price
        });
        totalAmount += price;

        // Add crane if needed
        if (tree.needs_crane || tree.height_ft > 60) {
          lineItems.push({
            description: 'Crane Rental & Operation',
            quantity: 1,
            unit_price: PRICING.craneRental,
            total: PRICING.craneRental
          });
          totalAmount += PRICING.craneRental;
        }

        // Add stump grinding
        if (tree.needs_stump_grinding !== false) {
          const stumpPrice = PRICING.stumpGrinding[size];
          lineItems.push({
            description: `Stump Grinding & Root Flare Removal`,
            quantity: 1,
            unit_price: stumpPrice,
            total: stumpPrice
          });
          totalAmount += stumpPrice;
        }

        // Debris hauling
        const debrisPrice = PRICING.debrisHauling[size];
        lineItems.push({
          description: 'Debris Removal & Site Cleanup',
          quantity: 1,
          unit_price: debrisPrice,
          total: debrisPrice
        });
        totalAmount += debrisPrice;

      } else if (tree.recommended_service === 'trimming' || tree.recommended_service === 'pruning') {
        let price = PRICING.trimming[size][risk] || PRICING.trimming[size].low;
        if (isEmergency) price = Math.round(price * (1 + PRICING.emergencySurcharge));
        lineItems.push({
          description: `Tree Trimming & Crown Maintenance – ${treeLabel}${sizeLabel}`,
          quantity: 1,
          unit_price: price,
          total: price
        });
        totalAmount += price;

        const debrisPrice = Math.round(PRICING.debrisHauling[size] * 0.6);
        lineItems.push({
          description: 'Debris Cleanup & Hauling',
          quantity: 1,
          unit_price: debrisPrice,
          total: debrisPrice
        });
        totalAmount += debrisPrice;

      } else if (tree.recommended_service === 'stump_grinding') {
        const stumpPrice = PRICING.stumpGrinding[size];
        lineItems.push({
          description: `Stump Grinding – ${treeLabel}${sizeLabel}`,
          quantity: 1,
          unit_price: stumpPrice,
          total: stumpPrice
        });
        totalAmount += stumpPrice;
      }
    }

    // If no trees parsed, fall back to generic AI generation
    if (lineItems.length === 0) {
      const fallback = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Generate a tree service quote based on this assessment. Create realistic line items with fair market prices.
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
      lineItems.push(...(fallback.line_items || []));
      totalAmount = lineItems.reduce((s, i) => s + (i.total || 0), 0);
    }

    // Save to Quote entity
    const quoteNumber = `Q-${Date.now().toString(36).toUpperCase()}`;
    const resolvedCustomerName = customer_name || extracted.customer_name_from_chat || 'Property Owner';
    
    const notesArr = [];
    if (extracted.overall_notes) notesArr.push(extracted.overall_notes);
    if (extracted.address_from_chat) notesArr.push(`Property: ${extracted.address_from_chat}`);
    notesArr.push('*This is a preliminary estimate. Final pricing confirmed after on-site assessment by a certified arborist.');

    const quote = await base44.asServiceRole.entities.Quote.create({
      quote_number: quoteNumber,
      customer_id: customer_id || '',
      customer_name: resolvedCustomerName,
      status: 'draft',
      line_items: lineItems,
      total_amount: totalAmount,
      ai_generated: true,
      ai_analysis: JSON.stringify({ trees, urgency: extracted.urgency }),
      notes: notesArr.join('\n\n'),
    });

    return Response.json({
      quote,
      trees_assessed: trees.length,
      line_items: lineItems,
      total_amount: totalAmount,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});