import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Receipt, Mail, User, DollarSign, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { logActivity, logAudit, createNotification } from "@/lib/treeproWorkflow";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

export default function GenerateInvoiceDialog({ job, onClose }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");

  // Try to load the linked quote for its line items and agreed price
  const { data: quote, isLoading: loadingQuote } = useQuery({
    queryKey: ["invoice_quote", job.quote_id],
    queryFn: () => job.quote_id
      ? base44.entities.Quote.filter({ id: job.quote_id }).then(r => r[0] || null)
      : Promise.resolve(null),
    enabled: !!job.quote_id,
  });

  // Determine line items: prefer quote's items, fall back to job data
  const sourceLineItems = quote?.line_items?.length
    ? quote.line_items
    : job.line_items?.length
    ? job.line_items
    : [{ description: job.description || "Tree Service", quantity: 1, unit_price: job.total_cost || 0, total: job.total_cost || 0 }];

  const subtotal = sourceLineItems.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const source = quote?.line_items?.length ? "quote" : job.line_items?.length ? "job" : "estimated";

  const handleGenerate = async () => {
    if (!job.customer_id && !job.customer_name) {
      toast.error("Job has no customer attached");
      return;
    }

    setGenerating(true);
    try {
      const invNum = `INV-${Date.now().toString().slice(-6)}`;

      const inv = await base44.entities.Invoice.create({
        customer_id: job.customer_id || "",
        customer_name: job.customer_name,
        customer_email: job.customer_email || "",
        job_id: job.id,
        quote_id: job.quote_id || "",
        invoice_number: invNum,
        line_items: sourceLineItems,
        subtotal,
        tax_rate: 0,
        tax_amount: 0,
        discount_amount: 0,
        total: subtotal,
        amount_paid: 0,
        balance_due: subtotal,
        status: "draft",
        due_date: dueDate,
        notes: notes || undefined,
      });

      // Update job status to invoiced and store invoice_id
      await base44.entities.Job.update(job.id, { status: "invoiced", invoice_id: inv.id });

      // Link quote to invoice if applicable
      if (job.quote_id) {
        base44.entities.Quote.update(job.quote_id, { status: "invoiced" }).catch(() => {});
      }

      await logActivity({
        relatedType: "Invoice", relatedId: inv.id, actor: "staff",
        action: `Invoice ${invNum} generated from job`,
        notes: `${job.customer_name} — $${subtotal.toLocaleString()} (source: ${source})`,
      });
      await logAudit({
        actorName: "staff", action: "invoice_generated_from_job",
        entityType: "Invoice", entityId: inv.id,
        newValue: { job_id: job.id, customer: job.customer_name, total: subtotal, source },
      });
      await createNotification({
        type: "general",
        title: `Invoice ${invNum} created`,
        message: `${job.customer_name} — $${subtotal.toLocaleString()}. Ready to send.`,
        relatedType: "Invoice", relatedId: inv.id,
      });

      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success(`Invoice ${invNum} created — ready to send`);
      navigate("/invoices");
      onClose();
    } catch (err) {
      toast.error("Failed to generate invoice: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Generate Invoice
          </DialogTitle>
        </DialogHeader>

        {loadingQuote ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Customer info */}
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{job.customer_name}</span>
              </div>
              {job.customer_email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0" />
                  {job.customer_email}
                </div>
              )}
              {!job.customer_email && (
                <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  No email on file — update the customer record to enable email sending.
                </div>
              )}
            </div>

            {/* Pricing source badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={
                source === "quote" ? "border-green-400 text-green-700" :
                source === "job" ? "border-blue-400 text-blue-700" :
                "border-yellow-400 text-yellow-700"
              }>
                <FileText className="w-3 h-3 mr-1" />
                {source === "quote" ? "Pricing from approved quote" :
                 source === "job" ? "Pricing from job data" :
                 "Estimated from job total"}
              </Badge>
            </div>

            {/* Line items preview */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Line Items</p>
              <div className="border rounded-lg divide-y text-sm">
                {sourceLineItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 gap-2">
                    <span className="flex-1 text-xs">{item.description}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {item.quantity > 1 ? `${item.quantity} × $${(item.unit_price || 0).toLocaleString()}` : ""}
                    </span>
                    <span className="font-medium shrink-0">${(item.total || 0).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2.5 bg-muted/40 font-semibold">
                  <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Total</span>
                  <span className="text-base">${subtotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Due date */}
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>

            {/* Optional notes */}
            <div className="space-y-1">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Payment terms, thank you message..."
              />
            </div>

            {/* Email note */}
            <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-100 rounded px-3 py-2">
              The invoice will be created as a <strong>draft</strong>. Go to Invoices to mark it sent and record payments.
              {!job.customer_email && " Add customer email first to enable direct email sending."}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={generating}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={generating || loadingQuote} className="gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
            {generating ? "Generating..." : "Generate Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}