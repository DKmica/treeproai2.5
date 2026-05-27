import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { logActivity, logAudit } from "@/lib/treeproWorkflow";
import AIQuoteBuilder from "@/components/quotes/AIQuoteBuilder";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  ScanSearch, Search, Loader2, CheckCircle2, AlertCircle, Clock,
  XCircle, Eye, TreePine, DollarSign, Sparkles, MapPin, AlertTriangle, ChevronDown, ChevronUp
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
const STATUS_ICONS = { pending: Clock, reviewed: CheckCircle2, corrected: AlertCircle, rejected: XCircle };
const RISK_COLORS = { low: "text-green-600", moderate: "text-yellow-600", high: "text-orange-600", extreme: "text-red-600" };
const RISK_BG = { low: "bg-green-100", moderate: "bg-yellow-100", high: "bg-orange-100", extreme: "bg-red-100" };

function DetailRow({ label, value, className = "" }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-start gap-2 py-1.5 border-b last:border-0 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-medium text-right ${className}`}>{value}</span>
    </div>
  );
}

function ReviewDialog({ record, onClose, onSave }) {
  const [form, setForm] = useState({
    human_review_status: record.human_review_status === "pending" ? "reviewed" : record.human_review_status,
    human_final_price: record.human_final_price || record.price_high || "",
    human_corrections: record.human_corrections || "",
    reviewed_by: record.reviewed_by || "",
  });
  const [expanded, setExpanded] = useState(false);
  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" /> Review AI Analysis
          </DialogTitle>
        </DialogHeader>

        {/* AI Structured Data */}
         <div className="bg-muted rounded-lg p-4 space-y-2">
           <div className="flex items-center justify-between">
             <h4 className="text-sm font-semibold">AI Assessment Data</h4>
             <button onClick={() => setExpanded(v => !v)} className="text-xs text-primary flex items-center gap-1">
               {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
               {expanded ? "Less" : "More detail"}
             </button>
           </div>
           <div className="grid grid-cols-2 gap-x-4">
             <DetailRow label="Price Range" value={record.price_low ? `$${record.price_low?.toLocaleString()} – $${record.price_high?.toLocaleString()}` : null} className="text-green-700" />
             <DetailRow label="Confidence" value={record.confidence_score ? `${Math.round(record.confidence_score)}%` : null} />
             <DetailRow label="Species" value={record.detected_species} />
             <DetailRow label="Risk Level" value={record.risk_level} className={RISK_COLORS[record.risk_level]} />
             <DetailRow label="Recommended" value={record.recommended_service} />
             <DetailRow label="Urgency" value={record.urgency_level} />
             {record.complexity_score !== undefined && (
               <DetailRow label="Complexity Score" value={`${Math.round(record.complexity_score)}/100 (${record.complexity_tier})`} className="font-semibold" />
             )}
             {record.pricing_floor && (
               <DetailRow label="Pricing Floor" value={`$${record.pricing_floor.toLocaleString()}`} className="text-blue-600 font-medium" />
             )}
             {expanded && <>
               <DetailRow label="Height" value={record.estimated_height_ft_low ? `${record.estimated_height_ft_low}–${record.estimated_height_ft_high}ft` : null} />
               <DetailRow label="DBH" value={record.estimated_dbh_inches_low ? `${record.estimated_dbh_inches_low}–${record.estimated_dbh_inches_high}"` : null} />
               <DetailRow label="Crane Likely" value={record.crane_likely ? "Yes" : record.crane_likely === false ? "No" : null} />
               <DetailRow label="Crane Required" value={record.crane_required ? "Yes" : record.crane_required === false ? "No" : null} />
               <DetailRow label="Structures Nearby" value={record.structures_nearby ? "Yes" : record.structures_nearby === false ? "No" : null} />
               <DetailRow label="Canopy Over Structure" value={record.canopy_over_structure ? "Yes" : record.canopy_over_structure === false ? "No" : null} />
               <DetailRow label="Limited Drop Zone" value={record.limited_drop_zone ? "Yes" : record.limited_drop_zone === false ? "No" : null} />
               <DetailRow label="Stump Grind" value={record.stump_grinding_likely ? "Yes" : record.stump_grinding_likely === false ? "No" : null} />
               <DetailRow label="Access" value={record.access_difficulty} />
               {record.no_crane_price_low && (
                 <DetailRow label="No Crane Est." value={`$${record.no_crane_price_low?.toLocaleString()}–$${record.no_crane_price_high?.toLocaleString()}`} />
               )}
               {record.crane_required_price_low && (
                 <DetailRow label="With Crane Est." value={`$${record.crane_required_price_low?.toLocaleString()}–$${record.crane_required_price_high?.toLocaleString()}`} />
               )}
             </>}
           </div>
          {record.condition_summary && (
            <p className="text-xs text-muted-foreground mt-1 pt-1 border-t">{record.condition_summary}</p>
          )}
          {record.hazards_detected && (
            <div className="flex items-start gap-1.5 mt-1 text-xs text-orange-700 bg-orange-50 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{record.hazards_detected}</span>
            </div>
          )}
          {record.ai_reasoning_summary && (
            <p className="text-xs text-muted-foreground border-t pt-2 mt-1 italic">{record.ai_reasoning_summary}</p>
          )}
        </div>

        {/* Photos */}
        {record.image_urls?.length > 0 && (
          <div>
            <Label className="text-xs mb-2 block">Customer Photos ({record.image_urls.length})</Label>
            <div className="flex flex-wrap gap-2">
              {record.image_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border hover:opacity-90 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Staff Review Form */}
        <div className="space-y-3 border-t pt-3">
          <h4 className="text-sm font-semibold">Staff Review</h4>
          <div className="space-y-1">
            <Label>Review Status</Label>
            <select className="w-full border rounded-md h-9 px-3 text-sm bg-background" value={form.human_review_status} onChange={set("human_review_status")}>
              <option value="reviewed">Reviewed — Looks Good</option>
              <option value="corrected">Corrected — Price Adjusted</option>
              <option value="rejected">Rejected — Invalid Analysis</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Final Price Override ($)</Label>
            <Input type="number" value={form.human_final_price} onChange={set("human_final_price")} placeholder={`AI range: $${record.price_low || 0}–$${record.price_high || 0}`} />
            <p className="text-xs text-muted-foreground">Leave blank to use AI price range for quote generation</p>
          </div>
          <div className="space-y-1">
            <Label>Corrections / Notes</Label>
            <Textarea value={form.human_corrections} onChange={set("human_corrections")} placeholder="What was wrong or adjusted?" rows={3} />
          </div>
          <div className="space-y-1">
            <Label>Reviewed By</Label>
            <Input value={form.reviewed_by} onChange={set("reviewed_by")} placeholder="Your name or initials" />
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
  const [buildingQuote, setBuildingQuote] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["ai_analysis"],
    queryFn: () => base44.entities.AIAnalysisRecord.list("-created_date"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AIAnalysisRecord.update(id, data),
    onSuccess: async (_, { id, data }) => {
      qc.invalidateQueries({ queryKey: ["ai_analysis"] });
      setReviewing(null);
      toast.success("Review saved");
      await logActivity({ relatedType: "AIAnalysisRecord", relatedId: id, actor: data.reviewed_by || "staff", action: `AI analysis ${data.human_review_status}`, notes: data.human_corrections || "" });
      await logAudit({ actorName: data.reviewed_by || "staff", action: "ai_analysis_reviewed", entityType: "AIAnalysisRecord", entityId: id, newValue: { status: data.human_review_status, price: data.human_final_price } });
    },
    onError: () => toast.error("Failed to save review"),
  });

  const filtered = records.filter(r => {
    const matchesSearch =
      (r.recommended_service || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.detected_species || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.condition_summary || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || r.human_review_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const pending = records.filter(r => r.human_review_status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ScanSearch className="w-6 h-6 text-primary" /> AI Analysis Records
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Review and approve AI-generated tree assessments before generating quotes.</p>
        </div>
        {pending > 0 && (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1 px-3 py-1.5">
            <Clock className="w-3.5 h-3.5" /> {pending} Pending Review
          </Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", count: records.length, color: "bg-blue-100 text-blue-700" },
          { label: "Pending", count: records.filter(r => r.human_review_status === "pending").length, color: "bg-yellow-100 text-yellow-700" },
          { label: "Reviewed", count: records.filter(r => r.human_review_status === "reviewed").length, color: "bg-green-100 text-green-700" },
          { label: "With Quotes", count: records.filter(r => r.quote_id).length, color: "bg-purple-100 text-purple-700" },
        ].map(s => (
          <Card key={s.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterStatus(s.label === "Total" ? "all" : s.label.toLowerCase())}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{s.count}</p>
              <Badge className={`${s.color} border-0 mt-1 text-xs`}>{s.label}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by service, species, or notes..." className="pl-9" />
        </div>
        <select
          className="border rounded-md h-9 px-3 text-sm bg-background"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="reviewed">Reviewed</option>
          <option value="corrected">Corrected</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ScanSearch className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-muted-foreground">No AI analysis records found</p>
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
                      {/* Tree photo */}
                      {record.image_urls?.length > 0 ? (
                        <div className="relative shrink-0">
                          <img src={record.image_urls[0]} alt="" className="w-14 h-14 object-cover rounded-lg border" />
                          {record.image_urls.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{record.image_urls.length}</span>
                          )}
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <TreePine className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{record.recommended_service || "Tree Assessment"}</p>
                          <Badge className={`${STATUS_STYLES[record.human_review_status]} text-xs gap-1`}>
                            <StatusIcon className="w-3 h-3" />
                            {record.human_review_status}
                          </Badge>
                          {record.risk_level && (
                            <Badge className={`${RISK_BG[record.risk_level]} text-xs capitalize`}>{record.risk_level} risk</Badge>
                          )}
                          {record.quote_id && (
                            <Badge className="bg-teal-100 text-teal-700 text-xs">Quote created</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap mt-1">
                          {record.detected_species && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <TreePine className="w-3 h-3" />{record.detected_species}
                            </span>
                          )}
                          {record.estimated_height_ft_high && (
                            <span className="text-xs text-muted-foreground">
                              ~{record.estimated_height_ft_low || 0}–{record.estimated_height_ft_high}ft
                            </span>
                          )}
                          {record.access_difficulty && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                              <MapPin className="w-3 h-3" />{record.access_difficulty} access
                            </span>
                          )}
                        </div>
                        {record.hazards_detected && (
                          <div className="flex items-center gap-1 text-xs text-orange-700 mt-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />{record.hazards_detected.slice(0, 80)}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {record.created_date && format(new Date(record.created_date), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-right">
                        {record.human_final_price ? (
                          <p className="font-bold text-green-700">${record.human_final_price.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">(override)</span></p>
                        ) : record.price_low ? (
                          <p className="font-semibold">${record.price_low.toLocaleString()}–${record.price_high?.toLocaleString()}</p>
                        ) : null}
                        {record.confidence_score && (
                          <p className="text-xs text-muted-foreground">{Math.round(record.confidence_score > 1 ? record.confidence_score : record.confidence_score * 100)}% confidence</p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setReviewing(record)}>
                        <Eye className="w-3.5 h-3.5" />Review
                      </Button>
                      {(record.human_review_status === "reviewed" || record.human_review_status === "corrected") && !record.quote_id && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-primary"
                          onClick={() => setBuildingQuote(record)}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Build Quote
                        </Button>
                      )}
                      {record.quote_id && (
                        <Button size="sm" variant="outline" className="gap-1.5 text-primary border-primary/30" onClick={() => navigate(`/quotes/${record.quote_id}`)}>
                          <DollarSign className="w-3.5 h-3.5" />View Quote
                        </Button>
                      )}
                    </div>
                  </div>

                  {record.condition_summary && (
                    <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">{record.condition_summary.slice(0, 150)}{record.condition_summary.length > 150 ? "..." : ""}</p>
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

      {buildingQuote && (
        <AIQuoteBuilder
          record={buildingQuote}
          open={!!buildingQuote}
          onOpenChange={(v) => { if (!v) setBuildingQuote(null); }}
          onQuoteCreated={() => qc.invalidateQueries({ queryKey: ["ai_analysis"] })}
        />
      )}
    </div>
  );
}