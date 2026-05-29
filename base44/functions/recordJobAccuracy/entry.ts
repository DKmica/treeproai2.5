/**
 * recordJobAccuracy
 * 
 * Called when a job is marked paid/completed with an invoice.
 * Pulls quote estimate vs actual invoiced amount and saves an EstimateAccuracy record.
 * Also pulls AI analysis data (species, risk, crane, etc.) for the feedback loop.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id } = await req.json();
    if (!job_id) return Response.json({ error: 'job_id required' }, { status: 400 });

    // Load job
    const jobs = await base44.asServiceRole.entities.Job.filter({ id: job_id });
    const job = jobs[0];
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

    // Check if already recorded
    const existing = await base44.asServiceRole.entities.EstimateAccuracy.filter({ job_id });
    if (existing.length > 0) {
      return Response.json({ message: 'Already recorded', record: existing[0] });
    }

    // Load quote if linked
    let quote = null;
    if (job.quote_id) {
      const quotes = await base44.asServiceRole.entities.Quote.filter({ id: job.quote_id });
      quote = quotes[0] || null;
    }

    // Load AI analysis if linked
    let aiRecord = null;
    if (job.ai_analysis_id || quote?.ai_analysis_id) {
      const analysisId = job.ai_analysis_id || quote.ai_analysis_id;
      const analyses = await base44.asServiceRole.entities.AIAnalysisRecord.filter({ id: analysisId });
      aiRecord = analyses[0] || null;
    }

    // Load invoice to get actual amount
    let actualInvoiced = job.total_cost || null;
    if (job.invoice_id) {
      const invoices = await base44.asServiceRole.entities.Invoice.filter({ id: job.invoice_id });
      const invoice = invoices[0];
      if (invoice) actualInvoiced = invoice.total || invoice.amount || actualInvoiced;
    }

    const quotedPrice = quote?.total_amount || null;
    const estimatedLow = aiRecord?.price_low || null;
    const estimatedHigh = aiRecord?.price_high || null;

    // Accuracy: (quoted - actual) / actual * 100
    // Positive = over-estimated, negative = under-estimated
    let accuracyPct = null;
    if (quotedPrice && actualInvoiced && actualInvoiced > 0) {
      accuracyPct = Math.round(((quotedPrice - actualInvoiced) / actualInvoiced) * 100);
    }

    // Compute dump expense total
    const dumpExpense = (job.dump_expense_chips || 0) + (job.dump_expense_wood || 0) + (job.dump_expense_total || 0);

    // Build record
    const record = await base44.asServiceRole.entities.EstimateAccuracy.create({
      job_id,
      quote_id: job.quote_id || null,
      ai_analysis_id: job.ai_analysis_id || quote?.ai_analysis_id || null,
      customer_name: job.customer_name || null,
      species: aiRecord?.detected_species || null,
      risk_level: aiRecord?.risk_level || job.risk_level || null,
      complexity_tier: aiRecord?.complexity_tier || null,
      crane_used: job.crane_required || aiRecord?.crane_required || false,
      structures_nearby: aiRecord?.structures_nearby || false,
      estimated_price_low: estimatedLow,
      estimated_price_high: estimatedHigh,
      quoted_price: quotedPrice,
      actual_invoiced: actualInvoiced,
      actual_labor_hours: job.actual_duration_hours || null,
      dump_expense_actual: dumpExpense || null,
      accuracy_pct: accuracyPct,
      service_type: aiRecord?.recommended_service || job.description?.split(' ')[0] || null,
      height_ft_avg: aiRecord ? ((aiRecord.estimated_height_ft_low || 0) + (aiRecord.estimated_height_ft_high || 0)) / 2 || null : null,
      dbh_inches_avg: aiRecord ? ((aiRecord.estimated_dbh_inches_low || 0) + (aiRecord.estimated_dbh_inches_high || 0)) / 2 || null : null,
      recorded_at: new Date().toISOString()
    });

    await base44.asServiceRole.entities.ActivityLog.create({
      related_type: 'Job',
      related_id: job_id,
      actor: user.full_name || user.email || 'system',
      action: `Estimate accuracy recorded`,
      notes: accuracyPct !== null
        ? `Quoted $${quotedPrice?.toLocaleString()} vs Actual $${actualInvoiced?.toLocaleString()} (${accuracyPct > 0 ? '+' : ''}${accuracyPct}%)`
        : 'Accuracy recorded (missing quote or invoice data)'
    });

    return Response.json({ record, accuracy_pct: accuracyPct });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});