/**
 * analyzeEstimateAccuracy
 * 
 * Reads all EstimateAccuracy records + CompanySettings and uses the LLM
 * to identify patterns: which job types are under/over-estimated, 
 * which species/complexity combos run over budget, crew efficiency, etc.
 * Returns structured AI insights + recommended pricing adjustments.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Load all accuracy records
    const records = await base44.asServiceRole.entities.EstimateAccuracy.list('-recorded_at', 200);
    
    if (records.length === 0) {
      return Response.json({
        insights: [],
        summary: "No completed job data yet. Complete and invoice jobs to start building the feedback loop.",
        data_points: 0,
        recommendations: []
      });
    }

    // Load company settings
    const settingsArr = await base44.asServiceRole.entities.CompanySettings.list();
    const s = settingsArr[0] || {};

    // Compute basic stats ourselves to feed to AI
    const withAccuracy = records.filter(r => r.accuracy_pct !== null && r.accuracy_pct !== undefined);
    const avgAccuracy = withAccuracy.length > 0 
      ? withAccuracy.reduce((sum, r) => sum + r.accuracy_pct, 0) / withAccuracy.length
      : 0;

    const underEstimated = records.filter(r => r.accuracy_pct < -10);
    const overEstimated = records.filter(r => r.accuracy_pct > 15);

    // Group by species
    const speciesMap = {};
    records.forEach(r => {
      if (!r.species) return;
      const key = r.species.toLowerCase();
      if (!speciesMap[key]) speciesMap[key] = { count: 0, totalAccuracy: 0 };
      speciesMap[key].count++;
      speciesMap[key].totalAccuracy += (r.accuracy_pct || 0);
    });
    const speciesStats = Object.entries(speciesMap).map(([species, data]) => ({
      species,
      count: data.count,
      avg_accuracy_pct: Math.round(data.totalAccuracy / data.count)
    }));

    // Group by complexity tier
    const complexityMap = {};
    records.forEach(r => {
      if (!r.complexity_tier) return;
      const key = r.complexity_tier;
      if (!complexityMap[key]) complexityMap[key] = { count: 0, totalAccuracy: 0 };
      complexityMap[key].count++;
      complexityMap[key].totalAccuracy += (r.accuracy_pct || 0);
    });
    const complexityStats = Object.entries(complexityMap).map(([tier, data]) => ({
      tier,
      count: data.count,
      avg_accuracy_pct: Math.round(data.totalAccuracy / data.count)
    }));

    // Build data summary for AI
    const dataSummary = {
      total_jobs: records.length,
      avg_accuracy_pct: Math.round(avgAccuracy),
      under_estimated_count: underEstimated.length,
      over_estimated_count: overEstimated.length,
      species_breakdown: speciesStats,
      complexity_breakdown: complexityStats,
      crane_jobs: records.filter(r => r.crane_used).length,
      crane_accuracy: records.filter(r => r.crane_used && r.accuracy_pct !== undefined).length > 0
        ? Math.round(records.filter(r => r.crane_used).reduce((s, r) => s + (r.accuracy_pct || 0), 0) / records.filter(r => r.crane_used).length)
        : null,
      recent_jobs: records.slice(0, 10).map(r => ({
        species: r.species,
        risk_level: r.risk_level,
        complexity_tier: r.complexity_tier,
        quoted: r.quoted_price,
        actual: r.actual_invoiced,
        accuracy_pct: r.accuracy_pct,
        crane_used: r.crane_used,
        height_ft: r.height_ft_avg,
        service_type: r.service_type
      })),
      current_settings: {
        minimum_job_price: s.minimum_job_price,
        minimum_large_removal_price: s.minimum_large_removal_price,
        minimum_high_risk_removal_price: s.minimum_high_risk_removal_price,
        minimum_extreme_removal_price: s.minimum_extreme_removal_price,
        minimum_crane_removal_price: s.minimum_crane_removal_price,
        crew_hourly_rate: s.crew_hourly_rate,
        profit_margin_percent: s.profit_margin_percent,
        risk_markup_percent: s.risk_markup_percent,
        emergency_markup_percent: s.emergency_markup_percent
      }
    };

    // AI analysis
    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a tree service business analyst reviewing actual job performance data to improve future estimates.

Here is the historical job accuracy data:
${JSON.stringify(dataSummary, null, 2)}

Accuracy % definition: positive = over-estimated (quoted more than actual cost), negative = under-estimated (quoted less than actual, margin risk).

Analyze the data and provide:
1. Key patterns — which job types, species, or risk levels are consistently under or over-estimated
2. Pricing floor recommendations — which current minimums should be raised or lowered based on actual outcomes
3. Markup recommendations — should risk/emergency markups be adjusted?
4. Operational insights — any crew efficiency or cost patterns to address
5. Specific actionable recommendations for the company settings

Be specific and data-driven. Reference actual numbers from the data.`,
      model: "claude_sonnet_4_6",
      response_json_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          overall_accuracy_assessment: { type: "string" },
          insights: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string" },
                finding: { type: "string" },
                severity: { type: "string" },
                data_points: { type: "number" }
              }
            }
          },
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                setting: { type: "string" },
                current_value: { type: "number" },
                recommended_value: { type: "number" },
                reason: { type: "string" },
                priority: { type: "string" }
              }
            }
          },
          risk_flags: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    });

    // Log this analysis run
    await base44.asServiceRole.entities.ActivityLog.create({
      related_type: "EstimateAccuracy",
      related_id: "system",
      actor: user.full_name || user.email || "staff",
      action: `AI accuracy analysis run on ${records.length} jobs`,
      notes: `Avg accuracy: ${Math.round(avgAccuracy)}% | Under-estimated: ${underEstimated.length} | Over-estimated: ${overEstimated.length}`
    });

    return Response.json({
      ...aiResult,
      data_points: records.length,
      raw_stats: {
        avg_accuracy_pct: Math.round(avgAccuracy),
        under_estimated_count: underEstimated.length,
        over_estimated_count: overEstimated.length,
        species_breakdown: speciesStats,
        complexity_breakdown: complexityStats
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});