import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Wrench, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isWithinInterval, addDays } from "date-fns";

const TYPE_LABELS = {
  oil_change: "Oil Change", filter_replacement: "Filter Replacement", blade_sharpening: "Blade Sharpening",
  inspection: "Inspection", repair: "Repair", overhaul: "Overhaul", other: "Other",
};

function MaintenanceForm({ open, onOpenChange, onSubmit, equipment = [], initialData }) {
  const [form, setForm] = useState(initialData || {
    equipment_id: "", maintenance_type: "inspection", description: "",
    cost: "", performed_by: "", performed_at: new Date().toISOString().split("T")[0],
    hours_at_service: "", next_due_date: "", next_due_hours: "", notes: "", status: "completed",
  });
  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.equipment_id) { toast.error("Please select equipment"); return; }
    const eq = equipment.find(e => e.id === form.equipment_id);
    onSubmit({ ...form, equipment_name: eq ? eq.name : "", cost: parseFloat(form.cost) || 0 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initialData ? "Edit Record" : "Log Maintenance"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Equipment *</Label>
            <Select value={form.equipment_id} onValueChange={v => update("equipment_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
              <SelectContent>{equipment.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.maintenance_type} onValueChange={v => update("maintenance_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={e => update("description", e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date Performed</Label><Input type="date" value={form.performed_at} onChange={e => update("performed_at", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Cost ($)</Label><Input type="number" min="0" step="0.01" value={form.cost} onChange={e => update("cost", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Performed By</Label><Input value={form.performed_by} onChange={e => update("performed_by", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Hours at Service</Label><Input type="number" value={form.hours_at_service} onChange={e => update("hours_at_service", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Next Due Date</Label><Input type="date" value={form.next_due_date} onChange={e => update("next_due_date", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Next Due Hours</Label><Input type="number" value={form.next_due_hours} onChange={e => update("next_due_hours", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => update("notes", e.target.value)} rows={2} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{initialData ? "Update" : "Log Maintenance"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function EquipmentMaintenance() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");
  const qc = useQueryClient();

  const { data: records = [], isLoading } = useQuery({ queryKey: ["maintenance"], queryFn: () => base44.entities.MaintenanceRecord.list("-created_date") });
  const { data: equipment = [] } = useQuery({ queryKey: ["equipment"], queryFn: () => base44.entities.Equipment.list() });

  const createMutation = useMutation({
    mutationFn: async (d) => {
      const rec = await base44.entities.MaintenanceRecord.create(d);
      // Update equipment's last/next maintenance dates
      if (d.equipment_id) {
        const update = {};
        if (d.performed_at) update.last_maintenance = d.performed_at;
        if (d.next_due_date) update.next_maintenance = d.next_due_date;
        if (d.hours_at_service) update.hours_used = parseFloat(d.hours_at_service) || 0;
        await base44.entities.Equipment.update(d.equipment_id, update);
      }
      return rec;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["equipment"] });
      setShowForm(false);
      toast.success("Maintenance logged");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MaintenanceRecord.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance"] }); setEditing(null); toast.success("Updated"); },
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.MaintenanceRecord.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["maintenance"] }); toast.success("Deleted"); },
  });

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${r.equipment_name} ${r.description} ${r.performed_by} ${r.maintenance_type}`.toLowerCase().includes(q);
    const matchEq = !filterEquipment || r.equipment_id === filterEquipment;
    return matchSearch && matchEq;
  });

  const isDueSoon = (r) => r.next_due_date && isWithinInterval(new Date(r.next_due_date), { start: new Date(), end: addDays(new Date(), 30) });
  const isOverdue = (r) => r.next_due_date && isPast(new Date(r.next_due_date));

  const upcoming = records.filter(r => isDueSoon(r) || isOverdue(r)).length;
  const totalCost = records.filter(r => r.status === "completed").reduce((sum, r) => sum + (r.cost || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" /> Maintenance Records
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {records.length} records · ${totalCost.toLocaleString()} total cost
            {upcoming > 0 && <span className="text-yellow-600 ml-2">· {upcoming} service{upcoming > 1 ? "s" : ""} due soon</span>}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Log Maintenance</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search records..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterEquipment} onValueChange={setFilterEquipment}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All equipment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All equipment</SelectItem>
            {equipment.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground">No maintenance records yet</p>
          <p className="text-sm text-muted-foreground mt-1">Log maintenance to track service history and upcoming needs</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(record => (
            <Card key={record.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{record.equipment_name || "Equipment"}</h3>
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[record.maintenance_type] || record.maintenance_type}</Badge>
                    {record.status === "completed" && <Badge className="bg-green-100 text-green-700 text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Completed</Badge>}
                    {record.status === "scheduled" && <Badge className="bg-blue-100 text-blue-700 text-xs gap-1"><Clock className="w-3 h-3" />Scheduled</Badge>}
                    {record.next_due_date && isOverdue({ next_due_date: record.next_due_date }) && (
                      <Badge className="bg-red-100 text-red-700 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Service Overdue</Badge>
                    )}
                    {record.next_due_date && isDueSoon(record) && !isOverdue({ next_due_date: record.next_due_date }) && (
                      <Badge className="bg-yellow-100 text-yellow-700 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Due Soon</Badge>
                    )}
                  </div>
                  {record.description && <p className="text-sm text-muted-foreground">{record.description}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {record.performed_at && <span>Performed: {format(new Date(record.performed_at), "MMM d, yyyy")}</span>}
                    {record.performed_by && <span>By: {record.performed_by}</span>}
                    {record.cost > 0 && <span className="font-medium text-foreground">Cost: ${record.cost.toLocaleString()}</span>}
                    {record.hours_at_service && <span>{record.hours_at_service} hrs at service</span>}
                    {record.next_due_date && <span>Next due: {format(new Date(record.next_due_date), "MMM d, yyyy")}</span>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(record)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(record.id)}>Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      <MaintenanceForm open={showForm} onOpenChange={setShowForm} equipment={equipment} onSubmit={d => createMutation.mutate(d)} />
      {editing && <MaintenanceForm open={!!editing} onOpenChange={() => setEditing(null)} equipment={equipment} initialData={editing} onSubmit={d => updateMutation.mutate({ id: editing.id, data: d })} />}
    </div>
  );
}