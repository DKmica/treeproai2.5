import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  FileText, Plus, Search, MoreVertical, DollarSign, AlertCircle, CheckCircle2, Loader2, Eye, CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  sent: "bg-blue-100 text-blue-700 border-blue-200",
  viewed: "bg-purple-100 text-purple-700 border-purple-200",
  partially_paid: "bg-yellow-100 text-yellow-700 border-yellow-200",
  paid: "bg-green-100 text-green-700 border-green-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  void: "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_LABELS = {
  draft: "Draft", sent: "Sent", viewed: "Viewed",
  partially_paid: "Partial", paid: "Paid", overdue: "Overdue", void: "Void",
};

function InvoiceDialog({ invoice, customers, onClose, onSave }) {
  const [form, setForm] = useState(invoice || {
    customer_id: "", customer_name: "", line_items: [], subtotal: 0,
    tax_rate: 0, tax_amount: 0, discount_amount: 0, total: 0,
    amount_paid: 0, balance_due: 0, status: "draft", notes: "",
    due_date: "",
  });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleCustomerChange = (id) => {
    const c = customers.find(c => c.id === id);
    setForm(f => ({ ...f, customer_id: id, customer_name: c ? `${c.first_name} ${c.last_name}` : "" }));
  };

  const calcTotals = (items, taxRate, discount) => {
    const sub = items.reduce((s, l) => s + (parseFloat(l.total) || 0), 0);
    const tax = sub * (parseFloat(taxRate) || 0) / 100;
    const total = sub + tax - (parseFloat(discount) || 0);
    return { subtotal: sub, tax_amount: tax, total, balance_due: total - (parseFloat(form.amount_paid) || 0) };
  };

  const addLine = () => setForm(f => ({
    ...f, line_items: [...f.line_items, { description: "", quantity: 1, unit_price: 0, total: 0 }]
  }));

  const updateLine = (idx, field, val) => {
    const items = [...form.line_items];
    items[idx] = { ...items[idx], [field]: val };
    if (field === "quantity" || field === "unit_price") {
      items[idx].total = (parseFloat(items[idx].quantity) || 0) * (parseFloat(items[idx].unit_price) || 0);
    }
    const totals = calcTotals(items, form.tax_rate, form.discount_amount);
    setForm(f => ({ ...f, line_items: items, ...totals }));
  };

  const removeLine = (idx) => {
    const items = form.line_items.filter((_, i) => i !== idx);
    const totals = calcTotals(items, form.tax_rate, form.discount_amount);
    setForm(f => ({ ...f, line_items: items, ...totals }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.customer_id) { toast.error("Please select a customer"); return; }
    if (form.line_items.length === 0) { toast.error("Add at least one line item"); return; }
    onSave(form);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit Invoice" : "Create Invoice"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Customer *</Label>
              <select className="w-full border rounded-md h-9 px-3 text-sm bg-background" value={form.customer_id} onChange={e => handleCustomerChange(e.target.value)}>
                <option value="">Select customer...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={set("due_date")} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>+ Add Line</Button>
            </div>
            <div className="space-y-2">
              {form.line_items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-5" placeholder="Description" value={item.description}
                    onChange={e => updateLine(idx, "description", e.target.value)} />
                  <Input className="col-span-2" type="number" placeholder="Qty" value={item.quantity}
                    onChange={e => updateLine(idx, "quantity", e.target.value)} />
                  <Input className="col-span-2" type="number" placeholder="Price" value={item.unit_price}
                    onChange={e => updateLine(idx, "unit_price", e.target.value)} />
                  <div className="col-span-2 text-sm font-medium">${(item.total || 0).toFixed(2)}</div>
                  <Button type="button" variant="ghost" size="icon" className="col-span-1 h-8 w-8" onClick={() => removeLine(idx)}>×</Button>
                </div>
              ))}
              {form.line_items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">No line items yet. Click "Add Line" to start.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 border-t">
            <div className="space-y-1">
              <Label>Tax Rate (%)</Label>
              <Input type="number" value={form.tax_rate} onChange={(e) => {
                const totals = calcTotals(form.line_items, e.target.value, form.discount_amount);
                setForm(f => ({ ...f, tax_rate: e.target.value, ...totals }));
              }} />
            </div>
            <div className="space-y-1">
              <Label>Discount ($)</Label>
              <Input type="number" value={form.discount_amount} onChange={(e) => {
                const totals = calcTotals(form.line_items, form.tax_rate, e.target.value);
                setForm(f => ({ ...f, discount_amount: e.target.value, ...totals }));
              }} />
            </div>
            <div className="space-y-1">
              <Label>Total</Label>
              <div className="h-9 flex items-center font-bold text-lg">${(form.total || 0).toFixed(2)}</div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={set("notes")} placeholder="Payment terms, special instructions..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">{invoice ? "Save Changes" : "Create Invoice"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({ invoice, onClose, onSave }) {
  const [amount, setAmount] = useState(invoice.balance_due || invoice.total || 0);
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ amount: parseFloat(amount), method, notes });
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Amount *</Label>
            <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
            <p className="text-xs text-muted-foreground">Balance due: ${(invoice.balance_due || 0).toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <Label>Payment Method</Label>
            <select className="w-full border rounded-md h-9 px-3 text-sm bg-background" value={method} onChange={e => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="credit_card">Credit Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="venmo">Venmo</option>
              <option value="zelle">Zelle</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Check #, transaction ID, etc." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Invoices() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [payingInvoice, setPayingInvoice] = useState(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => base44.entities.Invoice.list("-created_date"),
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list(),
  });

  const createMut = useMutation({
    mutationFn: (data) => {
      const inv_num = `INV-${Date.now().toString().slice(-6)}`;
      return base44.entities.Invoice.create({ ...data, invoice_number: inv_num });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); setShowForm(false); toast.success("Invoice created"); },
    onError: () => toast.error("Failed to create invoice"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); setEditing(null); toast.success("Invoice updated"); },
    onError: () => toast.error("Failed to update invoice"),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.Invoice.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Invoice deleted"); },
    onError: () => toast.error("Failed to delete invoice"),
  });

  const recordPayment = async (inv, { amount, method, notes }) => {
    const newAmountPaid = (inv.amount_paid || 0) + amount;
    const newBalance = Math.max((inv.total || 0) - newAmountPaid, 0);
    const newStatus = newBalance <= 0 ? "paid" : "partially_paid";

    // Create Payment record
    await base44.entities.Payment.create({
      invoice_id: inv.id,
      customer_id: inv.customer_id,
      customer_name: inv.customer_name,
      amount,
      method,
      status: "completed",
      paid_at: new Date().toISOString(),
      notes,
    });

    // Update invoice
    await base44.entities.Invoice.update(inv.id, { amount_paid: newAmountPaid, balance_due: newBalance, status: newStatus });
    qc.invalidateQueries({ queryKey: ["invoices"] });

    // Cascade: if fully paid, update linked Job and Quote statuses
    if (newStatus === "paid") {
      if (inv.job_id) {
        base44.entities.Job.update(inv.job_id, { status: "paid", invoice_id: inv.id }).catch(() => {});
      }
      if (inv.quote_id) {
        base44.entities.Quote.update(inv.quote_id, { status: "paid" }).catch(() => {});
      }
      base44.entities.Notification.create({ type: "general", title: `Invoice ${inv.invoice_number} fully paid`, message: `${inv.customer_name} — $${(inv.total || 0).toLocaleString()}`, read: false });
      base44.entities.ActivityLog.create({ related_type: "Invoice", related_id: inv.id, actor: "staff", action: `Invoice ${inv.invoice_number} paid in full via ${method}`, notes: `$${amount.toLocaleString()}` });
    }

    setPayingInvoice(null);
    toast.success(newStatus === "paid" ? "Invoice marked as paid!" : `Payment of $${amount.toLocaleString()} recorded`);
  };

  const markPaid = (inv) => updateMut.mutate({ id: inv.id, data: { status: "paid", amount_paid: inv.total, balance_due: 0 } });

  const filtered = invoices.filter(inv =>
    (inv.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (inv.invoice_number || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = invoices.filter(i => i.status !== "paid" && i.status !== "void").reduce((s, i) => s + (i.balance_due || 0), 0);
  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + (i.balance_due || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1">Track payments and outstanding balances.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" />New Invoice</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><DollarSign className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-xl font-bold">${totalOutstanding.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100"><AlertCircle className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-xl font-bold text-red-600">${totalOverdue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Invoices</p>
              <p className="text-xl font-bold">{invoices.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No invoices found</p>
          <p className="text-sm mt-1">Create your first invoice to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => (
            <Card key={inv.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-muted shrink-0">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{inv.invoice_number || "—"}</p>
                        <Badge className={STATUS_STYLES[inv.status]}>{STATUS_LABELS[inv.status]}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{inv.customer_name}</p>
                      {inv.due_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Due: {format(new Date(inv.due_date), "MMM d, yyyy")}
                          {inv.status === "overdue" && <span className="text-red-500 ml-1">OVERDUE</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="font-bold">${(inv.total || 0).toLocaleString()}</p>
                      {inv.balance_due > 0 && inv.status !== "paid" && (
                        <p className="text-xs text-muted-foreground">Due: ${inv.balance_due.toLocaleString()}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditing(inv)}>
                          <Eye className="w-4 h-4 mr-2" />Edit
                        </DropdownMenuItem>
                        {inv.status !== "paid" && inv.status !== "void" && (
                          <DropdownMenuItem onClick={() => setPayingInvoice(inv)}>
                            <CreditCard className="w-4 h-4 mr-2" />Record Payment
                          </DropdownMenuItem>
                        )}
                        {inv.status !== "paid" && (
                          <DropdownMenuItem onClick={() => markPaid(inv)}>
                            <CheckCircle2 className="w-4 h-4 mr-2" />Mark Fully Paid
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => { if (confirm("Delete this invoice?")) deleteMut.mutate(inv.id); }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {payingInvoice && (
        <RecordPaymentDialog
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSave={(data) => recordPayment(payingInvoice, data)}
        />
      )}
      {(showForm || editing) && (
        <InvoiceDialog
          invoice={editing}
          customers={customers}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={(data) => {
            if (editing) updateMut.mutate({ id: editing.id, data });
            else createMut.mutate(data);
          }}
        />
      )}
    </div>
  );
}