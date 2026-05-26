import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

export default function QuoteForm({ open, onOpenChange, onSubmit, customers = [], initialData }) {
  const [form, setForm] = useState(initialData || {
    customer_id: "", customer_name: "", status: "draft",
    line_items: [{ description: "", quantity: 1, unit_price: 0, total: 0 }],
    total_amount: 0, notes: "", valid_until: "",
  });

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const updateItem = (index, field, value) => {
    const items = [...form.line_items];
    items[index] = { ...items[index], [field]: value };
    if (field === "quantity" || field === "unit_price") {
      items[index].total = (items[index].quantity || 0) * (items[index].unit_price || 0);
    }
    const total = items.reduce((sum, i) => sum + (i.total || 0), 0);
    setForm((p) => ({ ...p, line_items: items, total_amount: total }));
  };

  const addItem = () => {
    setForm((p) => ({ ...p, line_items: [...p.line_items, { description: "", quantity: 1, unit_price: 0, total: 0 }] }));
  };

  const removeItem = (index) => {
    const items = form.line_items.filter((_, i) => i !== index);
    const total = items.reduce((sum, i) => sum + (i.total || 0), 0);
    setForm((p) => ({ ...p, line_items: items, total_amount: total }));
  };

  const handleCustomerChange = (id) => {
    const customer = customers.find((c) => c.id === id);
    update("customer_id", id);
    update("customer_name", customer ? `${customer.first_name} ${customer.last_name}` : "");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, quote_number: form.quote_number || `Q-${Date.now().toString(36).toUpperCase()}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initialData ? "Edit Quote" : "New Quote"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Select value={form.customer_id} onValueChange={handleCustomerChange}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valid Until</Label>
              <Input type="date" value={form.valid_until} onChange={(e) => update("valid_until", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1"><Plus className="w-3 h-3" />Add</Button>
            </div>
            {form.line_items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5"><Input placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} /></div>
                <div className="col-span-2"><Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} /></div>
                <div className="col-span-2"><Input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", Number(e.target.value))} /></div>
                <div className="col-span-2 text-sm font-medium text-right">${(item.total || 0).toFixed(2)}</div>
                <div className="col-span-1"><Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button></div>
              </div>
            ))}
            <div className="text-right text-lg font-bold">Total: ${form.total_amount.toFixed(2)}</div>
          </div>

          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{initialData ? "Update" : "Create"} Quote</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}