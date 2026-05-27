import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { buildLineItemsFromAnalysis, calculateScenarioPricing, calculateComplexity, calculateQuoteTotals } from "@/lib/pricingEngine";
import { saveQuoteVersion, logActivity, logAudit, createNotification } from "@/lib/treeproWorkflow";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2, TreePine, AlertTriangle, CheckCircle2, Sparkles,
  DollarSign, ChevronDown, ChevronUp, Info
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const RISK_COLORS = { low: "text-green-600", moderate: "text-yellow-600", high: "text-orange-600", extreme: "text-red-600" };
const TIER_BG = { low: "bg-green-100 text-green-700", moderate: "bg-yellow-100 text-yellow-700", high: "bg-orange-100 text-orange-700", extreme: "bg-red-100 text-red-700" };

function ScenarioCard({ title, low, high, recommended, selected, onSelect, warnings = [], optional, description }) {
  return (
    <div
      onClick={onSelect}
      className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{title}</span>
            {recommended && <Badge className="bg-primary/10 text-primary text-xs">Recommended</Badge>}
            {optional && <Badge variant="outline" className="text-xs">Optional</Badge>}
          </div>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          {warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-1 text-xs text-orange-700 mt-1">
              <AlertTriangle className="w-3 h-3 shrink-0" /> {w}
            </div>
          ))}
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-green-700">${low?.toLocaleString()}–${high?.toLocaleString()}</p>
          {selected && <CheckCircle2 className="w-4 h-4 text-primary ml-auto mt-1" />}
        </div>
      </div>
    </div>
  );
}

export default function AIQuoteBuilder({ record, open, onOpenChange, onQuoteCreated }) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Options state
  const [scenario, setScenario] = useState("no_crane");
  const [includeStump, setIncludeStump] = useState(false);
  const [includeHaulaway, setIncludeHaulaway] = useState(true);
  const [includeCrane, setIncludeCrane] = useState(false);
  const [manualAdjust, setManualAdjust] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [action, setAction] = useState("draft");
  const [pricing, setPricing] = useState(null);

  useEffect(() => {
    if (!open || !record) return;
    base44.entities.CompanySettings.list().then(arr => {
      const s = arr[0] || {};
      setSettings(s);
      setLoadingSettings(false);
      const p = calculateScenarioPricing(record, s);
      setPricing(p);
      // Smart defaults
      setIncludeStump(!!record.stump_grinding_likely);
      setScenario(record.crane_required ? "crane" : "no_crane");
      setIncludeCrane(!!record.crane_likely && !record.crane_required);
    });
  }, [open, record]);

  if (!record) return null;

  const { score, tier } = calculateComplexity(record, settings);
  const craneWarnings = [];
  if (record.canopy_over_structure) craneWarnings.push("Canopy overhangs structure — increased risk");
  if (record.limited_drop_zone) craneWarnings.push("Limited drop zone — careful rigging required");

  const builtPricing = pricing ? buildLineItemsFromAnalysis(record, settings, { includeCrane, includeStump, scenario }) : null;
  const lineItems = builtPricing?.lineItems || [];
  const { subtotal, total } = calculateQuoteTotals(lineItems, 0, 0);
  const finalTotal = manualAdjust ? Math.max(0, parseFloat(manualAdjust) || total) : total;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const expiryDate = new Date(Date.now() + (settings.quote_expiration_days || 30) * 86400000).toISOString().split("T")[0];
      const adjustedLineItems = manualAdjust
        ? lineItems.map((li, i) => i === 0 ? { ...li, unit_price: finalTotal - (total - li.total), total: finalTotal - (total - li.total) } : li)
        : lineItems;

      const isNeedsReview = record.confidence_score < 50 || action === "needs_review";

      const quote = await base44.entities.Quote.create({
        quote_number: `Q-${Date.now().toString(36).toUpperCase()}`,
        customer_id: record.customer_id || "",
        lead_id: record.lead_id || "",
        ai_analysis_id: record.id,
        line_items: adjustedLineItems,
        subtotal: adjustedLineItems.reduce((s, i) => s + i.total, 0),
        total_amount: finalTotal,
        ai_generated: true,
        ai_analysis: record.ai_reasoning_summary || record.condition_summary || "",
        scope_of_work: record.recommended_service || "Tree Service",
        risk_level: record.risk_level || undefined,
        crane_required: record.crane_required || (scenario === "crane"),
        estimated_duration_hours: record.estimated_height_ft_high > 50 ? 8 : 4,
        required_crew_size: tier === "extreme" ? 4 : tier === "high" ? 3 : 2,
        status: isNeedsReview ? "needs_review" : action === "send" ? "sent" : "draft",
        valid_until: expiryDate,
        access_notes: record.access_difficulty ? `Access: ${record.access_difficulty}` : "",
        notes: customerNotes || undefined,
        internal_notes: internalNotes || undefined,
      });

      await saveQuoteVersion({ ...quote, id: quote.id }, [], "AI Quote Builder", `Scenario: ${scenario} | Stump: ${includeStump}`);
      await base44.entities.AIAnalysisRecord.update(record.id, { quote_id: quote.id }).catch(() => {});

      if (record.lead_id) {
        await base44.entities.Lead.update(record.lead_id, { status: action === "send" ? "quoted" : "qualified" }).catch(() => {});
      }

      await logActivity({ relatedType: "Quote", relatedId: quote.id, actor: "staff", action: "Quote built from AI Quote Builder", notes: `$${finalTotal.toLocaleString()} · ${scenario} · stump: ${includeStump}` });
      await logAudit({ actorName: "staff", action: "quote_generated_from_ai_builder", entityType: "Quote", entityId: quote.id, newValue: { total: finalTotal, scenario, analysis_id: record.id } });

      if (isNeedsReview) {
        await createNotification({ type: "ai_review_needed", title: "Quote needs review (low confidence)", message: `$${finalTotal.toLocaleString()} for ${record.recommended_service || "tree service"}`, relatedType: "Quote", relatedId: quote.id });
      }

      toast.success("Quote created successfully!");
      onOpenChange(false);
      onQuoteCreated?.(quote.id);
      navigate(`/quotes/${quote.id}`);
    } catch (err) {
      toast.error("Failed to create quote: " + err.message);
    }
    setGenerating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> AI Quote Builder
          </DialogTitle>
        </DialogHeader>

        {loadingSettings ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="space-y-5">
            {/* 1. AI Summary */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TreePine className="w-4 h-4" /> AI Assessment Summary</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {record.detected_species && <div><span className="text-muted-foreground">Species: </span><span className="font-medium">{record.detected_species}</span></div>}
                  {record.estimated_height_ft_high && <div><span className="text-muted-foreground">Height: </span><span className="font-medium">{record.estimated_height_ft_low}–{record.estimated_height_ft_high} ft</span></div>}
                  {record.estimated_dbh_inches_high && <div><span className="text-muted-foreground">DBH: </span><span className="font-medium">{record.estimated_dbh_inches_low}–{record.estimated_dbh_inches_high}"</span></div>}
                  {record.risk_level && <div><span className="text-muted-foreground">Risk: </span><span className={`font-medium capitalize ${RISK_COLORS[record.risk_level]}`}>{record.risk_level}</span></div>}
                  {record.access_difficulty && <div><span className="text-muted-foreground">Access: </span><span className="font-medium capitalize">{record.access_difficulty}</span></div>}
                  {record.confidence_score && <div><span className="text-muted-foreground">Confidence: </span><span className={`font-medium ${record.confidence_score < 50 ? "text-orange-600" : "text-green-600"}`}>{Math.round(record.confidence_score)}%</span></div>}
                </div>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <Badge className={TIER_BG[tier]}>{tier} complexity ({Math.round(score)}/100)</Badge>
                  {record.crane_required && <Badge className="bg-red-100 text-red-700">Crane Required</Badge>}
                  {record.crane_likely && !record.crane_required && <Badge className="bg-orange-100 text-orange-700">Crane Likely</Badge>}
                  {record.canopy_over_structure && <Badge className="bg-orange-100 text-orange-700">Roof Overhang</Badge>}
                  {record.limited_drop_zone && <Badge className="bg-yellow-100 text-yellow-700">Limited Drop Zone</Badge>}
                </div>
                {record.hazards_detected && (
                  <div className="flex items-start gap-1.5 text-xs text-orange-700 bg-orange-50 rounded p-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {record.hazards_detected}
                  </div>
                )}
                {record.missing_info_questions && (
                  <div className="flex items-start gap-1.5 text-xs text-blue-700 bg-blue-50 rounded p-2">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Missing info: {record.missing_info_questions}
                  </div>
                )}
                {record.confidence_score < 50 && (
                  <p className="text-xs text-orange-600 font-medium">⚠ Low confidence — quote will be marked "Needs Review"</p>
                )}
              </CardContent>
            </Card>

            {/* 2. Scenario Selection */}
            {pricing && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Select Pricing Scenario</Label>
                <ScenarioCard
                  title="Advanced Rigging Removal (No Crane)"
                  low={pricing.no_crane_price_low}
                  high={pricing.no_crane_price_high}
                  recommended={!record.crane_required}
                  selected={scenario === "no_crane"}
                  onSelect={() => setScenario("no_crane")}
                  warnings={craneWarnings}
                  description="Expert climbers use rigging systems to dismantle piece-by-piece"
                />
                <ScenarioCard
                  title="Crane-Assisted Removal"
                  low={pricing.crane_required_price_low}
                  high={pricing.crane_required_price_high}
                  recommended={!!(record.crane_required || record.crane_likely)}
                  selected={scenario === "crane"}
                  onSelect={() => setScenario("crane")}
                  description="Crane lifts sections away from structures — safest for rooftop overhangs"
                />
              </div>
            )}

            {/* 3. Options */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Quote Options</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "includeStump", label: `Add Stump Grinding (+$${pricing ? Math.round((pricing.stump_price_low + pricing.stump_price_high) / 2).toLocaleString() : "—"})`, value: includeStump, set: setIncludeStump, recommended: !!record.stump_grinding_likely },
                    { key: "includeHaulaway", label: "Include Debris Haul-Away", value: includeHaulaway, set: setIncludeHaulaway },
                    { key: "includeCrane", label: "Add Crane Line Item (separate)", value: includeCrane, set: setIncludeCrane },
                  ].map(({ key, label, value, set, recommended }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={value} onChange={e => set(e.target.checked)} className="rounded" />
                      <span>{label}</span>
                      {recommended && <Badge className="bg-primary/10 text-primary text-[10px]">Recommended</Badge>}
                    </label>
                  ))}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Manual Price Override (leave blank to use calculated)</Label>
                  <Input type="number" placeholder={`Calculated: $${total.toLocaleString()}`} value={manualAdjust} onChange={e => setManualAdjust(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Customer-Facing Notes</Label>
                  <Textarea rows={2} value={customerNotes} onChange={e => setCustomerNotes(e.target.value)} placeholder="Additional notes for the customer..." className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Internal Notes (staff only)</Label>
                  <Textarea rows={2} value={internalNotes} onChange={e => setInternalNotes(e.target.value)} placeholder="Notes for your team (not shown to customer)..." className="mt-1" />
                </div>
              </CardContent>
            </Card>

            {/* 4. Preview */}
            <Card>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowPreview(v => !v)}>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2"><DollarSign className="w-4 h-4" /> Quote Preview</span>
                  {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </CardTitle>
              </CardHeader>
              {showPreview && (
                <CardContent className="space-y-2 text-sm">
                  {lineItems.map((li, i) => (
                    <div key={i} className="flex justify-between items-center border-b pb-1.5 last:border-0">
                      <span>{li.description}</span>
                      <span className="font-medium">${(li.total || 0).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span>Total</span>
                    <span className="text-green-700">${finalTotal.toLocaleString()}</span>
                  </div>
                  {pricing && (
                    <p className="text-xs text-muted-foreground">Pricing floor: ${pricing.pricing_floor?.toLocaleString()} · Complexity: {tier} ({Math.round(score)}/100)</p>
                  )}
                </CardContent>
              )}
              {!showPreview && (
                <CardContent className="pt-0">
                  <div className="flex justify-between font-bold text-base">
                    <span className="text-muted-foreground text-sm">Estimated Total</span>
                    <span className="text-green-700 text-lg">${finalTotal.toLocaleString()}</span>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* 5. Actions */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Quote Action</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { value: "draft", label: "Save as Draft", desc: "Review before sending" },
                  { value: "needs_review", label: "Mark Needs Review", desc: "Flag for estimator" },
                  { value: "send", label: "Mark as Sent", desc: "Ready for customer" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setAction(opt.value)}
                    className={`border-2 rounded-lg p-3 text-left transition-all ${action === opt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                  >
                    <p className="font-medium text-sm">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleGenerate} disabled={generating} className="flex-1 gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Generating..." : "Generate Quote"}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}