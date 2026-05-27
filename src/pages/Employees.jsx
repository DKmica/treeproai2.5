import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Phone, Mail, Pencil, Trash2 } from "lucide-react";

const POSITION_LABELS = {
  salesperson: "Salesperson",
  crew_leader: "Crew Leader",
  groundman: "Groundman",
  stump_grinder: "Stump Grinder",
};

const POSITION_COLORS = {
  salesperson: "bg-blue-100 text-blue-800",
  crew_leader: "bg-green-100 text-green-800",
  groundman: "bg-orange-100 text-orange-800",
  stump_grinder: "bg-purple-100 text-purple-800",
};

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-800",
  inactive: "bg-red-100 text-red-800",
};

const emptyForm = {
  first_name: "",
  last_name: "",
  position: "",
  phone: "",
  email: "",
  hire_date: "",
  status: "active",
  pay_rate: "",
  pay_type: "hourly",
  notes: "",
};

export default function Employees() {
  const [search, setSearch] = useState("");
  const [filterPosition, setFilterPosition] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (emp) => { setEditing(emp); setForm({ ...emp, pay_rate: emp.pay_rate ?? "" }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...form, pay_rate: form.pay_rate !== "" ? Number(form.pay_rate) : undefined };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filtered = employees.filter((emp) => {
    const name = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || emp.phone?.includes(search);
    const matchPos = filterPosition === "all" || emp.position === filterPosition;
    return matchSearch && matchPos;
  });

  const counts = Object.keys(POSITION_LABELS).reduce((acc, pos) => {
    acc[pos] = employees.filter(e => e.position === pos && e.status === "active").length;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground text-sm mt-1">{employees.filter(e => e.status === "active").length} active employees</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> Add Employee
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {Object.entries(POSITION_LABELS).map(([pos, label]) => (
          <Card key={pos} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterPosition(filterPosition === pos ? "all" : pos)}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{counts[pos]}</p>
              <p className="text-sm text-muted-foreground mt-1">{label}s</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search employees..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterPosition} onValueChange={setFilterPosition}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Positions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            {Object.entries(POSITION_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Employee List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No employees found</p>
          <p className="text-sm mt-1">Add your first employee to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((emp) => (
            <Card key={emp.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary flex-shrink-0">
                  {emp.first_name[0]}{emp.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{emp.first_name} {emp.last_name}</span>
                    <Badge className={POSITION_COLORS[emp.position]}>{POSITION_LABELS[emp.position]}</Badge>
                    <Badge className={STATUS_COLORS[emp.status]}>{emp.status === "active" ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                    {emp.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{emp.phone}</span>}
                    {emp.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{emp.email}</span>}
                    {emp.pay_rate && <span className="text-foreground font-medium">${emp.pay_rate}/{emp.pay_type === "hourly" ? "hr" : emp.pay_type === "daily" ? "day" : emp.pay_type}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(emp.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name *</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Last Name *</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Position *</Label>
              <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(POSITION_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Hire Date</Label>
                <Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Pay Rate ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.pay_rate} onChange={(e) => setForm({ ...form, pay_rate: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label>Pay Type</Label>
                <Select value={form.pay_type} onValueChange={(v) => setForm({ ...form, pay_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Save Changes" : "Add Employee"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}