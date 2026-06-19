import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, CheckCircle2, Wrench, TrendingUp } from "lucide-react";
import { format } from "date-fns";

/**
 * Returns maintenance status for a piece of equipment.
 * Priority: hours-based > date-based > OK
 */
export function getMaintenanceStatus(item) {
  const hoursSinceLast = (item.hours_used || 0) - (item.hours_at_last_maintenance || 0);
  const intervalHours = item.maintenance_interval_hours;

  if (intervalHours && intervalHours > 0) {
    const hoursRemaining = intervalHours - hoursSinceLast;
    if (hoursRemaining <= 0) return { level: "overdue", label: `${Math.abs(Math.round(hoursRemaining))} hrs overdue`, reason: "hours" };
    if (hoursRemaining <= intervalHours * 0.15) return { level: "due_soon", label: `${Math.round(hoursRemaining)} hrs left`, reason: "hours" };
  }

  if (item.next_maintenance) {
    const daysUntil = Math.round((new Date(item.next_maintenance) - new Date()) / 86400000);
    if (daysUntil < 0) return { level: "overdue", label: `${Math.abs(daysUntil)}d overdue`, reason: "date" };
    if (daysUntil <= 14) return { level: "due_soon", label: `Due ${format(new Date(item.next_maintenance), "MMM d")}`, reason: "date" };
  }

  return { level: "ok", label: "OK", reason: null };
}

const LEVEL_STYLES = {
  overdue: { card: "border-red-200 bg-red-50", badge: "bg-red-100 text-red-700", icon: <AlertTriangle className="w-4 h-4 text-red-500" /> },
  due_soon: { card: "border-yellow-200 bg-yellow-50", badge: "bg-yellow-100 text-yellow-700", icon: <Clock className="w-4 h-4 text-yellow-500" /> },
  ok: { card: "border-green-100 bg-green-50", badge: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
};

export default function MaintenanceDashboard({ equipment, onEditItem }) {
  const flagged = equipment
    .filter(e => e.status !== "retired")
    .map(e => ({ ...e, _maint: getMaintenanceStatus(e) }))
    .filter(e => e._maint.level !== "ok")
    .sort((a, b) => (a._maint.level === "overdue" ? -1 : 1));

  const overdue = flagged.filter(e => e._maint.level === "overdue");
  const dueSoon = flagged.filter(e => e._maint.level === "due_soon");
  const operational = equipment.filter(e => e.status === "operational" || e.status === "in_use").length;
  const inMaintenance = equipment.filter(e => e.status === "maintenance" || e.status === "repair" || e.status === "awaiting_parts").length;

  if (equipment.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Operational</p>
              <p className="text-xl font-bold text-green-700">{operational}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <div>
              <p className="text-xs text-muted-foreground">Overdue</p>
              <p className="text-xl font-bold text-red-700">{overdue.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">Due Soon</p>
              <p className="text-xl font-bold text-yellow-700">{dueSoon.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">In Service</p>
              <p className="text-xl font-bold text-orange-700">{inMaintenance}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Flagged items */}
      {flagged.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Maintenance Required ({flagged.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {flagged.map(item => {
              const styles = LEVEL_STYLES[item._maint.level];
              const hoursSinceLast = (item.hours_used || 0) - (item.hours_at_last_maintenance || 0);
              return (
                <div key={item.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${styles.card}`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {styles.icon}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-xs text-muted-foreground capitalize">{item.type?.replace(/_/g, " ")}</span>
                        {item.hours_used > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <TrendingUp className="w-2.5 h-2.5" />{item.hours_used} total hrs
                            {item.maintenance_interval_hours > 0 && ` · ${Math.round(hoursSinceLast)} since last service`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-xs ${styles.badge}`}>{item._maint.label}</Badge>
                    <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => onEditItem(item)}>
                      Service
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}