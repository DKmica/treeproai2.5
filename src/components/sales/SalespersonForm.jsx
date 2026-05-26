import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const SPECIALTY_OPTIONS = ["emergency", "residential", "commercial", "large trees", "trimming", "stump grinding", "cabling"];

export default function SalespersonForm({ open, onOpenChange, initialData, onSubmit }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", territory: "", status: "active", max_leads: 10, specialties: [], notes: "" });
  const [specialtyInput, setSpecialtyInput] = useState("");

  useEffect(() => {
    if (initialData) setForm({ ...initialData });
    else setForm({ name: "", email: "", phone: "", territory: "", status: "active", max_leads: 10, specialties: [], notes: "" });
  }, [initialData, open]);

  const addSpecialty = (val) => {
    const v = val.trim().toLowerCase();
    if (v && !form.specialties?.includes(v)) {
      setForm((f) => ({ ...f, specialties: [...(f.specialties || []), v] }));
    }
    setSpecialtyInput("");
  };

  const removeSpecialty = (s) => setForm((f) => ({ ...f, specialties: f.specialties.filter((x) => x !== s) }));

  const handleSubmit = (e) => { e.preventDefault(); onSubmit(form); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Salesperson" : "Add Salesperson"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Territory</Label>
              <Input placeholder="e.g. North Dallas" value={form.territory || ""} onChange={(e) => setForm({ ...form, territory: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Max Leads</Label>
              <Input type="number" min={1} value={form.max_leads || 10} onChange={(e) => setForm({ ...form, max_leads: Number(e.target.value) })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Specialties</Label>
              <div className="flex flex-wrap gap-1 mb-1">
                {(form.specialties || []).map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeSpecialty(s)}>
                    {s} <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
              <Select onValueChange={addSpecialty} value="">
                <SelectTrigger><SelectValue placeholder="Add specialty..." /></SelectTrigger>
                <SelectContent>
                  {SPECIALTY_OPTIONS.filter((s) => !(form.specialties || []).includes(s)).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{initialData ? "Save Changes" : "Add Salesperson"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}