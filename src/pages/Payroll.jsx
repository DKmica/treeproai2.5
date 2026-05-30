import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Plus, DollarSign, Users, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronUp, Loader2, Building2, Trash2, Pencil
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-700",
  approved: "bg-blue-100 text-blue-800",
  paid: "bg-emerald-100 text-emerald-800",
  voided: "bg-red-100 text-red-700",
};

const PAY_TYPE_LABELS = {
  hourly: "Hourly",
  daily: "Daily",
  salary: "Salary",
  commission: "Commission",
  per_stump: "Per Stump",
  hourly_plus_commission: "Hourly + Commission",
  daily_plus_commission: "Daily + Commission",
  salary_plus_commission: "Salary + Commission",
};

// ─── Build a new payroll record shell from an employee ───────────────────────
function buildDraftFromEmployee(emp) {
  return {
    employee_id: emp.id,
    employee_name: `${emp.first_name} ${emp.last_name}`,
    position: emp.position,
    pay_type: emp.pay_type || "hourly",
    base_rate: emp.pay_rate || 0,
    commission_percent: emp.commission_percent || 0,
    base_hours: 0,
    overtime_hours: 0,
    base_pay: 0,
    overtime_pay: 0,
    commission_total: 0,
    sales_commission_total: 0,
    stump_pay_total: 0,
    bonuses: 0,
    deductions: 0,
    tax_withheld: 0,
    gross_pay: 0,
    net_pay: 0,
    commission_jobs: [],
    stumps_logged: [],
    payment_method: "check",
    status: "draft",
  };
}

function calcGross(record) {
  return (record.base_pay || 0) +
    (record.overtime_pay || 0) +
    (record.commission_total || 0) +
    (record.sales_commission_total || 0) +
    (record.stump_pay_total || 0) +
    (record.bonuses || 0);
}

// ─── Payroll record form ─────────────────────────────────────────────────────
function PayrollRecordForm({ employees, jobs, periodStart, periodEnd, onSave, onClose, isSaving }) {
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [form, setForm] = useState(null);
  const [expandCommission, setExpandCommission] = useState(false);
  const [expandStumps, setExpandStumps] = useState(false);

  const selectedEmp = employees.find(e => e.id === selectedEmpId);

  const handleSelectEmp = (empId) => {
    setSelectedEmpId(empId);
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      setForm(buildDraftFromEmployee(emp));
    }
  };

  const set = (key, val) => {
    setForm(f => {
      const updated = { ...f, [key]: val };
      const gross = calcGross(updated);
      return { ...updated, gross_pay: gross, net_pay: Math.max(gross - (updated.tax_withheld || 0) - (updated.deductions || 0), 0) };
    });
  };

  const updateBasePay = (hours, rate, payType) => {
    let base = 0;
    if (payType === "hourly" || payType === "hourly_plus_commission") base = Number(hours) * Number(rate);
    else if (payType === "daily" || payType === "daily_plus_commission") base = Number(hours) * Number(rate); // hours = days here
    else if (payType === "salary" || payType === "salary_plus_commission") base = Number(rate) / 26; // biweekly
    setForm(f => {
      const updated = { ...f, base_hours: Number(hours), base_rate: Number(rate), base_pay: base };
      const gross = calcGross(updated);
      return { ...updated, gross_pay: gross, net_pay: Math.max(gross - (updated.tax_withheld || 0) - (updated.deductions || 0), 0) };
    });
  };

  const addCommissionJob = () => {
    setForm(f => ({
      ...f,
      commission_jobs: [...(f.commission_jobs || []), { job_id: "", description: "", job_total: 0, commission_pct: f.commission_percent || 0, commission_amount: 0, type: "work" }],
    }));
  };

  const updateCommissionJob = (i, field, val) => {
    setForm(f => {
      const jobs = [...f.commission_jobs];
      jobs[i] = { ...jobs[i], [field]: val };
      if (field === "job_total" || field === "commission_pct") {
        jobs[i].commission_amount = Math.round(Number(jobs[i].job_total) * Number(jobs[i].commission_pct) / 100 * 100) / 100;
      }
      const commTotal = jobs.filter(j => j.type === "work").reduce((s, j) => s + (Number(j.commission_amount) || 0), 0);
      const salesTotal = jobs.filter(j => j.type === "sales").reduce((s, j) => s + (Number(j.commission_amount) || 0), 0);
      const updated = { ...f, commission_jobs: jobs, commission_total: commTotal, sales_commission_total: salesTotal };
      const gross = calcGross(updated);
      return { ...updated, gross_pay: gross, net_pay: Math.max(gross - (updated.tax_withheld || 0) - (updated.deductions || 0), 0) };
    });
  };

  const removeCommissionJob = (i) => {
    setForm(f => {
      const jobs = f.commission_jobs.filter((_, idx) => idx !== i);
      const commTotal = jobs.filter(j => j.type === "work").reduce((s, j) => s + (Number(j.commission_amount) || 0), 0);
      const salesTotal = jobs.filter(j => j.type === "sales").reduce((s, j) => s + (Number(j.commission_amount) || 0), 0);
      const updated = { ...f, commission_jobs: jobs, commission_total: commTotal, sales_commission_total: salesTotal };
      const gross = calcGross(updated);
      return { ...updated, gross_pay: gross, net_pay: Math.max(gross - (updated.tax_withheld || 0) - (updated.deductions || 0), 0) };
    });
  };

  const addStumpEntry = () => {
    setForm(f => ({
      ...f,
      stumps_logged: [...(f.stumps_logged || []), { job_id: "", job_description: "", size_label: "Small (0–12 in)", quantity: 1, rate: 0, subtotal: 0 }],
    }));
  };

  const updateStumpEntry = (i, field, val) => {
    setForm(f => {
      const stumps = [...f.stumps_logged];
      stumps[i] = { ...stumps[i], [field]: val };
      if (field === "quantity" || field === "rate") {
        stumps[i].subtotal = Number(stumps[i].quantity) * Number(stumps[i].rate);
      }
      const stumpTotal = stumps.reduce((s, st) => s + (Number(st.subtotal) || 0), 0);
      const updated = { ...f, stumps_logged: stumps, stump_pay_total: stumpTotal };
      const gross = calcGross(updated);
      return { ...updated, gross_pay: gross, net_pay: Math.max(gross - (updated.tax_withheld || 0) - (updated.deductions || 0), 0) };
    });
  };

  const handleSave = () => {
    if (!form || !selectedEmpId) { toast.error("Select an employee"); return; }
    onSave({ ...form, period_start: periodStart, period_end: periodEnd });
  };

  const isPerStump = form?.pay_type === "per_stump";
  const isCommissionOnly = form?.pay_type === "commission";
  const hasCommission = ["commission", "hourly_plus_commission", "daily_plus_commission", "salary_plus_commission"].includes(form?.pay_type || "");
  const hasBase = !isCommissionOnly && !isPerStump;

  return (
    <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
      <div className="space-y-1">
        <Label>Employee *</Label>
        <Select value={selectedEmpId} onValueChange={handleSelectEmp}>
          <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
          <SelectContent>
            {employees.filter(e => e.status === "active").map(e => (
              <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name} — {e.position}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {form && (
        <>
          <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
            Pay type: <strong>{PAY_TYPE_LABELS[form.pay_type]}</strong>
            {form.commission_percent > 0 && ` · ${form.commission_percent}% commission`}
          </div>

          {/* Base pay */}
          {hasBase && (
            <div className="rounded border p-3 space-y-3">
              <p className="text-xs font-bold uppercase text-muted-foreground">Base Pay</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{form.pay_type.includes("daily") ? "Days Worked" : form.pay_type.includes("salary") ? "Pay Periods" : "Hours Worked"}</Label>
                  <Input type="number" min="0" step="0.5" value={form.base_hours}
                    onChange={e => updateBasePay(e.target.value, form.base_rate, form.pay_type)} />
                </div>
                <div className="space-y-1">
                  <Label>Rate ($)</Label>
                  <Input type="number" min="0" step="0.01" value={form.base_rate}
                    onChange={e => updateBasePay(form.base_hours, e.target.value, form.pay_type)} />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Base Pay</span>
                <span className="font-semibold">${(form.base_pay || 0).toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Overtime Hours</Label>
                  <Input type="number" min="0" step="0.5" value={form.overtime_hours}
                    onChange={e => {
                      const ot = Number(e.target.value);
                      const otPay = ot * (form.base_rate || 0) * 1.5;
                      set("overtime_hours", ot);
                      setForm(f => {
                        const updated = { ...f, overtime_hours: ot, overtime_pay: otPay };
                        const gross = calcGross(updated);
                        return { ...updated, gross_pay: gross, net_pay: Math.max(gross - (updated.tax_withheld || 0) - (updated.deductions || 0), 0) };
                      });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>OT Pay (1.5x)</Label>
                  <Input readOnly value={`$${(form.overtime_pay || 0).toFixed(2)}`} className="bg-muted/30" />
                </div>
              </div>
            </div>
          )}

          {/* Commission jobs */}
          {(hasCommission || isCommissionOnly) && (
            <div className="rounded border p-3 space-y-3">
              <button type="button" className="w-full flex items-center justify-between text-xs font-bold uppercase text-muted-foreground"
                onClick={() => setExpandCommission(!expandCommission)}>
                Commission Jobs {expandCommission ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expandCommission && (
                <div className="space-y-2">
                  {(form.commission_jobs || []).map((job, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1 items-center text-xs">
                      <Input className="col-span-4 h-7 text-xs" placeholder="Description" value={job.description}
                        onChange={e => updateCommissionJob(i, "description", e.target.value)} />
                      <Select value={job.type} onValueChange={v => updateCommissionJob(i, "type", v)}>
                        <SelectTrigger className="col-span-2 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="work">Work</SelectItem>
                          {selectedEmp?.can_sell && <SelectItem value="sales">Sales</SelectItem>}
                        </SelectContent>
                      </Select>
                      <Input className="col-span-2 h-7 text-xs" type="number" placeholder="Job $" value={job.job_total}
                        onChange={e => updateCommissionJob(i, "job_total", e.target.value)} />
                      <Input className="col-span-2 h-7 text-xs" type="number" placeholder="%" value={job.commission_pct}
                        onChange={e => updateCommissionJob(i, "commission_pct", e.target.value)} />
                      <span className="col-span-1 text-right font-medium">${(job.commission_amount || 0).toFixed(0)}</span>
                      <button type="button" className="col-span-1 text-destructive hover:text-red-700"
                        onClick={() => removeCommissionJob(i)}>×</button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addCommissionJob} className="text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add Job
                  </Button>
                  <div className="flex justify-between text-sm pt-1 border-t">
                    <span className="text-muted-foreground">Work Commission</span>
                    <span className="font-semibold">${(form.commission_total || 0).toFixed(2)}</span>
                  </div>
                  {selectedEmp?.can_sell && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sales Commission</span>
                      <span className="font-semibold">${(form.sales_commission_total || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Stump pay */}
          {isPerStump && (
            <div className="rounded border p-3 space-y-3">
              <button type="button" className="w-full flex items-center justify-between text-xs font-bold uppercase text-muted-foreground"
                onClick={() => setExpandStumps(!expandStumps)}>
                Stumps Logged {expandStumps ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expandStumps && (
                <div className="space-y-2">
                  {(form.stumps_logged || []).map((st, i) => (
                    <div key={i} className="grid grid-cols-12 gap-1 items-center text-xs">
                      <Input className="col-span-3 h-7 text-xs" placeholder="Job / notes" value={st.job_description}
                        onChange={e => updateStumpEntry(i, "job_description", e.target.value)} />
                      <Select value={st.size_label} onValueChange={v => updateStumpEntry(i, "size_label", v)}>
                        <SelectTrigger className="col-span-3 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Small (0–12 in)", "Medium (13–24 in)", "Large (25–36 in)", "Extra Large (37+ in)"].map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input className="col-span-2 h-7 text-xs" type="number" placeholder="Qty" value={st.quantity}
                        onChange={e => updateStumpEntry(i, "quantity", e.target.value)} />
                      <Input className="col-span-2 h-7 text-xs" type="number" placeholder="$/stump" value={st.rate}
                        onChange={e => updateStumpEntry(i, "rate", e.target.value)} />
                      <span className="col-span-1 text-right font-medium">${(st.subtotal || 0).toFixed(0)}</span>
                      <button type="button" className="col-span-1 text-destructive"
                        onClick={() => setForm(f => {
                          const stumps = f.stumps_logged.filter((_, idx) => idx !== i);
                          const total = stumps.reduce((s, st) => s + (Number(st.subtotal) || 0), 0);
                          const updated = { ...f, stumps_logged: stumps, stump_pay_total: total };
                          const gross = calcGross(updated);
                          return { ...updated, gross_pay: gross, net_pay: Math.max(gross - (updated.tax_withheld || 0) - (updated.deductions || 0), 0) };
                        })}>×</button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addStumpEntry} className="text-xs gap-1">
                    <Plus className="w-3 h-3" /> Add Stumps
                  </Button>
                  <div className="flex justify-between text-sm pt-1 border-t">
                    <span className="text-muted-foreground">Stump Pay Total</span>
                    <span className="font-semibold">${(form.stump_pay_total || 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Adjustments */}
          <div className="rounded border p-3 space-y-3">
            <p className="text-xs font-bold uppercase text-muted-foreground">Adjustments</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Bonuses ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.bonuses}
                  onChange={e => set("bonuses", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deductions ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.deductions}
                  onChange={e => set("deductions", Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tax Withheld ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.tax_withheld}
                  onChange={e => {
                    const tw = Number(e.target.value);
                    setForm(f => {
                      const updated = { ...f, tax_withheld: tw };
                      return { ...updated, net_pay: Math.max(calcGross(updated) - tw - (updated.deductions || 0), 0) };
                    });
                  }} />
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-1">
            <Label>Payment Method</Label>
            <Select value={form.payment_method} onValueChange={v => set("payment_method", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="direct_deposit">Direct Deposit</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="external_provider">External Provider</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Totals */}
          <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Gross Pay</span><span className="font-bold text-base">${(form.gross_pay || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax Withheld</span><span>−${(form.tax_withheld || 0).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Deductions</span><span>−${(form.deductions || 0).toFixed(2)}</span></div>
            <Separator />
            <div className="flex justify-between"><span className="font-semibold">Net Pay</span><span className="font-bold text-green-700 text-base">${(form.net_pay || 0).toFixed(2)}</span></div>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background pb-1">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving || !form}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Record"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Payroll Page ────────────────────────────────────────────────────────
export default function Payroll() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("records");
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return format(d, "yyyy-MM-dd");
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    return format(d, "yyyy-MM-dd");
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list("-created_date"),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => base44.entities.Job.list("-created_date", 200),
  });
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["payroll_records"],
    queryFn: () => base44.entities.PayrollRecord.list("-created_date", 200),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.PayrollRecord.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll_records"] });
      setShowForm(false);
      toast.success("Payroll record saved");
    },
    onError: () => toast.error("Failed to save record"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PayrollRecord.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payroll_records"] });
      setShowForm(false);
      setEditingRecord(null);
      toast.success("Record updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.PayrollRecord.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll_records"] }); toast.success("Record deleted"); },
  });

  const approveMut = useMutation({
    mutationFn: ({ id }) => base44.entities.PayrollRecord.update(id, { status: "approved", approved_at: new Date().toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll_records"] }); toast.success("Approved"); },
  });

  const markPaidMut = useMutation({
    mutationFn: ({ id }) => base44.entities.PayrollRecord.update(id, { status: "paid" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payroll_records"] }); toast.success("Marked paid"); },
  });

  const handleSave = (data) => {
    if (editingRecord) updateMut.mutate({ id: editingRecord.id, data });
    else createMut.mutate(data);
  };

  // Summary stats
  const draftTotal = records.filter(r => r.status === "draft").reduce((s, r) => s + (r.gross_pay || 0), 0);
  const approvedTotal = records.filter(r => r.status === "approved").reduce((s, r) => s + (r.gross_pay || 0), 0);
  const paidTotal = records.filter(r => r.status === "paid").reduce((s, r) => s + (r.gross_pay || 0), 0);
  const totalCommission = records.filter(r => r.status === "paid").reduce((s, r) => s + (r.commission_total || 0) + (r.sales_commission_total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-1">Internal payroll processing for all pay types</p>
        </div>
        <Button onClick={() => { setEditingRecord(null); setShowForm(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Payroll Record
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Draft / Pending</p>
            <p className="text-xl font-bold mt-1 text-yellow-600">${draftTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-muted-foreground">{records.filter(r => r.status === "draft").length} records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Approved</p>
            <p className="text-xl font-bold mt-1 text-blue-600">${approvedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-muted-foreground">{records.filter(r => r.status === "approved").length} records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Paid This Period</p>
            <p className="text-xl font-bold mt-1 text-green-600">${paidTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-muted-foreground">{records.filter(r => r.status === "paid").length} records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total Commission Paid</p>
            <p className="text-xl font-bold mt-1 text-purple-600">${totalCommission.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-muted-foreground">Work + sales commission</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="records">Payroll Records</TabsTrigger>
          <TabsTrigger value="providers">Provider Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4 mt-4">
          {/* Period filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Period Start</Label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Period End</Label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : records.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No payroll records yet</p>
              <p className="text-sm mt-1">Create your first payroll record to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map(r => (
                <Card key={r.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary flex-shrink-0 text-sm">
                          {(r.employee_name || "?").split(" ").map(n => n[0]).join("")}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{r.employee_name}</span>
                            <Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge>
                            <span className="text-xs text-muted-foreground capitalize">{PAY_TYPE_LABELS[r.pay_type] || r.pay_type}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {r.period_start} → {r.period_end}
                            {r.payment_method && <span className="ml-2 capitalize">· {r.payment_method.replace("_", " ")}</span>}
                          </p>
                          <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            {r.base_pay > 0 && <span>Base: ${r.base_pay.toFixed(2)}</span>}
                            {r.commission_total > 0 && <span>Work Comm: ${r.commission_total.toFixed(2)}</span>}
                            {r.sales_commission_total > 0 && <span>Sales Comm: ${r.sales_commission_total.toFixed(2)}</span>}
                            {r.stump_pay_total > 0 && <span>Stumps: ${r.stump_pay_total.toFixed(2)}</span>}
                            {r.bonuses > 0 && <span>Bonus: ${r.bonuses.toFixed(2)}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-base">${(r.gross_pay || 0).toFixed(2)}</p>
                          <p className="text-xs text-green-700 font-medium">Net: ${(r.net_pay || 0).toFixed(2)}</p>
                        </div>
                        <div className="flex gap-1">
                          {r.status === "draft" && (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => approveMut.mutate({ id: r.id })}>Approve</Button>
                          )}
                          {r.status === "approved" && (
                            <Button size="sm" className="text-xs h-7" onClick={() => markPaidMut.mutate({ id: r.id })}>Mark Paid</Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingRecord(r); setShowForm(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => { if (confirm("Delete this payroll record?")) deleteMut.mutate(r.id); }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="providers" className="mt-4">
          <Card className="border-dashed border-2">
            <CardContent className="py-10 text-center space-y-3">
              <Building2 className="w-10 h-10 mx-auto text-muted-foreground opacity-40" />
              <p className="font-semibold text-muted-foreground">Payroll Provider Integration</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Connect an external payroll provider to sync pay runs, direct deposits, and tax filings automatically.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {["Gusto", "ADP", "QuickBooks Payroll", "Paychex", "Rippling"].map(p => (
                  <Badge key={p} variant="outline" className="text-sm px-3 py-1">{p}</Badge>
                ))}
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 max-w-sm mx-auto">
                <strong>Integration required:</strong> Connect a payroll provider via the Integrations page. Once connected, payroll runs can be pushed directly to the provider.
              </div>
              <Button variant="outline" asChild className="mt-2">
                <a href="/integrations">Go to Integrations →</a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form dialog */}
      <Dialog open={showForm} onOpenChange={o => { if (!o) { setShowForm(false); setEditingRecord(null); } }}>
        <DialogContent className="max-w-xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "Edit Payroll Record" : "New Payroll Record"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <PayrollRecordForm
              employees={employees}
              jobs={jobs}
              periodStart={periodStart}
              periodEnd={periodEnd}
              onSave={handleSave}
              onClose={() => { setShowForm(false); setEditingRecord(null); }}
              isSaving={createMut.isPending || updateMut.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}