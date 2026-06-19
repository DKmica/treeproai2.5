import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, Wrench, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getMaintenanceStatus } from "@/components/equipment/MaintenanceDashboard";

/**
 * Shown after a job is marked completed.
 * Lets the user add hours used for each piece of equipment assigned to the job.
 */
export default function EquipmentHoursDialog({ job, equipment, onClose, onSaved }) {
  // Build initial state: one row per equipment item
  const [rows, setRows] = useState(
    equipment.map(e => ({ id: e.id, name: e.name, type: e.type, currentHours: e.hours_used || 0, hoursAtLastMaint: e.hours_at_last_maintenance || 0, intervalHours: e.maintenance_interval_hours || 0, addHours: "" }))
  );
  const [saving, setSaving] = useState(false);

  const setAdd = (id, val) => setRows(prev => prev.map(r => r.id === id ? { ...r, addHours: val } : r));

  const handleSave = async () => {
    const toUpdate = rows.filter(r => parseFloat(r.addHours) > 0);
    if (!toUpdate.length) { onClose(); return; }

    setSaving(true);
    try {
      await Promise.all(toUpdate.map(r => {
        const newTotal = r.currentHours + (parseFloat(r.addHours) || 0);
        return base44.entities.Equipment.update(r.id, { hours_used: newTotal });
      }));
      toast.success(`Hours updated for ${toUpdate.length} item${toUpdate.length > 1 ? "s" : ""}`);
      onSaved?.();
    } catch (err) {
      toast.error("Failed to update hours: " + err.message);
    }
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Update Equipment Hours
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Job completed: <strong>{job.customer_name}</strong>. Log hours used so maintenance alerts stay accurate.
          </p>
        </DialogHeader>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto py-1">
          {rows.map(r => {
            const projected = r.currentHours + (parseFloat(r.addHours) || 0);
            const projectedItem = { hours_used: projected, hours_at_last_maintenance: r.hoursAtLastMaint, maintenance_interval_hours: r.intervalHours };
            const status = r.intervalHours > 0 ? getMaintenanceStatus(projectedItem) : null;
            return (
              <div key={r.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.type?.replace(/_/g, " ")} · {r.currentHours} hrs total</p>
                  </div>
                  {status?.level === "overdue" && <Badge className="bg-red-100 text-red-700 text-xs shrink-0"><AlertTriangle className="w-2.5 h-2.5 mr-1" />Overdue</Badge>}
                  {status?.level === "due_soon" && <Badge className="bg-yellow-100 text-yellow-700 text-xs shrink-0">Due soon</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0 w-28">Hours this job:</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 4"
                    value={r.addHours}
                    onChange={e => setAdd(r.id, e.target.value)}
                    className="h-8 text-sm"
                  />
                  {parseFloat(r.addHours) > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">→ {projected} hrs</span>
                  )}
                </div>
                {/* Warn if projected hours will trigger maintenance */}
                {status?.level !== "ok" && parseFloat(r.addHours) > 0 && (
                  <p className="text-xs text-yellow-700 bg-yellow-50 rounded px-2 py-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    After update: {status.label} — consider scheduling maintenance.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Skip</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Hours
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}