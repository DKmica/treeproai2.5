import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function JobForm({ open, onOpenChange, onSubmit, customers = [], crews = [], initialData }) {
  const [form, setForm] = useState(initialData || {
    customer_id: "", customer_name: "", description: "", address: "",
    scheduled_date: "", crew_id: "", crew_name: "", total_cost: 0, status: "scheduled", notes: "",
  });

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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{initialData ? "Update" : "Schedule"} Job</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}