import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, TreePine, AlertTriangle, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

const RISK_COLORS = { low: "bg-green-100 text-green-700", moderate: "bg-yellow-100 text-yellow-700", high: "bg-orange-100 text-orange-700", extreme: "bg-red-100 text-red-700" };

export default function GenerateFromAssessmentModal({ open, onOpenChange, customers = [], onQuoteCreated, prefillText = "", prefillCustomerName = "", prefillStructuredAnalysis = null }) {
  const [mode, setMode] = useState("pick"); // "pick" | "paste"
  const [assessmentText, setAssessmentText] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState("");

  // Fetch existing AI analysis records without a quote
  const { data: analysisRecords = [] } = useQuery({
    queryKey: ["ai_analysis_pending_quote"],
    queryFn: () => base44.entities.AIAnalysisRecord.list("-created_date"),
    enabled: open,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads_modal"],
    queryFn: () => base44.entities.Lead.list("-created_date", 200),
    enabled: open,
  });

  const getRecordContactName = (record) => {
    if (record.customer_id) {
      const c = customers.find(c => c.id === record.customer_id);
      if (c) return `${c.first_name} ${c.last_name}`;
    }
    if (record.lead_id) {
      const l = leads.find(l => l.id === record.lead_id);
      if (l) return `${l.first_name} ${l.last_name}`;
    }
    return null;
  };

  // Records that don't have a quote yet
  const availableRecords = analysisRecords.filter(r => !r.quote_id && r.human_review_status !== "rejected");
  const filteredRecords = availableRecords.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    const name = getRecordContactName(r) || "";
    return (r.recommended_service || "").toLowerCase().includes(s) ||
      (r.detected_species || "").toLowerCase().includes(s) ||
      (r.original_customer_notes || "").toLowerCase().includes(s) ||
      name.toLowerCase().includes(s);
  });

  useEffect(() => {
    if (prefillText) {
      setAssessmentText(prefillText);
      setMode("paste");
    }
  }, [prefillText]);

  useEffect(() => {
    if (prefillCustomerName && customers.length > 0) {
      const match = customers.find((c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase() === prefillCustomerName.toLowerCase()
      );
      if (match) setCustomerId(match.id);
    }
  }, [prefillCustomerName, customers]);

  const handleGenerate = async () => {
    if (mode === "paste" && !assessmentText.trim()) {
      toast.error("Please paste the assessment conversation or description.");
      return;
    }
    if (mode === "pick" && !selectedRecord) {
      toast.error("Please select an AI analysis record.");
      return;
    }
    setLoading(true);
    setResult(null);

    const customer = customers.find((c) => c.id === customerId);
    const effectiveCustomerId = mode === "pick" ? (selectedRecord?.customer_id || customerId) : customerId;
    const effectiveCustomer = customers.find(c => c.id === effectiveCustomerId);

    // If no customer linked, try to get name from the lead
    let effectiveCustomerName = effectiveCustomer
      ? `${effectiveCustomer.first_name} ${effectiveCustomer.last_name}`
      : customer ? `${customer.first_name} ${customer.last_name}` : undefined;
    if (!effectiveCustomerName && mode === "pick" && selectedRecord?.lead_id) {
      const l = leads.find(l => l.id === selectedRecord.lead_id);
      if (l) effectiveCustomerName = `${l.first_name} ${l.last_name}`;
    }

    const res = await base44.functions.invoke("generateAssessmentQuote", {
      assessment_text: mode === "pick"
        ? (selectedRecord.original_customer_notes || selectedRecord.recommended_service || "AI tree assessment")
        : assessmentText,
      customer_id: effectiveCustomerId || undefined,
      customer_name: effectiveCustomerName,
      structured_analysis: mode === "pick"
        ? selectedRecord
        : (prefillStructuredAnalysis || undefined),
      ai_analysis_id: mode === "pick" ? selectedRecord.id : undefined,
    });

    setLoading(false);
    if (res.data?.quote) {
      // Link AIAnalysisRecord to the new quote if we picked one
      if (mode === "pick" && selectedRecord?.id) {
        await base44.entities.AIAnalysisRecord.update(selectedRecord.id, { quote_id: res.data.quote.id }).catch(() => {});
      }
      setResult(res.data);
      toast.success("Quote generated successfully!");
      onQuoteCreated?.();
    } else {
      toast.error("Failed to generate quote. Please try again.");
    }
  };

  const handleClose = () => {
    setAssessmentText("");
    setCustomerId("");
    setSelectedRecord(null);
    setResult(null);
    setSearch("");
    setMode("pick");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generate Quote from AI Assessment
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setMode("pick")}
                className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${mode === "pick" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Pick from Existing Records {availableRecords.length > 0 && <span className="ml-1 text-xs bg-primary/10 text-primary rounded-full px-1.5">{availableRecords.length}</span>}
              </button>
              <button
                onClick={() => setMode("paste")}
                className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${mode === "paste" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Paste Assessment Text
              </button>
            </div>

            {mode === "pick" ? (
              <div className="space-y-3">
                {availableRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TreePine className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No pending AI analysis records</p>
                    <p className="text-xs mt-1">Records appear here when customers use the public estimate form, or switch to "Paste Assessment Text".</p>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search records..."
                        className="w-full pl-9 h-9 text-sm border rounded-md bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {filteredRecords.map(record => (
                        <div
                          key={record.id}
                          onClick={() => setSelectedRecord(record)}
                          className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${selectedRecord?.id === record.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex gap-2 min-w-0">
                              {record.image_urls?.[0] ? (
                                <img src={record.image_urls[0]} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                              ) : (
                                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                                  <TreePine className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                {getRecordContactName(record) && (
                                  <p className="font-semibold text-sm text-foreground truncate">{getRecordContactName(record)}</p>
                                )}
                                <p className="font-medium text-sm truncate text-muted-foreground">{record.recommended_service || "Tree Assessment"}</p>
                                {record.detected_species && <p className="text-xs text-muted-foreground">{record.detected_species}</p>}
                                <p className="text-xs text-muted-foreground">{record.created_date ? format(new Date(record.created_date), "MMM d, yyyy") : ""}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                              {record.risk_level && <Badge className={`${RISK_COLORS[record.risk_level]} text-xs`}>{record.risk_level}</Badge>}
                              {record.price_low && (
                                <p className="text-xs font-semibold text-green-700">${record.price_low.toLocaleString()}–${record.price_high?.toLocaleString()}</p>
                              )}
                              {record.human_review_status === "pending" && (
                                <Badge className="bg-yellow-100 text-yellow-700 text-xs">Pending review</Badge>
                              )}
                              {selectedRecord?.id === record.id && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                            </div>
                          </div>
                          {record.original_customer_notes && (
                            <p className="text-xs text-muted-foreground mt-1.5 border-t pt-1.5 line-clamp-2">{record.original_customer_notes}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {selectedRecord && (
                      <div className="space-y-1.5">
                        <Label>Link to Customer (optional)</Label>
                        <Select value={customerId || selectedRecord.customer_id || ""} onValueChange={setCustomerId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer or leave blank" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.first_name} {c.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground flex gap-2">
                  <TreePine className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p>Paste the AI assessment conversation or tree description. The system will extract tree details and calculate service prices.</p>
                </div>

                <div className="space-y-1.5">
                  <Label>Link to Customer (optional)</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select existing customer or leave blank" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.first_name} {c.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Assessment Text / Chat Conversation *</Label>
                  <Textarea
                    value={assessmentText}
                    onChange={(e) => setAssessmentText(e.target.value)}
                    placeholder={`Paste the AI assessment conversation here, for example:\n\n"I have a 50ft dead oak tree leaning toward my garage..."\n\nOr paste the full chat transcript from the AI Tree Assessment tool.`}
                    rows={10}
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleGenerate}
                disabled={loading || (mode === "paste" && !assessmentText.trim()) || (mode === "pick" && !selectedRecord)}
                className="gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? "Analyzing & Generating..." : "Generate Quote"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-medium text-sm">Quote Generated Successfully</p>
                <p className="text-xs text-green-600">
                  {result.trees_assessed} tree(s) assessed · Quote #{result.quote.quote_number}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Line Items</p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Description</th>
                      <th className="text-right px-3 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.line_items.map((item, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">{item.description}</td>
                        <td className="px-3 py-2 text-right font-medium">${(item.total || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t-2 border-border">
                    <tr>
                      <td className="px-3 py-2 font-bold">Total Estimate</td>
                      <td className="px-3 py-2 text-right font-bold text-lg">${(result.total_amount || 0).toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>This is a preliminary estimate. Final pricing will be confirmed after an on-site assessment by a certified arborist.</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResult(null)}>Generate Another</Button>
              <Button onClick={handleClose}>View in Quotes</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}