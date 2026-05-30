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
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Phone, Mail, Pencil, Trash2, MapPin, DollarSign, Percent, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const POSITION_LABELS = {
  salesperson: "Salesperson",
  crew_leader: "Crew Leader",
  climber: "Climber",
  groundman: "Groundman",
  stump_grinder: "Stump Grinder",
};

const POSITION_COLORS = {
  salesperson: "bg-blue-100 text-blue-800",
  crew_leader: "bg-green-100 text-green-800",
  climber: "bg-teal-100 text-teal-800",
  groundman: "bg-orange-100 text-orange-800",
  stump_grinder: "bg-purple-100 text-purple-800",
};

// Which pay types are valid per position
const PAY_TYPES_BY_POSITION = {
  salesperson: ["commission"],
  crew_leader: ["hourly", "daily", "salary", "hourly_plus_commission", "daily_plus_commission", "salary_plus_commission"],
  climber: ["hourly", "daily", "salary"],
  groundman: ["hourly", "daily"],
  stump_grinder: ["per_stump", "hourly"],
};

const PAY_TYPE_LABELS = {
  hourly: "Hourly",
  daily: "Daily",
  salary: "Salary",
  commission: "Commission %",
  per_stump: "Per Stump",
  hourly_plus_commission: "Hourly + Commission",
  daily_plus_commission: "Daily + Commission",
  salary_plus_commission: "Salary + Commission",
};

const DEFAULT_STUMP_RATES = [
  { size_label: "Small (0–12 in)", min_inches: 0, max_inches: 12, rate: "" },
  { size_label: "Medium (13–24 in)", min_inches: 13, max_inches: 24, rate: "" },
  { size_label: "Large (25–36 in)", min_inches: 25, max_inches: 36, rate: "" },
  { size_label: "Extra Large (37+ in)", min_inches: 37, max_inches: 99, rate: "" },
];

const emptyForm = {
  first_name: "",
  last_name: "",
  position: "",
  phone: "",
  email: "",
  address: "",
  date_of_birth: "",
  ssn_last4: "",
  hire_date: "",
  status: "active",
  pay_type: "hourly",
  pay_rate: "",
  commission_percent: "",
  can_sell: false,
  sales_commission_percent: "",
  stump_rates: DEFAULT_STUMP_RATES,
  notes: "",
};

function PayDisplay({ emp }) {
  if (!emp.pay_type) return null;
  if (emp.pay_type === "commission") return <span className="text-foreground font-medium">{emp.commission_percent ?? "?"}% commission</span>;
  if (emp.pay_type === "per_stump") return <span className="text-foreground font-medium">Per stump</span>;
  if (emp.pay_type === "hourly_plus_commission") return <span className="text-foreground font-medium">${emp.pay_rate}/hr + {emp.commission_percent}% comm</span>;
  if (emp.pay_type === "daily_plus_commission") return <span className="text-foreground font-medium">${emp.pay_rate}/day + {emp.commission_percent}% comm</span>;
  if (emp.pay_type === "salary_plus_commission") return <span className="text-foreground font-medium">${(emp.pay_rate || 0).toLocaleString()}/yr + {emp.commission_percent}% comm</span>;
  if (emp.pay_type === "hourly") return <span className="text-foreground font-medium">${emp.pay_rate}/hr</span>;
  if (emp.pay_type === "daily") return <span className="text-foreground font-medium">${emp.pay_rate}/day</span>;
  if (emp.pay_type === "salary") return <span className="text-foreground font-medium">${(emp.pay_rate || 0).toLocaleString()}/yr</span>;
  return null;
}

function EmployeeForm({ editing, onSave, onClose, isSaving }) {
  const [form, setForm] = useState(() => {
    if (editing) {
      return {
        ...emptyForm,
        ...editing,
        pay_rate: editing.pay_rate ?? "",
        commission_percent: editing.commission_percent ?? "",
        sales_commission_percent: editing.sales_commission_percent ?? "",
        stump_rates: editing.stump_rates?.length ? editing.stump_rates.map(r => ({ ...r, rate: r.rate ?? "" })) : DEFAULT_STUMP_RATES,
      };
    }
    return { ...emptyForm };
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handlePositionChange = (pos) => {
    const validTypes = PAY_TYPES_BY_POSITION[pos] || ["hourly"];
    const currentTypeValid = validTypes.includes(form.pay_type);
    setForm(f => ({
      ...f,
      position: pos,
      pay_type: currentTypeValid ? f.pay_type : validTypes[0],
      can_sell: pos === "crew_leader" ? f.can_sell : false,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.position) {
      toast.error("First name, last name, and position are required.");
      return;
    }
    const data = {
      ...form,
      pay_rate: form.pay_rate !== "" ? Number(form.pay_rate) : undefined,
      commission_percent: form.commission_percent !== "" ? Number(form.commission_percent) : undefined,
      sales_commission_percent: form.sales_commission_percent !== "" ? Number(form.sales_commission_percent) : undefined,
      stump_rates: form.position === "stump_grinder"
        ? form.stump_rates.map(r => ({ ...r, rate: r.rate !== "" ? Number(r.rate) : 0 }))
        : undefined,
    };
    onSave(data);
  };

  const validPayTypes = PAY_TYPES_BY_POSITION[form.position] || Object.keys(PAY_TYPE_LABELS);
  const isCommission = form.pay_type === "commission";
  const hasBase = ["hourly", "daily", "salary", "hourly_plus_commission", "daily_plus_commission", "salary_plus_commission", "per_stump"].includes(form.pay_type);
  const hasCommission = ["commission", "hourly_plus_commission", "daily_plus_commission", "salary_plus_commission"].includes(form.pay_type);

  const baseLabel = form.pay_type.includes("hourly") ? "Hourly Rate ($)"
    : form.pay_type.includes("daily") ? "Daily Rate ($)"
    : form.pay_type === "salary" || form.pay_type === "salary_plus_commission" ? "Annual Salary ($)"
    : form.pay_type === "per_stump" ? "N/A"
    : "Rate ($)";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
      {/* Name */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>First Name *</Label>
          <Input value={form.first_name} onChange={e => set("first_name", e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Last Name *</Label>
          <Input value={form.last_name} onChange={e => set("last_name", e.target.value)} required />
        </div>
      </div>

      {/* Position */}
      <div className="space-y-1">
        <Label>Position *</Label>
        <Select value={form.position} onValueChange={handlePositionChange}>
          <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
          <SelectContent>
            {Object.entries(POSITION_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Phone</Label>
          <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1">
        <Label>Home Address</Label>
        <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Main St, City, State, ZIP" />
      </div>

      {/* Personal Info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Date of Birth</Label>
          <Input type="date" value={form.date_of_birth} onChange={e => set("date_of_birth", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>SSN Last 4 Digits</Label>
          <Input value={form.ssn_last4} maxLength={4} placeholder="XXXX"
            onChange={e => set("ssn_last4", e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </div>
      </div>

      {/* Dates & Status */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Hire Date</Label>
          <Input type="date" value={form.hire_date} onChange={e => set("hire_date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pay Structure */}
      {form.position && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pay Structure</p>

          {form.position === "salesperson" && (
            <p className="text-xs text-muted-foreground">Salespersons are paid solely on commission.</p>
          )}

          <div className="space-y-1">
            <Label>Pay Type</Label>
            <Select value={form.pay_type} onValueChange={v => set("pay_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {validPayTypes.map(pt => (
                  <SelectItem key={pt} value={pt}>{PAY_TYPE_LABELS[pt]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Base rate — show for non-commission, non-per-stump */}
          {hasBase && form.pay_type !== "per_stump" && (
            <div className="space-y-1">
              <Label>{baseLabel}</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input className="pl-7" type="number" min="0" step="0.01" value={form.pay_rate}
                  onChange={e => set("pay_rate", e.target.value)} placeholder="0.00" />
              </div>
            </div>
          )}

          {/* Commission % */}
          {hasCommission && (
            <div className="space-y-1">
              <Label>Commission %</Label>
              <div className="relative">
                <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input className="pl-7" type="number" min="0" max="100" step="0.1" value={form.commission_percent}
                  onChange={e => set("commission_percent", e.target.value)} placeholder="e.g. 10" />
              </div>
              <p className="text-xs text-muted-foreground">Percentage of the job total paid as commission</p>
            </div>
          )}

          {/* Stump rates table */}
          {form.pay_type === "per_stump" && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Rate per stump by size</p>
              <div className="space-y-2">
                {form.stump_rates.map((sr, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs flex-1 text-foreground">{sr.size_label}</span>
                    <div className="relative w-28">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input className="pl-6 h-8 text-sm" type="number" min="0" step="0.01"
                        value={sr.rate}
                        onChange={e => {
                          const updated = [...form.stump_rates];
                          updated[i] = { ...updated[i], rate: e.target.value };
                          set("stump_rates", updated);
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">/stump</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Crew leader can-sell toggle */}
          {form.position === "crew_leader" && (
            <div className="pt-1 border-t space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Can sell jobs</p>
                  <p className="text-xs text-muted-foreground">Earns sales commission when they close a job</p>
                </div>
                <Switch checked={form.can_sell} onCheckedChange={v => set("can_sell", v)} />
              </div>
              {form.can_sell && (
                <div className="space-y-1">
                  <Label>Sales Commission %</Label>
                  <div className="relative">
                    <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input className="pl-7" type="number" min="0" max="100" step="0.1" value={form.sales_commission_percent}
                      onChange={e => set("sales_commission_percent", e.target.value)} placeholder="e.g. 5" />
                  </div>
                  <p className="text-xs text-muted-foreground">Applied on jobs they sold (tracked separately from work commission)</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1">
        <Label>Notes</Label>
        <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isSaving}>
          {editing ? "Save Changes" : "Add Employee"}
        </Button>
      </div>
    </form>
  );
}

export default function Employees() {
  const [search, setSearch] = useState("");
  const [filterPosition, setFilterPosition] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setShowForm(false);
      toast.success("Employee added");
    },
    onError: () => toast.error("Failed to add employee"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setShowForm(false);
      setEditing(null);
      toast.success("Employee updated");
    },
    onError: () => toast.error("Failed to update employee"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); toast.success("Employee removed"); },
    onError: () => toast.error("Failed to delete employee"),
  });

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit = (emp) => { setEditing(emp); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSave = (data) => {
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground text-sm mt-1">{employees.filter(e => e.status === "active").length} active employees</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link to="/payroll"><Receipt className="w-4 h-4" />Payroll</Link>
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Add Employee
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(POSITION_LABELS).map(([pos, label]) => (
          <Card key={pos} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilterPosition(filterPosition === pos ? "all" : pos)}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{counts[pos]}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}s</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search employees..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterPosition} onValueChange={setFilterPosition}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Positions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            {Object.entries(POSITION_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
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
                    <Badge className={emp.status === "active" ? "bg-emerald-100 text-emerald-800" : emp.status === "terminated" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"}>
                      {emp.status}
                    </Badge>
                    {emp.can_sell && <Badge className="bg-yellow-100 text-yellow-800">Can Sell</Badge>}
                  </div>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                    {emp.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{emp.phone}</span>}
                    {emp.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{emp.email}</span>}
                    {emp.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{emp.address.split(",")[0]}</span>}
                    <PayDisplay emp={emp} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                    onClick={() => { if (confirm(`Remove ${emp.first_name} ${emp.last_name}?`)) deleteMutation.mutate(emp.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <EmployeeForm editing={editing} onSave={handleSave} onClose={closeForm} isSaving={isSaving} />
        </DialogContent>
      </Dialog>
    </div>
  );
}