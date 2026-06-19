import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Truck, PenLine } from "lucide-react";

export default function JobForm({ open, onOpenChange, onSubmit, customers = [], crews = [], initialData }) {
  const [form, setForm] = useState(initialData || {
    customer_id: "", customer_name: "", description: "", address: "",
    scheduled_date: "", crew_id: "", crew_name: "", total_cost: 0, status: "scheduled", notes: "",
    dump_expense_chips: 0, dump_expense_wood: 0,
  });

  const { data: settingsList = [] } = useQuery({
    queryKey: ["company_settings"],
    queryFn: () => base44.entities.CompanySettings.list(),
    enabled: open,
  });
  const settings = settingsList[0] || {};
  const chipsMin = settings.dump_fee_chips_min || 50;
  const woodMin = settings.dump_fee_wood_min || 100;

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleCustomerChange = (id) => {
    const c = customers.find((c) => c.id === id);
    setForm((p) => ({ ...p, customer_id: id, customer_name: c ? `${c.first_name} ${c.last_name}` : "", address: c?.address || p.address }));
  };

  const handleCrewChange = (id) => {
    const crew = crews.find((c) => c.id === id);
    setForm((p) => ({ ...p, crew_id: id, crew_name: crew?.name || "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initialData ? "Edit Job" : "Schedule Job"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <Select value={form.customer_id} onValueChange={handleCustomerChange}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Description *</Label><Textarea value={form.description} onChange={(e) => update("description", e.target.value)} required rows={2} /></div>
          <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => update("address", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Scheduled Date</Label><Input type="date" value={form.scheduled_date} onChange={(e) => update("scheduled_date", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Total Cost ($)</Label><Input type="number" min="0" step="0.01" value={form.total_cost} onChange={(e) => update("total_cost", Number(e.target.value))} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Assign Crew</Label>
            <Select value={form.crew_id} onValueChange={handleCrewChange}>
              <SelectTrigger><SelectValue placeholder="Select crew" /></SelectTrigger>
              <SelectContent>
                {crews.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2} /></div>

          {/* Dump Fee Expense Tracking */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wider">
              <Truck className="w-3.5 h-3.5" /> Dump Fee Expenses
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Chips Dump Cost ($)
                  <span className="text-muted-foreground font-normal ml-1">(est. min ${chipsMin}/load)</span>
                </Label>
                <Input
                  type="number" min="0" step="0.01"
                  placeholder="0.00"
                  value={form.dump_expense_chips || ""}
                  onChange={(e) => update("dump_expense_chips", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Wood Dump Cost ($)
                  <span className="text-muted-foreground font-normal ml-1">(est. min ${woodMin}/load)</span>
                </Label>
                <Input
                  type="number" min="0" step="0.01"
                  placeholder="0.00"
                  value={form.dump_expense_wood || ""}
                  onChange={(e) => update("dump_expense_wood", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            {((form.dump_expense_chips || 0) + (form.dump_expense_wood || 0)) > 0 && (
              <p className="text-xs text-muted-foreground">
                Total dump expenses: <span className="font-semibold text-foreground">${((form.dump_expense_chips || 0) + (form.dump_expense_wood || 0)).toFixed(2)}</span>
              </p>
            )}
          </div>

          {/* Customer Signature (read-only audit display) */}
          {initialData?.customer_signature_url && (
            <div className="border rounded-lg p-3 space-y-2 bg-green-50 border-green-200">
              <p className="text-xs font-semibold flex items-center gap-1.5 text-green-800 uppercase tracking-wider">
                <PenLine className="w-3.5 h-3.5" /> Customer Signature
              </p>
              <img
                src={initialData.customer_signature_url}
                alt="Customer signature"
                className="w-full max-h-24 object-contain bg-white border border-green-100 rounded p-1"
              />
              <div className="text-xs text-green-700 space-y-0.5">
                {initialData.customer_signature_signed_by && <p>Signed by: <span className="font-medium">{initialData.customer_signature_signed_by}</span></p>}
                {initialData.customer_signature_signed_at && <p>Date: <span className="font-medium">{new Date(initialData.customer_signature_signed_at).toLocaleString()}</span></p>}
                {initialData.customer_signature_salesperson && <p>Salesperson: <span className="font-medium">{initialData.customer_signature_salesperson}</span></p>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{initialData ? "Update" : "Schedule"} Job</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}