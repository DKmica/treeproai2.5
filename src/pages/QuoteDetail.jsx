import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPortalLink, logActivity, logAudit, createNotification } from "@/lib/treeproWorkflow";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, CheckCircle2, XCircle, Briefcase, Send, DollarSign, Clock, Loader2, Plus, Trash2, Copy, User,
  Sparkles, TreePine, AlertTriangle, ShieldAlert, Ruler, Bug
} from "lucide-react";
import { convertQuoteToJob } from "@/lib/treeproWorkflow";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-600",
  needs_review: "bg-yellow-100 text-yellow-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-indigo-100 text-indigo-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
  converted_to_job: "bg-teal-100 text-teal-700",
  invoiced: "bg-purple-100 text-purple-700",
  paid: "bg-emerald-100 text-emerald-700",
};

function LineItemsTable({ items = [], editable, onChange }) {
  const update = (i, field, val) => {
    const updated = items.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: field === "description" ? val : parseFloat(val) || 0 };
      updated.total = (updated.quantity || 1) * (updated.unit_price || 0);
      return updated;
    });
    onChange?.(updated);
  };

  const addRow = () => onChange?.([...items, { description: "", quantity: 1, unit_price: 0, total: 0 }]);
  const removeRow = (i) => onChange?.(items.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center text-sm">
          {editable ? (
            <>
              <Input className="col-span-6" value={item.description} onChange={e => update(i, "description", e.target.value)} placeholder="Description" />
              <Input className="col-span-2" type="number" value={item.quantity} onChange={e => update(i, "quantity", e.target.value)} placeholder="Qty" />
              <Input className="col-span-2" type="number" value={item.unit_price} onChange={e => update(i, "unit_price", e.target.value)} placeholder="Price" />
              <span className="col-span-1 text-right font-medium">${(item.total || 0).toLocaleString()}</span>
              <Button variant="ghost" size="icon" className="col-span-1 h-7 w-7" onClick={() => removeRow(i)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </>
          ) : (
            <>
              <span className="col-span-7">{item.description}</span>
              <span className="col-span-2 text-center text-muted-foreground">×{item.quantity}</span>
              <span className="col-span-1 text-right text-muted-foreground">${(item.unit_price || 0).toLocaleString()}</span>
              <span className="col-span-2 text-right font-medium">${(item.total || 0).toLocaleString()}</span>
            </>
          )}
        </div>
      ))}
      {editable && (
        <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Add Line Item
        </Button>
      )}
      <div className="border-t pt-2 text-right font-semibold">
        Total: ${subtotal.toLocaleString()}
      </div>
    </div>
  );
}

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [changeReason, setChangeReason] = useState("");
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [converting, setConverting] = useState(false);
  const [portalLink, setPortalLink] = useState("");

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => base44.entities.Quote.filter({ id }),
    select: (arr) => arr[0],
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["quote_versions", id],
    queryFn: () => base44.entities.QuoteVersion.filter({ quote_id: id }),
    enabled: !!id,
  });

  const { data: customer } = useQuery({
    queryKey: ["customer", quote?.customer_id],
    queryFn: () => base44.entities.Customer.filter({ id: quote.customer_id }),
    enabled: !!quote?.customer_id,
    select: arr => arr[0],
  });

  const { data: aiRecord } = useQuery({
    queryKey: ["ai_analysis_record", quote?.ai_analysis_id],
    queryFn: () => base44.entities.AIAnalysisRecord.filter({ id: quote.ai_analysis_id }),
    enabled: !!quote?.ai_analysis_id,
    select: arr => arr[0],
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Quote.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quote", id] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      setEditing(false);
      toast.success("Quote updated");
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!quote) return <div className="text-center py-12 text-muted-foreground">Quote not found</div>;

  const startEdit = () => {
    setEditData({ line_items: quote.line_items || [], notes: quote.notes || "", scope_of_work: quote.scope_of_work || "" });
    setChangeReason("");
    setEditing(true);
  };

  const saveEdit = async () => {
    const subtotal = (editData.line_items || []).reduce((s, i) => s + (i.total || 0), 0);
    const total = subtotal - (quote.discount_amount || 0) + (quote.tax_amount || 0);

    // Save version first
    await base44.entities.QuoteVersion.create({
      quote_id: id,
      version_number: versions.length + 1,
      line_items: quote.line_items || [],
      subtotal: quote.subtotal || 0,
      discount_amount: quote.discount_amount || 0,
      tax_amount: quote.tax_amount || 0,
      total: quote.total_amount || 0,
      changed_by: "staff",
      change_reason: changeReason || "Manual edit",
      status_at_save: quote.status,
    });

    updateMutation.mutate({
      ...editData,
      subtotal,
      total_amount: Math.max(total, 0),
      change_reason: changeReason,
    });
    qc.invalidateQueries({ queryKey: ["quote_versions", id] });
  };

  const updateStatus = async (status) => {
    const data = { status };
    if (status === "approved") data.approved_at = new Date().toISOString();
    if (status === "rejected") data.rejected_at = new Date().toISOString();
    if (status === "sent") data.sent_at = new Date().toISOString();
    await updateMutation.mutateAsync(data);
    if (status === "approved") {
      logAudit({ actorName: "staff", action: "quote_approved_by_staff", entityType: "Quote", entityId: id, newValue: { status: "approved" } });
      // Auto-create job and navigate to jobs
      try {
        const approvedQuote = { ...quote, ...data };
        await convertQuoteToJob(approvedQuote, customer, "staff");
        toast.success("Quote approved — job created and ready to schedule!");
        navigate("/jobs");
      } catch {
        toast.error("Quote approved but job creation failed. Use 'Convert to Job' manually.");
      }
    } else if (status === "rejected") {
      logAudit({ actorName: "staff", action: "quote_rejected_by_staff", entityType: "Quote", entityId: id, newValue: { status: "rejected" } });
    }
  };

  const generatePortalLink = async () => {
    const link = await createPortalLink(id, quote.customer_id, 7);
    setPortalLink(link);
    navigator.clipboard?.writeText(link);
    await logActivity({ relatedType: "Quote", relatedId: id, actor: "staff", action: "Portal link generated", notes: quote.customer_name });
    toast.success("Portal link copied to clipboard");
  };

  const convertToJob = async () => {
    setConverting(true);
    try {
      // Fetch AI analysis record if linked, for additional field mapping
      let aiRecord = null;
      if (quote.ai_analysis_id) {
        const arr = await base44.entities.AIAnalysisRecord.filter({ id: quote.ai_analysis_id }).catch(() => []);
        aiRecord = arr[0] || null;
      }

      // Determine priority from risk/urgency
      const riskLevel = quote.risk_level || aiRecord?.risk_level;
      const urgency = aiRecord?.urgency_level;
      let priority = "normal";
      if (urgency === "emergency" || riskLevel === "extreme") priority = "emergency";
      else if (riskLevel === "high" || quote.crane_required) priority = "high";

      // Build address — always set both fields for Crew Mode map support
      const address = quote.customer_address || customer?.address || "";

      const job = await base44.entities.Job.create({
        customer_id: quote.customer_id,
        customer_name: quote.customer_name,
        customer_phone: quote.customer_phone || customer?.phone || "",
        customer_email: quote.customer_email || customer?.email || "",
        customer_address: address,
        address: address,  // Crew Mode uses job.address for Google Maps
        quote_id: id,
        ai_analysis_id: quote.ai_analysis_id || "",
        status: "unscheduled",
        priority,
        description: quote.scope_of_work || quote.notes || "From quote",
        scope_of_work: quote.scope_of_work || "",
        total_cost: quote.total_amount || 0,
        line_items: quote.line_items || [],
        risk_level: riskLevel || undefined,
        hazards: aiRecord?.hazards_detected || quote.access_notes || "",
        safety_notes: aiRecord?.condition_summary ? `Tree condition: ${aiRecord.condition_summary}` : "",
        access_notes: quote.access_notes || (aiRecord?.access_difficulty ? `Access: ${aiRecord.access_difficulty}` : ""),
        crane_required: quote.crane_required || aiRecord?.crane_required || false,
        estimated_duration_hours: quote.estimated_duration_hours || (riskLevel === "extreme" ? 10 : riskLevel === "high" ? 8 : 4),
        required_crew_size: quote.required_crew_size || (riskLevel === "extreme" ? 4 : riskLevel === "high" ? 3 : 2),
        notes: `Converted from quote #${quote.quote_number || id.slice(0, 8)}`,
      });
      await updateMutation.mutateAsync({ status: "converted_to_job" });
      await logActivity({ relatedType: "Job", relatedId: job.id, actor: "staff", action: `Job created from quote #${quote.quote_number || id.slice(0, 8)}`, notes: quote.customer_name });
      await logAudit({ actorName: "staff", action: "quote_converted_to_job", entityType: "Job", entityId: job.id, newValue: { quote_id: id, customer: quote.customer_name, total: quote.total_amount } });
      await createNotification({ type: "job_assigned", title: `Job created for ${quote.customer_name}`, message: `Quote #${quote.quote_number || id.slice(0, 8)} converted. Job ready to schedule.`, relatedType: "Job", relatedId: job.id });
      toast.success("Job created successfully!");
      setShowConvertDialog(false);
      navigate(`/jobs`);
    } catch (err) {
      toast.error("Failed to create job");
    }
    setConverting(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Quote {quote.quote_number ? `#${quote.quote_number}` : `#${id.slice(0, 8)}`}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={STATUS_COLORS[quote.status] || "bg-gray-100 text-gray-600"}>{quote.status?.replace(/_/g, " ")}</Badge>
            {quote.valid_until && <span className="text-xs text-muted-foreground">Expires {format(new Date(quote.valid_until), "MMM d, yyyy")}</span>}
          </div>
        </div>
      </div>

      {/* Customer info */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> Customer</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p className="font-medium">{quote.customer_name}</p>
          {customer?.phone && <p className="text-muted-foreground">{customer.phone}</p>}
          {customer?.email && <p className="text-muted-foreground">{customer.email}</p>}
          {customer?.address && <p className="text-muted-foreground">{customer.address}</p>}
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" /> Pricing</CardTitle>
            {!editing && quote.status !== "converted_to_job" && quote.status !== "paid" && (
              <Button variant="outline" size="sm" onClick={startEdit}>Edit</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-3">
              <LineItemsTable items={editData.line_items} editable onChange={(items) => setEditData(p => ({ ...p, line_items: items }))} />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Scope of Work</label>
                <Textarea value={editData.scope_of_work} onChange={e => setEditData(p => ({ ...p, scope_of_work: e.target.value }))} rows={3} placeholder="Describe the work..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <Textarea value={editData.notes} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Reason for change *</label>
                <Input value={changeReason} onChange={e => setChangeReason(e.target.value)} placeholder="e.g. Customer requested additional service" />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEdit} disabled={updateMutation.isPending} className="gap-1.5">{updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save Changes</Button>
                <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <LineItemsTable items={quote.line_items || []} />
          )}

          {quote.discount_amount > 0 && (
            <p className="text-right text-sm text-muted-foreground mt-1">Discount: -${(quote.discount_amount || 0).toLocaleString()}</p>
          )}
        </CardContent>
      </Card>

      {/* Notes/scope */}
      {(quote.scope_of_work || quote.notes || quote.ai_analysis) && (
        <Card>
          <CardContent className="pt-4 space-y-2 text-sm">
            {quote.scope_of_work && <div><p className="font-medium text-muted-foreground text-xs mb-1">SCOPE OF WORK</p><p>{quote.scope_of_work}</p></div>}
            {quote.notes && <div><p className="font-medium text-muted-foreground text-xs mb-1">NOTES</p><p>{quote.notes}</p></div>}
            {quote.ai_analysis && <div><p className="font-medium text-muted-foreground text-xs mb-1">AI ANALYSIS</p><p className="text-muted-foreground">{quote.ai_analysis}</p></div>}
          </CardContent>
        </Card>
      )}

      {/* AI Analysis Panel */}
      {aiRecord && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> AI Assessment Data
              {aiRecord.confidence_score != null && (
                <Badge className={`ml-auto text-xs ${aiRecord.confidence_score >= 70 ? "bg-green-100 text-green-700" : aiRecord.confidence_score >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-orange-100 text-orange-700"}`}>
                  {aiRecord.confidence_score}% confidence
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {/* Species + Dimensions row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {aiRecord.detected_species && (
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><TreePine className="w-3 h-3" /> Species</p>
                  <p className="font-semibold text-sm">{aiRecord.detected_species}</p>
                  {aiRecord.species_confidence != null && <p className="text-xs text-muted-foreground">{aiRecord.species_confidence}% confident</p>}
                </div>
              )}
              {(aiRecord.estimated_height_ft_low || aiRecord.estimated_height_ft_high) && (
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Ruler className="w-3 h-3" /> Height</p>
                  <p className="font-semibold text-sm">
                    {aiRecord.estimated_height_ft_low && aiRecord.estimated_height_ft_high
                      ? `${aiRecord.estimated_height_ft_low}–${aiRecord.estimated_height_ft_high} ft`
                      : `${aiRecord.estimated_height_ft_low || aiRecord.estimated_height_ft_high} ft`}
                  </p>
                </div>
              )}
              {(aiRecord.estimated_dbh_inches_low || aiRecord.estimated_dbh_inches_high) && (
                <div className="bg-muted/50 rounded-lg p-2.5">
                  <p className="text-xs text-muted-foreground mb-1">Trunk Diameter</p>
                  <p className="font-semibold text-sm">
                    {aiRecord.estimated_dbh_inches_low && aiRecord.estimated_dbh_inches_high
                      ? `${aiRecord.estimated_dbh_inches_low}–${aiRecord.estimated_dbh_inches_high}"`
                      : `${aiRecord.estimated_dbh_inches_low || aiRecord.estimated_dbh_inches_high}"`}
                  </p>
                </div>
              )}
              {aiRecord.risk_level && (
                <div className={`rounded-lg p-2.5 ${aiRecord.risk_level === "extreme" ? "bg-red-50" : aiRecord.risk_level === "high" ? "bg-orange-50" : aiRecord.risk_level === "moderate" ? "bg-yellow-50" : "bg-green-50"}`}>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><ShieldAlert className="w-3 h-3" /> Risk</p>
                  <p className={`font-semibold text-sm capitalize ${aiRecord.risk_level === "extreme" ? "text-red-700" : aiRecord.risk_level === "high" ? "text-orange-700" : aiRecord.risk_level === "moderate" ? "text-yellow-700" : "text-green-700"}`}>
                    {aiRecord.risk_level}
                  </p>
                </div>
              )}
            </div>

            {/* AI Price Range vs Quote Total */}
            {(aiRecord.price_low || aiRecord.price_high) && (
              <div className="flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2.5">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">AI Estimated Range</p>
                  <p className="font-bold text-base">${(aiRecord.price_low || 0).toLocaleString()} – ${(aiRecord.price_high || 0).toLocaleString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground mb-0.5">This Quote</p>
                  <p className="font-bold text-base">${(quote.total_amount || 0).toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* Flags row */}
            <div className="flex flex-wrap gap-1.5">
              {aiRecord.crane_required && <Badge className="bg-red-100 text-red-700 text-xs gap-1">Crane Required</Badge>}
              {aiRecord.crane_likely && !aiRecord.crane_required && <Badge className="bg-orange-100 text-orange-700 text-xs gap-1">Crane Likely</Badge>}
              {aiRecord.structures_nearby && <Badge className="bg-yellow-100 text-yellow-700 text-xs">Structures Nearby</Badge>}
              {aiRecord.canopy_over_structure && <Badge className="bg-yellow-100 text-yellow-700 text-xs">Canopy Over Structure</Badge>}
              {aiRecord.limited_drop_zone && <Badge className="bg-yellow-100 text-yellow-700 text-xs">Limited Drop Zone</Badge>}
              {aiRecord.stump_grinding_likely && <Badge className="bg-blue-100 text-blue-700 text-xs">Stump Grinding Likely</Badge>}
              {aiRecord.access_difficulty && aiRecord.access_difficulty !== "easy" && (
                <Badge className="bg-muted text-muted-foreground text-xs capitalize">Access: {aiRecord.access_difficulty}</Badge>
              )}
              {aiRecord.urgency_level && aiRecord.urgency_level !== "normal" && (
                <Badge className={`text-xs capitalize ${aiRecord.urgency_level === "emergency" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                  {aiRecord.urgency_level} urgency
                </Badge>
              )}
            </div>

            {/* Hazards */}
            {aiRecord.hazards_detected && (
              <div className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-800 mb-0.5">Hazards Detected</p>
                  <p className="text-orange-700">{aiRecord.hazards_detected}</p>
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            {aiRecord.ai_reasoning_summary && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Bug className="w-3 h-3" /> AI Reasoning</p>
                <p className="text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded-lg p-2.5">{aiRecord.ai_reasoning_summary}</p>
              </div>
            )}

            {/* Original customer notes */}
            {aiRecord.original_customer_notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Customer's Original Request</p>
                <p className="text-xs text-muted-foreground italic bg-muted/30 rounded-lg p-2.5">"{aiRecord.original_customer_notes}"</p>
              </div>
            )}

            {/* Missing info questions */}
            {aiRecord.missing_info_questions && (
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800 mb-0.5">Questions to Clarify On-Site</p>
                  <p className="text-blue-700">{aiRecord.missing_info_questions}</p>
                </div>
              </div>
            )}

            {/* Photo thumbnails if any */}
            {aiRecord.image_urls?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Customer Photos</p>
                <div className="flex gap-2 flex-wrap">
                  {aiRecord.image_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Assessment photo ${i + 1}`} className="w-16 h-16 rounded-md object-cover border hover:opacity-80 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Version history */}
      {versions.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Version History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {versions.sort((a, b) => b.version_number - a.version_number).map(v => (
                <div key={v.id} className="flex items-start justify-between text-sm border-b pb-2 last:border-0">
                  <div>
                    <span className="font-medium">v{v.version_number}</span>
                    <span className="text-muted-foreground ml-2">{v.change_reason}</span>
                    <span className="text-muted-foreground ml-2 text-xs">by {v.changed_by}</span>
                  </div>
                  <span className="font-medium">${(v.total || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            {quote.status === "draft" && (
              <Button onClick={() => updateStatus("sent")} className="gap-1.5"><Send className="w-4 h-4" /> Mark as Sent</Button>
            )}
            {(quote.status === "sent" || quote.status === "viewed" || quote.status === "needs_review") && (
              <>
                <Button onClick={() => updateStatus("approved")} className="gap-1.5 bg-green-600 hover:bg-green-700"><CheckCircle2 className="w-4 h-4" /> Approve</Button>
                <Button variant="outline" onClick={() => updateStatus("rejected")} className="gap-1.5 text-destructive border-destructive"><XCircle className="w-4 h-4" /> Reject</Button>
              </>
            )}
            {quote.status === "approved" && !quote.job_id && (
              <Button onClick={() => setShowConvertDialog(true)} className="gap-1.5 bg-primary"><Briefcase className="w-4 h-4" /> Convert to Job</Button>
            )}
            {quote.job_id && (
              <Button variant="outline" onClick={() => navigate("/jobs")} className="gap-1.5 text-green-700 border-green-300 bg-green-50 hover:bg-green-100">
                <CheckCircle2 className="w-4 h-4" /> Job Created — View Jobs
              </Button>
            )}
            <Button variant="outline" onClick={generatePortalLink} className="gap-1.5"><Copy className="w-4 h-4" /> Copy Approval Link</Button>
          </div>
          {portalLink && (
            <div className="mt-3 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Customer portal link (copied):</p>
              <p className="text-xs font-mono break-all">{portalLink}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Convert to Job Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convert Quote to Job</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>This will create a new Job for <strong>{quote.customer_name}</strong> with the following:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>All line items and pricing from this quote</li>
              <li>Customer contact info</li>
              <li>Scope of work and notes</li>
            </ul>
            <p className="text-muted-foreground">The quote will be marked as <strong>converted to job</strong>.</p>
          </div>
          <div className="flex gap-2 mt-2">
            <Button onClick={convertToJob} disabled={converting} className="gap-1.5">
              {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
              Create Job
            </Button>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}