import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Truck, DollarSign, Gift } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/treeproWorkflow";

export default function DumpLogSection({ job }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState({
    material: "chips",
    loads: 1,
    paid: false,
    amount_paid: "",
    site_name: "",
  });

  // Load company settings for minimum fee defaults
  const { data: settingsList = [] } = useQuery({
    queryKey: ["company_settings"],
    queryFn: () => base44.entities.CompanySettings.list(),
  });
  const settings = settingsList[0] || {};
  const chipsMin = settings.dump_fee_chips_min || 50;
  const woodMin = settings.dump_fee_wood_min || 100;

  const dumpLogs = job.dump_logs || [];

  const getMinFee = (material) => material === "chips" ? chipsMin : woodMin;

  // Recalculate totals from all logs
  const recalcTotals = (logs) => {
    let expense = 0;
    let savings = 0;
    for (const log of logs) {
      const loads = log.loads || 1;
      if (log.paid) {
        expense += parseFloat(log.amount_paid) || 0;
      } else {
        savings += loads * getMinFee(log.material);
      }
    }
    return { dump_expense_total: expense, dump_savings_total: savings };
  };

  const handleAdd = async () => {
    if (!entry.loads || entry.loads < 1) {
      toast.error("Enter number of loads");
      return;
    }
    if (entry.paid && (!entry.amount_paid || parseFloat(entry.amount_paid) <= 0)) {
      toast.error("Enter the amount paid");
      return;
    }

    setSaving(true);
    const newLog = {
      material: entry.material,
      loads: parseInt(entry.loads),
      paid: entry.paid,
      amount_paid: entry.paid ? parseFloat(entry.amount_paid) : 0,
      site_name: entry.site_name || "",
      logged_at: new Date().toISOString(),
      logged_by: "crew",
    };

    const updatedLogs = [...dumpLogs, newLog];
    const totals = recalcTotals(updatedLogs);

    await base44.entities.Job.update(job.id, {
      dump_logs: updatedLogs,
      ...totals,
    });

    await logActivity({
      relatedType: "Job",
      relatedId: job.id,
      actor: "crew",
      action: `Dump logged: ${newLog.loads} load(s) of ${newLog.material}${newLog.paid ? ` — paid $${newLog.amount_paid}` : " — FREE (savings recorded)"}`,
      notes: newLog.site_name ? `Site: ${newLog.site_name}` : "",
    });

    qc.invalidateQueries({ queryKey: ["crew_jobs"] });
    setAdding(false);
    setEntry({ material: "chips", loads: 1, paid: false, amount_paid: "", site_name: "" });
    setSaving(false);
    toast.success(newLog.paid ? `Dump expense $${newLog.amount_paid} recorded` : `Free dump — $${newLog.loads * getMinFee(newLog.material)} savings recorded`);
  };

  const handleRemove = async (idx) => {
    const updatedLogs = dumpLogs.filter((_, i) => i !== idx);
    const totals = recalcTotals(updatedLogs);
    await base44.entities.Job.update(job.id, { dump_logs: updatedLogs, ...totals });
    qc.invalidateQueries({ queryKey: ["crew_jobs"] });
    toast.success("Dump entry removed");
  };

  const totalExpense = job.dump_expense_total || 0;
  const totalSavings = job.dump_savings_total || 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" /> Dump Runs
        </p>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="h-7 text-xs gap-1">
            <Plus className="w-3 h-3" /> Log Dump
          </Button>
        )}
      </div>

      {/* Summary row */}
      {(totalExpense > 0 || totalSavings > 0) && (
        <div className="flex gap-2 flex-wrap">
          {totalExpense > 0 && (
            <span className="flex items-center gap-1 text-xs bg-red-50 border border-red-200 text-red-700 px-2 py-1 rounded-full">
              <DollarSign className="w-3 h-3" /> ${totalExpense.toFixed(2)} in dump fees
            </span>
          )}
          {totalSavings > 0 && (
            <span className="flex items-center gap-1 text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded-full">
              <Gift className="w-3 h-3" /> ${totalSavings.toFixed(2)} saved (free dumps)
            </span>
          )}
        </div>
      )}

      {/* Existing logs */}
      {dumpLogs.length > 0 && (
        <div className="space-y-1.5">
          {dumpLogs.map((log, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge variant="outline" className={log.material === "chips" ? "border-amber-300 text-amber-700" : "border-stone-400 text-stone-700"}>
                  {log.material}
                </Badge>
                <span className="text-muted-foreground">{log.loads} load{log.loads !== 1 ? "s" : ""}</span>
                {log.site_name && <span className="text-muted-foreground truncate">@ {log.site_name}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {log.paid ? (
                  <span className="text-red-600 font-medium">-${(log.amount_paid || 0).toFixed(2)}</span>
                ) : (
                  <span className="text-green-600 font-medium">FREE (+${(log.loads * getMinFee(log.material)).toFixed(2)} saved)</span>
                )}
                <button onClick={() => handleRemove(idx)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dumpLogs.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground text-center py-2">No dump runs logged yet.</p>
      )}

      {/* Add form */}
      {adding && (
        <div className="border rounded-lg p-3 space-y-3 bg-card">
          <p className="text-xs font-semibold">Log a Dump Run</p>
          <div className="grid grid-cols-2 gap-2">
            {/* Material */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Material</label>
              <select
                className="w-full border rounded-md h-8 px-2 text-xs bg-background"
                value={entry.material}
                onChange={e => setEntry(f => ({ ...f, material: e.target.value }))}
              >
                <option value="chips">Chips</option>
                <option value="wood">Wood / Logs</option>
              </select>
            </div>
            {/* Loads */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Number of Loads</label>
              <Input
                type="number"
                min="1"
                value={entry.loads}
                onChange={e => setEntry(f => ({ ...f, loads: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          </div>
          {/* Site name */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Dump Site Name (optional)</label>
            <Input
              placeholder="e.g. City yard, Jones farm..."
              value={entry.site_name}
              onChange={e => setEntry(f => ({ ...f, site_name: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>
          {/* Paid toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={entry.paid}
              onChange={e => setEntry(f => ({ ...f, paid: e.target.checked, amount_paid: "" }))}
              className="w-4 h-4 accent-red-600"
            />
            <span className="text-xs font-medium">We had to pay to dump</span>
          </label>
          {entry.paid && (
            <div className="space-y-1 pl-6">
              <label className="text-xs text-muted-foreground">Amount Paid ($)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={`Min. fee: $${getMinFee(entry.material)}`}
                value={entry.amount_paid}
                onChange={e => setEntry(f => ({ ...f, amount_paid: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          )}
          {!entry.paid && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">
              Free dump — ${(parseInt(entry.loads || 1) * getMinFee(entry.material)).toFixed(2)} savings will be recorded (based on {entry.loads || 1} load{entry.loads != 1 ? "s" : ""} × ${getMinFee(entry.material)} min fee).
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setAdding(false)} className="text-xs h-8 flex-1" disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} className="text-xs h-8 flex-1" disabled={saving}>
              {saving ? "Saving..." : "Save Dump Run"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}