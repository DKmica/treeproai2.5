import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Sparkles, Plus, Trash2, CheckCircle2, Loader2,
  Eye, Send, FileText, DollarSign, ChevronDown, ChevronUp
} from "lucide-react";
import { convertQuoteToJob, logActivity, logAudit, createPortalLink } from "@/lib/treeproWorkflow";
import SalesQuotePresentation from "./SalesQuotePresentation";

const LINE_ITEM_PRESETS = [
  { description: "Tree Removal", unit_price: 1500 },
  { description: "Tree Trimming / Pruning", unit_price: 450 },
  { description: "Stump Grinding", unit_price: 250 },
  { description: "Brush Cleanup", unit_price: 200 },
  { description: "Log Removal / Haul-Away", unit_price: 350 },
  { description: "Crane / Lift Equipment", unit_price: 1500 },
  { description: "Bucket Truck", unit_price: 800 },
  { description: "Emergency Surcharge", unit_price: 500 },
  { description: "Debris Disposal", unit_price: 175 },
  { description: "Permit / Utility Coordination", unit_price: 300 },
];

const PACKAGE_TIERS = {
  basic: { label: "Basic", description: "Removal only, customer handles cleanup" },
  full_cleanup: { label: "Full Cleanup", description: "Removal + all debris removed" },
  complete: { label: "Complete Package", description: "Full removal + stump grinding + complete cleanup" },
};

export default function SalesQuoteBuilder({ lead, aiRecord, onBack, onQuoteCreated, user }) {
  const [lineItems, setLineItems] = useState(() => {
    if (!aiRecord) return [{ description: "Tree Removal", quantity: 1, unit_price: 1500, total: 1500 }];
    const items = [];
    const price = aiRecord.price_low || 1500;
    items.push({ description: `Tree Removal – ${aiRecord.detected_species || "Tree"}${aiRecord.estimated_height_ft_high ? ` (~${aiRecord.estimated_height_ft_high}ft)` : ""}`, quantity: 1, unit_price: price, total: price });
    if (aiRecord.crane_required || aiRecord.crane_likely) {
      items.push({ description: "Crane / Lift Equipment", quantity: 1, unit_price: 1500, total: 1500 });
    }
    if (aiRecord.stump_grinding_likely) {
      items.push({ description: "Stump Grinding", quantity: 1, unit_price: 250, total: 250 });
    }
    items.push({ description: "Debris Cleanup & Disposal", quantity: 1, unit_price: 200, total: 200 });
    return items;
  });

  const [notes, setNotes] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedQuote, setSavedQuote] = useState(null);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [generating, setGenerating] = useState(false);

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

  const addPreset = (preset) => {
    setLineItems(prev => [...prev, { ...preset, quantity: 1, total: preset.unit_price }]);
    setShowPresets(false);
    toast.success(`Added: ${preset.description}`);
  };

  const applyPackage = (tier) => {
    setSelectedPackage(tier);
    const base = aiRecord?.price_low || 1500;
    if (tier === "basic") {
      setLineItems([{ description: `Tree Removal – ${aiRecord?.detected_species || "Tree"}`, quantity: 1, unit_price: base, total: base }]);
    } else if (tier === "full_cleanup") {
      const items = [
        { description: `Tree Removal – ${aiRecord?.detected_species || "Tree"}`, quantity: 1, unit_price: base, total: base },
        { description: "Brush & Debris Cleanup", quantity: 1, unit_price: 200, total: 200 },
        { description: "Log Haul-Away", quantity: 1, unit_price: 300, total: 300 },
      ];
      if (aiRecord?.crane_required) items.push({ description: "Crane Equipment", quantity: 1, unit_price: 1500, total: 1500 });
      setLineItems(items);
    } else if (tier === "complete") {
      const items = [
        { description: `Tree Removal – ${aiRecord?.detected_species || "Tree"}`, quantity: 1, unit_price: base, total: base },
        { description: "Stump Grinding & Root Flare", quantity: 1, unit_price: 275, total: 275 },
        { description: "Complete Site Cleanup", quantity: 1, unit_price: 250, total: 250 },
        { description: "Log & Debris Haul-Away", quantity: 1, unit_price: 350, total: 350 },
      ];
      if (aiRecord?.crane_required) items.push({ description: "Crane Equipment", quantity: 1, unit_price: 1500, total: 1500 });
      setLineItems(items);
    }
  };

  const saveQuote = async (presentAfter = false) => {
    if (lineItems.length === 0) { toast.error("Add at least one line item"); return; }
    if (discountTooHigh && !discountReason) { toast.error("Reason required for large discount"); return; }
    setSaving(true);

    const qNumber = `Q-${Date.now().toString(36).toUpperCase()}`;
    const validUntil = new Date(Date.now() + (settings.quote_expiration_days || 30) * 86400000).toISOString().split("T")[0];

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
      change_reason: "Initial field quote",
      status_at_save: "draft",
    });

    await base44.entities.Lead.update(lead.id, { status: "quoted" }).catch(() => {});

    await logActivity({
      relatedType: "Quote", relatedId: quote.id,
      actor: user?.full_name || "salesperson",
      action: `Field quote created: ${qNumber}`,
      notes: `${lead.first_name} ${lead.last_name} · $${total.toLocaleString()}`,
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
        {/* AI Context */}
        {aiRecord?.price_low && (
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 text-sm">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted-foreground">AI range: </span>
            <span className="font-semibold text-primary">${aiRecord.price_low.toLocaleString()} – ${aiRecord.price_high?.toLocaleString()}</span>
            {aiRecord.confidence_score && <Badge className="ml-auto text-xs bg-primary/10 text-primary">{aiRecord.confidence_score}% conf.</Badge>}
          </div>
        )}

        {/* Package Selector */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Quick Packages</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(PACKAGE_TIERS).map(([key, pkg]) => (
              <button
                key={key}
                onClick={() => applyPackage(key)}
                className={`p-2.5 rounded-xl border-2 text-left transition-all ${selectedPackage === key ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"}`}
              >
                <p className="text-xs font-bold">{pkg.label}</p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{pkg.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</p>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowPresets(!showPresets)}>
              <Plus className="w-3 h-3" /> Add Item
            </Button>
          </div>

          {showPresets && (
            <Card className="mb-2 overflow-hidden">
              <CardContent className="p-0">
                {LINE_ITEM_PRESETS.map(preset => (
                  <button
                    key={preset.description}
                    onClick={() => addPreset(preset)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted border-b last:border-0 text-left"
                  >
                    <span>{preset.description}</span>
                    <span className="text-muted-foreground">${preset.unit_price.toLocaleString()}</span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setLineItems(p => [...p, { description: "", quantity: 1, unit_price: 0, total: 0 }]);
                    setShowPresets(false);
                  }}
                  className="w-full px-3 py-2.5 text-sm text-primary hover:bg-muted text-left"
                >
                  + Custom line item
                </button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {lineItems.map((item, idx) => (
              <Card key={idx} className="p-3">
                <div className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={item.description}
                      onChange={e => updateItem(idx, "description", e.target.value)}
                      placeholder="Description"
                      className="text-sm h-9"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Qty</p>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(idx, "quantity", e.target.value)}
                          className="text-sm h-9"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Price</p>
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={e => updateItem(idx, "unit_price", e.target.value)}
                          className="text-sm h-9"
                        />
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
        </div>

        {/* Subtotal / Discount */}
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
        <Button
          className="w-full h-12 text-base gap-2"
          disabled={saving}
          onClick={() => saveQuote(true)}
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
          Save & Present to Customer
        </Button>
        <Button
          variant="outline"
          className="w-full h-11 gap-2"
          disabled={saving}
          onClick={() => saveQuote(false)}
        >
          <FileText className="w-4 h-4" /> Save Draft
        </Button>
      </div>
    </div>
  );
}