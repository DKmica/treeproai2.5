import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { buildLineItemsFromAnalysis, saveQuoteVersion, logActivity, createNotification } from "@/lib/treeproWorkflow";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  ScanSearch, Search, Loader2, CheckCircle2, AlertCircle, Clock,
  XCircle, Eye, TreePine, DollarSign, Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  reviewed: "bg-blue-100 text-blue-700 border-blue-200",
  corrected: "bg-purple-100 text-purple-700 border-purple-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_ICONS = {
  pending: Clock,
  reviewed: CheckCircle2,
  corrected: AlertCircle,
  rejected: XCircle,
};

const RISK_COLORS = {
  low: "text-green-600", moderate: "text-yellow-600", high: "text-orange-600", extreme: "text-red-600",
};

function ReviewDialog({ record, onClose, onSave }) {
  const [form, setForm] = useState({
    human_review_status: record.human_review_status || "reviewed",
    human_final_price: record.human_final_price || record.price_high || "",
    human_corrections: record.human_corrections || "",
    reviewed_by: record.reviewed_by || "",
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review AI Analysis</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">AI Price Range</span>
              <span className="font-semibold">${record.price_low?.toLocaleString() || "—"} – ${record.price_high?.toLocaleString() || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confidence</span>
              <span>{record.confidence_score ? `${Math.round(record.confidence_score * 100)}%` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Risk Level</span>
              <span className={`capitalize font-medium ${RISK_COLORS[record.risk_level] || ""}`}>{record.risk_level || "—"}</span>
            </div>
          </div>

          {record.ai_reasoning_summary && (
            <div>
              <Label className="text-xs">AI Reasoning</Label>
              <p className="text-sm text-muted-foreground mt-1 bg-muted rounded p-2">{record.ai_reasoning_summary}</p>
            </div>
          )}

          <div className="space-y-1">
            <Label>Review Status</Label>
            <select
              className="w-full border rounded-md h-9 px-3 text-sm bg-background"
              value={form.human_review_status}
              onChange={set("human_review_status")}
            >
              <option value="reviewed">Reviewed — Looks Good</option>
              <option value="corrected">Corrected — Price Adjusted</option>
              <option value="rejected">Rejected — Invalid Analysis</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Final Price Override ($)</Label>
            <Input type="number" value={form.human_final_price} onChange={set("human_final_price")} placeholder="Leave blank to use AI range" />
          </div>

          <div className="space-y-1">
            <Label>Corrections / Notes</Label>
            <Textarea value={form.human_corrections} onChange={set("human_corrections")} placeholder="What was wrong or adjusted?" rows={3} />
          </div>

          <div className="space-y-1">
            <Label>Reviewed By</Label>
            <Input value={form.reviewed_by} onChange={set("reviewed_by")} placeholder="Your name" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ ...form, reviewed_at: new Date().toISOString() })}>Save Review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AIAnalysis() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [generatingQuote, setGeneratingQuote] = useState(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["ai_analysis"],
    queryFn: () => base44.entities.AIAnalysisRecord.list("-created_date"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AIAnalysisRecord.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai_analysis"] }); setReviewing(null); toast.success("Review saved"); },
    onError: () => toast.error("Failed to save review"),
  });

  const filtered = records.filter(r =>
    (r.recommended_service || "").toLowerCase().includes(search.toLowerCase()) ||
    (r.detected_species || "").toLowerCase().includes(search.toLowerCase())
  );

  const pending = records.filter(r => r.human_review_status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ScanSearch className="w-6 h-6 text-primary" /> AI Analysis Records
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Review and approve AI-generated tree assessments.</p>
        </div>
        {pending > 0 && (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1 px-3 py-1.5">
            <Clock className="w-3.5 h-3.5" /> {pending} Pending Review
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", count: records.length, color: "bg-blue-100 text-blue-700" },
          { label: "Pending", count: records.filter(r => r.human_review_status === "pending").length, color: "bg-yellow-100 text-yellow-700" },
          { label: "Reviewed", count: records.filter(r => r.human_review_status === "reviewed").length, color: "bg-green-100 text-green-700" },
          { label: "Corrected", count: records.filter(r => r.human_review_status === "corrected").length, color: "bg-purple-100 text-purple-700" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{s.count}</p>
              <Badge className={`${s.color} border-0 mt-1 text-xs`}>{s.label}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by service or species..." className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ScanSearch className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-muted-foreground">No AI analysis records yet</p>
          <p className="text-sm text-muted-foreground mt-1">Records are created automatically when customers use the AI estimate tool</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(record => {
            const StatusIcon = STATUS_ICONS[record.human_review_status] || Clock;
            return (
              <Card key={record.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Tree photos */}
                      {record.image_urls?.length > 0 ? (
                        <img src={record.image_urls[0]} alt="" className="w-12 h-12 object-cover rounded-lg border shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <TreePine className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{record.recommended_service || "Tree Assessment"}</p>
                          <Badge className={`${STATUS_STYLES[record.human_review_status]} text-xs gap-1`}>
                            <StatusIcon className="w-3 h-3" />
                            {record.human_review_status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {record.detected_species && <span className="mr-2">{record.detected_species}</span>}
                          {record.risk_level && <span className={`capitalize font-medium ${RISK_COLORS[record.risk_level]}`}>{record.risk_level} risk</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {record.created_date && format(new Date(record.created_date), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {record.human_final_price ? (
                          <p className="font-bold text-green-700">${record.human_final_price.toLocaleString()}</p>
                        ) : record.price_low ? (
                          <p className="font-semibold">${record.price_low.toLocaleString()}–${record.price_high?.toLocaleString()}</p>
                        ) : null}
                        {record.confidence_score && (
                          <p className="text-xs text-muted-foreground">{Math.round(record.confidence_score * 100)}% confidence</p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setReviewing(record)}>
                        <Eye className="w-3.5 h-3.5" />Review
                      </Button>
                      {(record.human_review_status === "reviewed" || record.human_review_status === "corrected") && !record.quote_id && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-primary"
                          disabled={generatingQuote === record.id}
                          onClick={async () => {
                            setGeneratingQuote(record.id);
                            const settingsArr = await base44.entities.CompanySettings.list();
                            const s = settingsArr[0] || {};
                            const { lineItems, subtotal, total } = buildLineItemsFromAnalysis(record, s);
                            const expiryDate = new Date(Date.now() + (s.quote_expiration_days || 30) * 86400000).toISOString().split("T")[0];
                            const quote = await base44.entities.Quote.create({
                              quote_number: `Q-${Date.now().toString(36).toUpperCase()}`,
                              customer_id: record.customer_id || "",
                              lead_id: record.lead_id || "",
                              ai_analysis_id: record.id,
                              line_items: lineItems,
                              subtotal,
                              total_amount: total,
                              ai_generated: true,
                              ai_analysis: record.ai_reasoning_summary || record.condition_summary || "",
                              scope_of_work: record.recommended_service || "",
                              risk_level: record.risk_level || undefined,
                              crane_required: record.crane_likely || false,
                              status: "draft",
                              valid_until: expiryDate,
                            });
                            // Save v1 QuoteVersion automatically
                            await saveQuoteVersion(
                              { ...quote, id: quote.id },
                              [],
                              "AI Analysis",
                              "Auto-generated from AI assessment"
                            );
                            await base44.entities.AIAnalysisRecord.update(record.id, { quote_id: quote.id });
                            await logActivity({ relatedType: "Quote", relatedId: quote.id, actor: "staff", action: `Quote created from AI analysis`, notes: `AI analysis ${record.id}` });
                            await createNotification({ type: "ai_review_needed", title: `Quote generated from AI analysis`, message: `Quote for ${record.recommended_service || "tree service"} — $${total.toLocaleString()}`, relatedType: "Quote", relatedId: quote.id });
                            qc.invalidateQueries({ queryKey: ["ai_analysis"] });
                            toast.success("Quote created with v1 snapshot!");
                            setGeneratingQuote(null);
                            navigate(`/quotes/${quote.id}`);
                          }}
                        >
                          {generatingQuote === record.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          Generate Quote
                        </Button>
                      )}
                    </div>
                  </div>

                  {record.condition_summary && (
                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{record.condition_summary}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {reviewing && (
        <ReviewDialog
          record={reviewing}
          onClose={() => setReviewing(null)}
          onSave={(data) => updateMut.mutate({ id: reviewing.id, data })}
        />
      )}
    </div>
  );
}