import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Wrench, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import MaintenanceDashboard from "@/components/equipment/MaintenanceDashboard";

const TYPES = ["chainsaw", "chipper", "stump_grinder", "bucket_truck", "crane", "climbing_gear", "other"];
const STATUS_COLORS = {
  operational: "bg-green-100 text-green-700",
  maintenance: "bg-yellow-100 text-yellow-700",
  repair: "bg-red-100 text-red-700",
  retired: "bg-muted text-muted-foreground",
};

function EquipmentForm({ open, onOpenChange, onSubmit, crews = [], initialData }) {
  const [form, setForm] = useState(initialData || {
    name: "", type: "chainsaw", serial_number: "", status: "operational",
    assigned_crew: "", purchase_date: "", last_maintenance: "", next_maintenance: "", hours_used: 0, notes: "",
  });
  const update = (f, v) => setForm((p) => ({ ...p, [f]: v }));
  const handleSubmit = (e) => { e.preventDefault(); onSubmit(form); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initialData ? "Edit Equipment" : "Add Equipment"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => update("name", e.target.value)} required /></div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => update("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Serial Number</Label><Input value={form.serial_number} onChange={(e) => update("serial_number", e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Assigned Crew</Label>
            <Select value={form.assigned_crew} onValueChange={(v) => update("assigned_crew", v)}>
              <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>{crews.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={(e) => update("purchase_date", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Last Service</Label><Input type="date" value={form.last_maintenance} onChange={(e) => update("last_maintenance", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Next Service</Label><Input type="date" value={form.next_maintenance} onChange={(e) => update("next_maintenance", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Hours Used</Label><Input type="number" min="0" value={form.hours_used} onChange={(e) => update("hours_used", Number(e.target.value))} /></div>
            <div className="space-y-1.5">
              <Label>Maint. Interval (hrs)</Label>
              <Input type="number" min="0" placeholder="e.g. 50" value={form.maintenance_interval_hours || ""} onChange={(e) => update("maintenance_interval_hours", Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>Hrs at Last Service</Label>
              <Input type="number" min="0" placeholder="0" value={form.hours_at_last_maintenance || ""} onChange={(e) => update("hours_at_last_maintenance", Number(e.target.value) || 0)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{initialData ? "Update" : "Add"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Equipment() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: equipment = [], isLoading } = useQuery({ queryKey: ["equipment"], queryFn: () => base44.entities.Equipment.list("-created_date") });
  const { data: crews = [] } = useQuery({ queryKey: ["crews"], queryFn: () => base44.entities.Crew.list() });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Equipment.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["equipment"] }); setShowForm(false); toast.success("Equipment added"); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Equipment.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["equipment"] }); setEditing(null); toast.success("Updated"); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Equipment.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["equipment"] }); toast.success("Deleted"); },
  });

  const filtered = equipment.filter((e) => {
    const q = search.toLowerCase();
    return !q || `${e.name} ${e.type} ${e.serial_number} ${e.assigned_crew}`.toLowerCase().includes(q);
  });

  const needsMaintenance = (item) => item.next_maintenance && new Date(item.next_maintenance) < new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipment</h1>
          <p className="text-sm text-muted-foreground mt-1">{equipment.length} items tracked</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Add Equipment</Button>
      </div>

      <MaintenanceDashboard equipment={equipment} onEditItem={(item) => setEditing(item)} />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search equipment..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center"><p className="text-muted-foreground">No equipment found</p></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((item) => (
            <Card key={item.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setEditing(item)}>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold">{item.name}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{item.type?.replace(/_/g, " ")}</Badge>
                    <Badge className={STATUS_COLORS[item.status]}>{item.status}</Badge>
                    {needsMaintenance(item) && <Badge className="bg-red-50 text-red-600 gap-1"><AlertTriangle className="w-3 h-3" />Overdue</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {item.assigned_crew && <p>Crew: {item.assigned_crew}</p>}
                    {item.hours_used > 0 && <p className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.hours_used} hrs</p>}
                    {item.next_maintenance && <p>Next service: {format(new Date(item.next_maintenance), "MMM d, yyyy")}</p>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" onClick={e => e.stopPropagation()}><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(item)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateMutation.mutate({ id: item.id, data: { status: "maintenance" } })}>Send to Maintenance</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(item.id)}>Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EquipmentForm open={showForm} onOpenChange={setShowForm} crews={crews} onSubmit={(d) => createMutation.mutate(d)} />
      {editing && <EquipmentForm open={!!editing} onOpenChange={() => setEditing(null)} crews={crews} initialData={editing} onSubmit={(d) => updateMutation.mutate({ id: editing.id, data: d })} />}
    </div>
  );
}