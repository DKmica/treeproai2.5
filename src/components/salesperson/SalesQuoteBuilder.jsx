import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Sparkles, Plus, Trash2, Loader2,
  Eye, FileText, ChevronDown, ChevronUp, Info, Clock
} from "lucide-react";
import { logActivity } from "@/lib/treeproWorkflow";
import { calculateScenarioPricing } from "@/lib/pricingEngine";

import SalesQuotePresentation from "./SalesQuotePresentation";

const PRICING_DEFAULTS = {
  crewProductionRate: 500,
  chipDumpRate: 120,
  standardWoodDumpRate: 220,
  oversizedWoodDumpRate: 440,
  maxChipLoads: 2,
};

// ── Production Hours Input ───────────────────────────────────────────────────

function ProductionHoursInput({ hours, onChange }) {
  const [useBreakdown, setUseBreakdown] = useState(false);

  const totalFromBreakdown =
    (parseFloat(hours.removalHours) || 0) +
    (parseFloat(hours.groundChippingHours) || 0) +
    (parseFloat(hours.logHandlingHours) || 0) +
    (parseFloat(hours.finalCleanupHours) || 0);

  const handleBreakdownChange = (field, val) => {
    const updated = { ...hours, [field]: parseFloat(val) || 0 };
    const total =
      (updated.removalHours || 0) +
      (updated.groundChippingHours || 0) +
      (updated.logHandlingHours || 0) +
      (updated.finalCleanupHours || 0);
    onChange({ ...updated, totalHours: Math.round(total * 10) / 10 });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <Clock className="w-3 h-3" /> Production Hours
        </p>
        <button
          onClick={() => setUseBreakdown(p => !p)}
          className="text-xs text-primary underline"
        >
          {useBreakdown ? "Use total only" : "Enter breakdown"}
        </button>
      </div>

      {useBreakdown ? (
        <Card className="p-3 space-y-2 bg-muted/30">
          <p className="text-[10px] text-muted-foreground italic">
            All phases = total production labor (cutting, rigging, chipping, log handling, cleanup combined)
          </p>
          {[
            { key: "removalHours", label: "Removal / cutting / rigging" },
            { key: "groundChippingHours", label: "Ground crew / chipping" },
            { key: "logHandlingHours", label: "Log handling / loading" },
            { key: "finalCleanupHours", label: "Final site cleanup" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-44 shrink-0">{label}</span>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={hours[key] ?? ""}
                onChange={e => handleBreakdownChange(key, e.target.value)}
                className="h-8 text-sm w-24"
                placeholder="hrs"
              />
              <span className="text-xs text-muted-foreground">h</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1 border-t">
            <span className="text-xs font-bold">Total production hours</span>
            <span className="text-sm font-bold text-primary">{hours.totalHours || totalFromBreakdown}h</span>
          </div>
        </Card>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min="0"
            step="0.5"
            value={hours.totalHours ?? ""}
            onChange={e => onChange({ ...hours, totalHours: parseFloat(e.target.value) || 0 })}
            className="h-9 text-sm w-32"
            placeholder="e.g. 16"
          />
          <span className="text-sm text-muted-foreground">total hours</span>
        </div>
      )}
    </div>
  );
}

// ── Dump Loads Input ─────────────────────────────────────────────────────────

function DumpLoadsInput({ loads, onChange }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dump Loads</p>
      <Card className="p-3 space-y-2 bg-muted/30">
        <p className="text-[10px] text-muted-foreground italic">
          Chip loads max {PRICING_DEFAULTS.maxChipLoads} · Oversized = logs over 40" diameter
        </p>
        {[
          { key: "chipLoads", label: `Chip loads (max ${PRICING_DEFAULTS.maxChipLoads})`, max: PRICING_DEFAULTS.maxChipLoads, rate: PRICING_DEFAULTS.chipDumpRate },
          { key: "standardWoodLoads", label: "Standard wood loads", rate: PRICING_DEFAULTS.standardWoodDumpRate },
          { key: "oversizedWoodLoads", label: "Oversized log loads (>40\")", rate: PRICING_DEFAULTS.oversizedWoodDumpRate },
        ].map(({ key, label, max, rate }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-44 shrink-0">{label}</span>
            <Input
              type="number"
              min="0"
              max={max}
              step="1"
              value={loads[key] ?? 0}
              onChange={e => onChange({ ...loads, [key]: parseInt(e.target.value) || 0 })}
              className="h-8 text-sm w-16"
            />
            <span className="text-xs text-muted-foreground">${rate}/load</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── Price Calculator ─────────────────────────────────────────────────────────

function PriceCalculator({ aiRecord, settings, onApplyPrice }) {
  if (!aiRecord) return null;
  const pricing = calculateScenarioPricing(aiRecord, settings);
  const low = pricing.no_crane_price_low;
  const high = pricing.no_crane_price_high;
  const mid = Math.round((low + high) / 2 / 50) * 50;

  return (
    <Card className="p-3 bg-primary/5 border-primary/20">
      <p className="text-xs font-bold text-primary mb-2">AI Price Calculation</p>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Est. hours</span>
          <span className="font-medium">{pricing.estimated_hours}h</span>
        </div>
        <div className="flex justify-between">
          <span>Chip loads / Log loads</span>
          <span>{pricing.estimated_chip_loads} / {pricing.estimated_log_loads}</span>
        </div>
        <div className="flex justify-between font-medium border-t pt-1">
          <span>No-crane range</span>
          <span className="text-primary">${low.toLocaleString()} – ${high.toLocaleString()}</span>
        </div>
        {(aiRecord.crane_required || aiRecord.crane_likely) && (
          <div className="flex justify-between">
            <span>Crane range</span>
            <span>${pricing.crane_required_price_low.toLocaleString()} – ${pricing.crane_required_price_high.toLocaleString()}</span>
          </div>
        )}
      </div>
      <Button size="sm" className="w-full mt-2 h-8 text-xs" onClick={() => onApplyPrice(mid, high)}>
        Apply ${mid.toLocaleString()} (midpoint) to quote
      </Button>
    </Card>
  );
}

// ── Stump Grinding Calculator ────────────────────────────────────────────────

const STUMP_TIERS = [
  { label: '6"–12"',  min: 6,  max: 12, low: 75,  high: 150 },
  { label: '13"–24"', min: 13, max: 24, low: 150, high: 300 },
  { label: '25"–36"', min: 25, max: 36, low: 300, high: 500 },
  { label: '37"–48"', min: 37, max: 48, low: 450, high: 750 },
  { label: '49"–60"', min: 49, max: 60, low: 650, high: 1000 },
];

const STUMP_ADDONS = [
  { key: "haul_grindings", label: "Haul away grindings", price: 500 },
  { key: "backfill_seed",  label: "Backfill w/ topsoil + seed & straw", price: 500 },
  { key: "backfill_sod",   label: "Backfill w/ topsoil + sod", price: 2000 },
];

function StumpGrindingBuilder({ onAdd }) {
  const [dbh, setDbh] = useState("");
  const [useHigh, setUseHigh] = useState(false);
  const [addons, setAddons] = useState({});

  const dbhNum = parseFloat(dbh) || 0;
  const tier = dbhNum > 0 ? STUMP_TIERS.find(t => dbhNum >= t.min && dbhNum <= t.max) || (dbhNum > 60 ? { label: '60"+', low: 1000, high: 1500 } : null) : null;
  const basePrice = tier ? (useHigh ? tier.high : tier.low) : 0;
  const addonTotal = STUMP_ADDONS.filter(a => addons[a.key]).reduce((s, a) => s + a.price, 0);
  const totalPrice = basePrice + addonTotal;

  const selectedAddons = STUMP_ADDONS.filter(a => addons[a.key]).map(a => a.label).join("; ");

  const handleAdd = () => {
    if (!tier) { return; }
    const desc = `Stump Grinding (${dbhNum}" DBH)${selectedAddons ? " + " + selectedAddons : ""}`;
    onAdd({ description: desc, quantity: 1, unit_price: totalPrice, total: totalPrice });
  };

  return (
    <Card className="p-3 space-y-3 border-green-200 bg-green-50/50">
      <p className="text-xs font-bold text-green-800">Stump Grinding</p>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Stump diameter / DBH (inches)</label>
        <Input
          type="number"
          placeholder='e.g. 18"'
          value={dbh}
          onChange={e => setDbh(e.target.value)}
          className="h-9 text-sm"
        />
        {tier && (
          <p className="text-xs text-green-700 font-medium">
            Tier: {tier.label} → ${tier.low}–${tier.high}
          </p>
        )}
      </div>
      {tier && (
        <div className="flex gap-2">
          <button
            onClick={() => setUseHigh(false)}
            className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${!useHigh ? "border-green-500 bg-green-100 text-green-800" : "border-border text-muted-foreground"}`}
          >
            Low ${tier.low.toLocaleString()}
          </button>
          <button
            onClick={() => setUseHigh(true)}
            className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${useHigh ? "border-green-500 bg-green-100 text-green-800" : "border-border text-muted-foreground"}`}
          >
            High ${tier.high.toLocaleString()}
          </button>
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">Add-ons</p>
        {STUMP_ADDONS.map(a => (
          <button
            key={a.key}
            onClick={() => setAddons(p => ({ ...p, [a.key]: !p[a.key] }))}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all ${addons[a.key] ? "border-green-500 bg-green-100" : "border-border bg-white"}`}
          >
            <span>{a.label}</span>
            <span className="text-muted-foreground">+${a.price.toLocaleString()}</span>
          </button>
        ))}
      </div>
      {totalPrice > 0 && (
        <Button size="sm" className="w-full bg-green-700 hover:bg-green-800 gap-1" onClick={handleAdd}>
          <Plus className="w-3 h-3" /> Add Stump Grinding — ${totalPrice.toLocaleString()}
        </Button>
      )}
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SalesQuoteBuilder({ lead, aiRecord, onBack, onQuoteCreated, user }) {
  const [lineItems, setLineItems] = useState(() => {
    if (!aiRecord) return [];
    const price = aiRecord.price_low || 0;
    const species = aiRecord.detected_species || "Tree";
    const heightStr = aiRecord.estimated_height_ft_high ? ` (~${aiRecord.estimated_height_ft_high}ft)` : "";
    const items = [
      { description: `${species}${heightStr} — full removal with full cleanup and haul-away`, quantity: 1, unit_price: price, total: price }
    ];
    if (aiRecord.crane_required || aiRecord.crane_likely) {
      items.push({ description: "Crane / Lift Equipment", quantity: 1, unit_price: 1500, total: 1500 });
    }
    return items;
  });
  const [showStumpBuilder, setShowStumpBuilder] = useState(false);

  // Production hours state (pre-filled from AI estimated_hours if available)
  const [productionHours, setProductionHours] = useState(() => {
    const aiHours = aiRecord ? calculateScenarioPricing(aiRecord, {}).estimated_hours : 0;
    return { totalHours: aiHours || 0, removalHours: 0, groundChippingHours: 0, logHandlingHours: 0, finalCleanupHours: 0 };
  });

  // Dump loads state
  const [dumpLoads, setDumpLoads] = useState(() => {
    if (!aiRecord) return { chipLoads: 0, standardWoodLoads: 0, oversizedWoodLoads: 0 };
    const p = calculateScenarioPricing(aiRecord, {});
    return { chipLoads: p.estimated_chip_loads || 0, standardWoodLoads: 0, oversizedWoodLoads: p.estimated_log_loads || 0 };
  });

  const [craneRequired, setCraneRequired] = useState(aiRecord?.crane_required || false);
  const [showCalc, setShowCalc] = useState(false);
  const [notes, setNotes] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedQuote, setSavedQuote] = useState(null);
  const [showPresentation, setShowPresentation] = useState(false);

  const { data: settings = {} } = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => {
      const arr = await base44.entities.CompanySettings.list();
      return arr[0] || {};
    },
  });

  const subtotal = lineItems.reduce((s, i) => s + (i.total || 0), 0);
  const total = Math.max(0, subtotal - (discountAmount || 0));
  const maxDiscountPct = settings.profit_margin_percent || 35;
  const discountPct = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  const discountTooHigh = discountPct > maxDiscountPct;

  const updateItem = (idx, field, val) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: field === "description" ? val : parseFloat(val) || 0 };
      updated.total = (updated.quantity || 1) * (updated.unit_price || 0);
      return updated;
    }));
  };

  const addStumpItem = (item) => {
    setLineItems(prev => [...prev, item]);
    setShowStumpBuilder(false);
    toast.success("Stump grinding added");
  };

  const applyCalculatedPrice = (low, high) => {
    if (lineItems.length === 0) return;
    setLineItems(prev => prev.map((item, i) =>
      i === 0 ? { ...item, unit_price: low, total: (item.quantity || 1) * low } : item
    ));
    toast.success(`Applied $${low.toLocaleString()} to main line item`);
    setShowCalc(false);
  };

  // Build internal breakdown string for company records
  const buildInternalBreakdown = () => {
    const h = productionHours;
    const l = dumpLoads;
    return [
      "=== INTERNAL PRODUCTION BREAKDOWN ===",
      `Removal/cutting/rigging: ${h.removalHours || "?"}h`,
      `Ground crew/chipping: ${h.groundChippingHours || "?"}h`,
      `Log handling/loading: ${h.logHandlingHours || "?"}h`,
      `Final site cleanup: ${h.finalCleanupHours || "?"}h`,
      `TOTAL production hours: ${h.totalHours || "?"}h`,
      `Chip loads: ${l.chipLoads} (max ${PRICING_DEFAULTS.maxChipLoads}) @ $${PRICING_DEFAULTS.chipDumpRate}/load`,
      `Standard wood loads: ${l.standardWoodLoads} @ $${PRICING_DEFAULTS.standardWoodDumpRate}/load`,
      `Oversized wood loads (>40"): ${l.oversizedWoodLoads} @ $${PRICING_DEFAULTS.oversizedWoodDumpRate}/load`,
      `Crane required: ${craneRequired ? "Yes" : "No"}`,
    ].join("\n");
  };

  const saveQuote = async (presentAfter = false) => {
    if (lineItems.length === 0) { toast.error("Add at least one line item"); return; }
    if (discountTooHigh && !discountReason) { toast.error("Reason required for large discount"); return; }
    setSaving(true);

    const qNumber = `Q-${Date.now().toString(36).toUpperCase()}`;
    const validUntil = new Date(Date.now() + (settings.quote_expiration_days || 30) * 86400000).toISOString().split("T")[0];
    const internalBreakdown = buildInternalBreakdown();

    const quote = await base44.entities.Quote.create({
      quote_number: qNumber,
      customer_id: lead.customer_id || "",
      customer_name: `${lead.first_name} ${lead.last_name}`,
      customer_phone: lead.phone || "",
      customer_email: lead.email || "",
      customer_address: lead.address || "",
      lead_id: lead.id,
      ai_analysis_id: aiRecord?.id || lead.ai_analysis_id || "",
      status: "draft",
      line_items: lineItems,
      subtotal,
      discount_amount: discountAmount || 0,
      total_amount: total,
      ai_generated: !!aiRecord,
      notes: [notes, discountReason ? `Discount reason: ${discountReason}` : null].filter(Boolean).join("\n"),
      internal_notes: internalBreakdown,
      scope_of_work: lineItems.map(i => i.description).join(", "),
      valid_until: validUntil,
    });

    await base44.entities.QuoteVersion.create({
      quote_id: quote.id,
      version_number: 1,
      line_items: lineItems,
      subtotal,
      discount_amount: discountAmount || 0,
      tax_amount: 0,
      total,
      changed_by: user?.full_name || "salesperson",
      change_reason: "Initial field quote — production-labor formula",
      status_at_save: "draft",
    });

    await base44.entities.Lead.update(lead.id, { status: "quoted" }).catch(() => {});

    await logActivity({
      relatedType: "Quote", relatedId: quote.id,
      actor: user?.full_name || "salesperson",
      action: `Field quote created: ${qNumber}`,
      notes: `${lead.first_name} ${lead.last_name} · $${total.toLocaleString()} · ${productionHours.totalHours}h production`,
    });

    setSaving(false);
    setSavedQuote(quote);
    toast.success(`Quote #${qNumber} created!`);
    if (presentAfter) setShowPresentation(true);
    else onQuoteCreated?.();
  };

  if (showPresentation && savedQuote) {
    return (
      <SalesQuotePresentation
        quote={savedQuote}
        lead={lead}
        lineItems={lineItems}
        total={total}
        aiRecord={aiRecord}
        onBack={() => setShowPresentation(false)}
        onApproved={onQuoteCreated}
        user={user}
      />
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b sticky top-0 bg-background z-10">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h2 className="font-bold">Quote Builder</h2>
          <p className="text-xs text-muted-foreground">{lead.first_name} {lead.last_name}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">${total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">
        {/* AI Price Range */}
        {aiRecord?.price_low && (
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 text-sm">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted-foreground">AI range: </span>
            <span className="font-semibold text-primary">${aiRecord.price_low.toLocaleString()} – ${aiRecord.price_high?.toLocaleString()}</span>
            {aiRecord.confidence_score && <Badge className="ml-auto text-xs bg-primary/10 text-primary">{aiRecord.confidence_score}% conf.</Badge>}
          </div>
        )}

        {/* Production Hours */}
        <ProductionHoursInput hours={productionHours} onChange={setProductionHours} />

        {/* Dump Loads */}
        <DumpLoadsInput loads={dumpLoads} onChange={setDumpLoads} />

        {/* Crane toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCraneRequired(p => !p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${craneRequired ? "bg-amber-100 border-amber-400 text-amber-700" : "border-border text-muted-foreground"}`}
          >
            🏗️ Crane Required: {craneRequired ? "Yes" : "No"}
          </button>
        </div>

        {/* Price Calculator */}
        <div>
          <button
            onClick={() => setShowCalc(p => !p)}
            className="flex items-center gap-1 text-xs text-primary underline"
          >
            {showCalc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showCalc ? "Hide" : "Show"} production price calculator
          </button>
          {showCalc && (
            <div className="mt-2">
              <PriceCalculator
                aiRecord={aiRecord}
                settings={settings}
                onApplyPrice={applyCalculatedPrice}
              />
            </div>
          )}
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer Quote Line Items</p>
              <p className="text-[10px] text-muted-foreground">Customer sees these — keep descriptions clear and simple</p>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            {lineItems.map((item, idx) => (
              <Card key={idx} className="p-3">
                <div className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={item.description}
                      onChange={e => updateItem(idx, "description", e.target.value)}
                      placeholder="Description (e.g. Large oak removal with full cleanup)"
                      className="text-sm h-9"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Qty</p>
                        <Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="text-sm h-9" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Price</p>
                        <Input type="number" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", e.target.value)} className="text-sm h-9" />
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Total</p>
                        <p className="text-sm font-bold pt-2">${(item.total || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 mt-1 text-destructive" onClick={() => setLineItems(p => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Add buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setLineItems(p => [...p, { description: "", quantity: 1, unit_price: 0, total: 0 }])}
            >
              <Plus className="w-3 h-3" /> Custom Line Item
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1 border-green-400 text-green-700 hover:bg-green-50"
              onClick={() => setShowStumpBuilder(p => !p)}
            >
              🌳 {showStumpBuilder ? "Hide" : "Add"} Stump Grinding
            </Button>
          </div>

          {showStumpBuilder && (
            <div className="mt-3">
              <StumpGrindingBuilder onAdd={addStumpItem} />
            </div>
          )}
        </div>

        {/* Discount */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${subtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Discount $"
              value={discountAmount || ""}
              onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
              className="h-9 text-sm"
            />
            {discountAmount > 0 && (
              <span className={`text-xs font-medium ${discountTooHigh ? "text-red-600" : "text-muted-foreground"}`}>
                {discountPct.toFixed(0)}%
              </span>
            )}
          </div>
          {discountTooHigh && (
            <Input
              placeholder="Reason required for this discount..."
              value={discountReason}
              onChange={e => setDiscountReason(e.target.value)}
              className="h-9 text-sm border-red-300"
            />
          )}
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>Total</span>
            <span className="text-primary">${total.toLocaleString()}</span>
          </div>
        </div>

        {/* Internal summary */}
        {productionHours.totalHours > 0 && (
          <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground space-y-0.5">
            <p className="font-semibold text-foreground mb-1 flex items-center gap-1"><Info className="w-3 h-3" /> Internal record (not shown to customer)</p>
            <p>Total production hours: <strong>{productionHours.totalHours}h</strong> (cutting + rigging + chipping + log handling + cleanup)</p>
            <p>Chip loads: {dumpLoads.chipLoads} · Standard wood: {dumpLoads.standardWoodLoads} · Oversized wood: {dumpLoads.oversizedWoodLoads}</p>
          </div>
        )}

        <Textarea
          placeholder="Notes for the customer..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="text-sm"
        />
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-background space-y-2">
        <Button className="w-full h-12 text-base gap-2" disabled={saving} onClick={() => saveQuote(true)}>
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
          Save & Present to Customer
        </Button>
        <Button variant="outline" className="w-full h-11 gap-2" disabled={saving} onClick={() => saveQuote(false)}>
          <FileText className="w-4 h-4" /> Save Draft
        </Button>
      </div>
    </div>
  );
}