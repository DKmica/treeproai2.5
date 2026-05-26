import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Accept lead data from any external source (web forms, Zapier, webhooks, etc.)
    const {
      first_name, last_name, email, phone, address,
      description, source = "form", urgency = "normal",
      // allow raw fields from generic form submissions
      name, message, service_type,
    } = body;

    // Parse name if first/last not split
    let fname = first_name;
    let lname = last_name || "";
    if (!fname && name) {
      const parts = name.trim().split(" ");
      fname = parts[0];
      lname = parts.slice(1).join(" ") || "";
    }
    if (!fname) {
      return Response.json({ error: "first_name or name is required" }, { status: 400 });
    }

    const desc = description || message || service_type || "";

    // 1. Get active salespersons
    const salespersons = await base44.asServiceRole.entities.Salesperson.filter({ status: "active" });

    // 2. AI: analyze lead and pick best salesperson
    let aiScore = null;
    let aiNotes = null;
    let assignedTo = null;
    let assignedToId = null;
    let detectedUrgency = urgency;

    if (salespersons.length > 0 || desc) {
      const salesList = salespersons.map((s, i) =>
        `${i + 1}. ${s.name} (id: ${s.id}, territory: ${s.territory || "any"}, specialties: ${(s.specialties || []).join(", ") || "general"}, current_leads: ${s.current_lead_count || 0}/${s.max_leads || 10})`
      ).join("\n");

      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a lead routing AI for a tree service company.

Analyze this incoming lead and:
1. Score it 0-100 (urgency, revenue potential, conversion likelihood)
2. Detect urgency level: low, normal, high, or emergency
3. Assign to the best available salesperson based on their territory, specialties, and current workload
4. Write brief notes explaining the assessment

Lead info:
- Name: ${fname} ${lname}
- Phone: ${phone || "not provided"}
- Email: ${email || "not provided"}
- Address: ${address || "not provided"}
- Description: ${desc || "not provided"}
- Source: ${source}
- Stated urgency: ${urgency}

Available salespersons:
${salesList || "No salespersons configured yet"}

Respond with JSON only.`,
        response_json_schema: {
          type: "object",
          properties: {
            score: { type: "number" },
            urgency: { type: "string" },
            notes: { type: "string" },
            assigned_salesperson_id: { type: "string" },
            assigned_salesperson_name: { type: "string" },
          },
        },
      });

      aiScore = aiResult.score;
      aiNotes = aiResult.notes;
      detectedUrgency = aiResult.urgency || urgency;
      assignedTo = aiResult.assigned_salesperson_name || null;
      assignedToId = aiResult.assigned_salesperson_id || null;
    }

    // 3. Create the lead record
    const lead = await base44.asServiceRole.entities.Lead.create({
      first_name: fname,
      last_name: lname,
      email: email || "",
      phone: phone || "",
      address: address || "",
      description: desc,
      source,
      urgency: detectedUrgency,
      status: "new",
      ai_score: aiScore,
      ai_notes: aiNotes,
      assigned_to: assignedTo,
      assigned_to_id: assignedToId,
    });

    // 4. Update salesperson lead count
    if (assignedToId) {
      const sp = salespersons.find((s) => s.id === assignedToId);
      if (sp) {
        await base44.asServiceRole.entities.Salesperson.update(assignedToId, {
          current_lead_count: (sp.current_lead_count || 0) + 1,
        });
      }
    }

    return Response.json({
      success: true,
      lead_id: lead.id,
      assigned_to: assignedTo,
      ai_score: aiScore,
      urgency: detectedUrgency,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});