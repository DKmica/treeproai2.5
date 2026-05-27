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
import { Plus, Search, MoreVertical, TreePine, MapPin, AlertTriangle, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const CONDITION_COLORS = {
  excellent: "bg-green-100 text-green-700",
  good: "bg-emerald-100 text-emerald-700",
  fair: "bg-yellow-100 text-yellow-700",
  poor: "bg-orange-100 text-orange-700",
  dead: "bg-gray-100 text-gray-600",
  hazardous: "bg-red-100 text-red-700",
};

const RISK_COLORS = {
  low: "bg-green-50 text-green-700",
  moderate: "bg-yellow-50 text-yellow-700",
  high: "bg-orange-50 text-orange-700",
  extreme: "bg-red-50 text-red-700",
};

function TreeForm({ open, onOpenChange, onSubmit, customers = [], initialData }) {
  const [form, setForm] = useState(initialData || {
    customer_id: "", species: "", condition: "good", risk_level: "low",
    location_description: "", height_estimate_ft: "", dbh_inches: "", canopy_spread_ft: "",
    recommended_next_service: "", notes: "", address: "",
  });
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState(initialData?.photos || []);

  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    setPhotos(p => [...p, ...urls]);
    setUploading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, photos });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initialData ? "Edit Tree Record" : "Add Tree"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <Select value={form.customer_id} onValueChange={v => update("customer_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Species</Label><Input value={form.species} onChange={e => update("species", e.target.value)} placeholder="e.g. Red Oak" /></div>
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={form.condition} onValueChange={v => update("condition", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["excellent","good","fair","poor","dead","hazardous"].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Risk Level</Label>
              <Select value={form.risk_level} onValueChange={v => update("risk_level", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low","moderate","high","extreme"].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Height (ft)</Label><Input type="number" value={form.height_estimate_ft} onChange={e => update("height_estimate_ft", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>DBH (inches)</Label><Input type="number" value={form.dbh_inches} onChange={e => update("dbh_inches", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Canopy Spread (ft)</Label><Input type="number" value={form.canopy_spread_ft} onChange={e => update("canopy_spread_ft", e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Address / Property</Label><Input value={form.address} onChange={e => update("address", e.target.value)} placeholder="Property address" /></div>
          <div className="space-y-1.5"><Label>Location on Property</Label><Input value={form.location_description} onChange={e => update("location_description", e.target.value)} placeholder="e.g. Front yard near driveway" /></div>
          <div className="space-y-1.5"><Label>Recommended Next Service</Label><Input value={form.recommended_next_service} onChange={e => update("recommended_next_service", e.target.value)} placeholder="e.g. Crown cleaning in spring" /></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => update("notes", e.target.value)} rows={2} /></div>

          {/* Photo upload */}
          <div className="space-y-2">
            <Label>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border" />
                  <button type="button" onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100">×</button>
                </div>
              ))}
              <label className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:bg-muted/50">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4 text-muted-foreground" />}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{initialData ? "Update" : "Add Tree"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TreeInventory() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const qc = useQueryClient();

  const { data: trees = [], isLoading } = useQuery({ queryKey: ["trees"], queryFn: () => base44.entities.TreeRecord.list("-created_date") });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => base44.entities.Customer.list() });

  const createMutation = useMutation({
    mutationFn: d => base44.entities.TreeRecord.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trees"] }); setShowForm(false); toast.success("Tree added"); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TreeRecord.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trees"] }); setEditing(null); toast.success("Updated"); },
  });
  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.TreeRecord.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["trees"] }); toast.success("Deleted"); },
  });

  const filtered = trees.filter(t => {
    const q = search.toLowerCase();
    const matchesSearch = !q || `${t.species} ${t.address} ${t.location_description} ${t.notes}`.toLowerCase().includes(q);
    const matchesCustomer = !filterCustomer || t.customer_id === filterCustomer;
    return matchesSearch && matchesCustomer;
  });

  const getCustomerName = (id) => {
    const c = customers.find(c => c.id === id);
    return c ? `${c.first_name} ${c.last_name}` : "Unknown";
  };

  const hazardous = trees.filter(t => t.risk_level === "extreme" || t.condition === "hazardous").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TreePine className="w-6 h-6 text-primary" /> Tree Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{trees.length} trees tracked{hazardous > 0 && ` · ${hazardous} hazardous`}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Add Tree</Button>
      </div>

      {hazardous > 0 && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{hazardous}</strong> tree{hazardous > 1 ? "s" : ""} flagged as extreme risk or hazardous — review immediately</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search trees..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCustomer} onValueChange={setFilterCustomer}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All customers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All customers</SelectItem>
            {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <TreePine className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground">No trees found</p>
          <p className="text-sm text-muted-foreground mt-1">Add trees from this page or they'll be linked from AI analysis records</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(tree => (
            <Card key={tree.id} className="overflow-hidden hover:shadow-md transition-shadow">
              {tree.photos?.length > 0 && (
                <img src={tree.photos[0]} alt="" className="w-full h-32 object-cover" />
              )}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{tree.species || "Unknown Species"}</h3>
                      <Badge className={CONDITION_COLORS[tree.condition]}>{tree.condition}</Badge>
                      {tree.risk_level !== "low" && <Badge className={RISK_COLORS[tree.risk_level]}>{tree.risk_level} risk</Badge>}
                    </div>
                    <p className="text-xs text-primary mt-0.5">{getCustomerName(tree.customer_id)}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="shrink-0"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing(tree)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        const addr = encodeURIComponent(tree.address || "");
                        if (addr) window.open(`https://maps.google.com/?q=${addr}`, "_blank");
                        else toast.info("No address on this tree record");
                      }}>
                        <MapPin className="w-4 h-4 mr-2" />Open in Maps
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(tree.id)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="text-xs text-muted-foreground space-y-0.5">
                  {tree.address && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{tree.address}</p>}
                  {tree.location_description && <p>{tree.location_description}</p>}
                  <div className="flex gap-3 mt-1">
                    {tree.height_estimate_ft && <span>~{tree.height_estimate_ft}ft tall</span>}
                    {tree.dbh_inches && <span>{tree.dbh_inches}" DBH</span>}
                    {tree.canopy_spread_ft && <span>{tree.canopy_spread_ft}ft canopy</span>}
                  </div>
                </div>

                {tree.recommended_next_service && (
                  <p className="text-xs bg-primary/5 text-primary px-2 py-1 rounded-md">
                    Recommended: {tree.recommended_next_service}
                  </p>
                )}

                {tree.last_service_date && (
                  <p className="text-xs text-muted-foreground">
                    Last service: {format(new Date(tree.last_service_date), "MMM d, yyyy")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TreeForm open={showForm} onOpenChange={setShowForm} customers={customers} onSubmit={d => createMutation.mutate(d)} />
      {editing && <TreeForm open={!!editing} onOpenChange={() => setEditing(null)} customers={customers} initialData={editing} onSubmit={d => updateMutation.mutate({ id: editing.id, data: d })} />}
    </div>
  );
}