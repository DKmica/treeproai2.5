import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, TreePine, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function GenerateFromAssessmentModal({ open, onOpenChange, customers = [], onQuoteCreated, prefillText = "" }) {
  const [assessmentText, setAssessmentText] = useState("");
  const [customerId, setCustomerId] = useState("");

  useEffect(() => {
    if (prefillText) setAssessmentText(prefillText);
  }, [prefillText]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    if (!assessmentText.trim()) {
      toast.error("Please paste the assessment conversation or description.");
      return;
    }
    setLoading(true);
    setResult(null);

    const customer = customers.find((c) => c.id === customerId);
    const res = await base44.functions.invoke("generateAssessmentQuote", {
      assessment_text: assessmentText,
      customer_id: customerId || undefined,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}` : undefined,
    });

    setLoading(false);
    if (res.data?.quote) {
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
    setResult(null);
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
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-muted-foreground flex gap-2">
              <TreePine className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p>Paste the AI assessment conversation or tree description below. The system will extract tree details (size, species, risk level) and automatically calculate service prices.</p>
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
                placeholder={`Paste the AI assessment conversation here, for example:

"I have a 50ft dead oak tree leaning toward my garage. The tree has large dead branches and visible root damage. It needs emergency removal..."

Or paste the full chat transcript from the AI Tree Assessment tool.`}
                rows={10}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Tip: Copy the full conversation from the AI Assessment page for the most accurate quote.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={loading || !assessmentText.trim()} className="gap-2">
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