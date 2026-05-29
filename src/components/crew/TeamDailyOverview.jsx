import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HardHat, MapPin, Clock, Wrench, Truck, CheckCircle2,
  AlertTriangle, Circle, Loader2, Users, Package
} from "lucide-react";
import { format } from "date-fns";

const JOB_STATUS_COLORS = {
  scheduled: "bg-slate-100 text-slate-700 border-slate-300",
  dispatched: "bg-blue-100 text-blue-700 border-blue-300",
  in_progress: "bg-green-100 text-green-700 border-green-300",
  paused: "bg-yellow-100 text-yellow-700 border-yellow-300",
  completed: "bg-gray-100 text-gray-500 border-gray-300",
};

const EQUIP_STATUS_COLORS = {
  operational: "text-green-600",
  in_use: "text-blue-600",
  maintenance: "text-yellow-600",
  repair: "text-orange-600",
  awaiting_parts: "text-red-600",
  retired: "text-gray-400",
};

const EQUIP_STATUS_ICONS = {
  operational: CheckCircle2,
  in_use: Truck,
  maintenance: Wrench,
  repair: AlertTriangle,
  awaiting_parts: AlertTriangle,
  retired: Circle,
};

function EquipmentBadge({ equipment }) {
  const StatusIcon = EQUIP_STATUS_ICONS[equipment.status] || Circle;
  const colorClass = EQUIP_STATUS_COLORS[equipment.status] || "text-gray-400";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <StatusIcon className={`w-3.5 h-3.5 shrink-0 ${colorClass}`} />
      <span className="font-medium">{equipment.name}</span>
      <span className="text-muted-foreground capitalize">{equipment.status?.replace(/_/g, " ")}</span>
    </div>
  );
}

function JobRow({ job }) {
  const statusClass = JOB_STATUS_COLORS[job.status] || JOB_STATUS_COLORS.scheduled;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{job.customer_name}</span>
          <Badge variant="outline" className={`text-xs px-1.5 py-0 ${statusClass}`}>
            {job.status?.replace(/_/g, " ")}
          </Badge>
          {job.priority === "emergency" && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0">Emergency</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{job.description?.slice(0, 60)}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {job.address && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />{job.address.split(",")[0]}
            </span>
          )}
          {job.scheduled_start && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />{job.scheduled_start}
            </span>
          )}
          {job.estimated_duration_hours && (
            <span className="text-xs text-muted-foreground">~{job.estimated_duration_hours}h</span>
          )}
        </div>
      </div>
    </div>
  );
}

function CrewTeamCard({ crew, jobs, equipment }) {
  const crewJobs = jobs.filter(j => j.crew_id === crew.id || j.crew_name === crew.name);
  const crewEquipment = equipment.filter(e => e.assigned_crew === crew.name || e.assigned_crew === crew.id);

  const activeJob = crewJobs.find(j => j.status === "in_progress");
  const pendingJobs = crewJobs.filter(j => ["scheduled", "dispatched"].includes(j.status));
  const completedToday = crewJobs.filter(j => j.status === "completed");

  const statusColor =
    activeJob ? "border-l-green-500" :
    pendingJobs.length > 0 ? "border-l-blue-400" :
    "border-l-gray-300";

  return (
    <Card className={`border-l-4 ${statusColor}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <HardHat className="w-4 h-4 text-primary" />
              {crew.name}
            </CardTitle>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                {crew.leader}
                {crew.members?.length > 0 && ` +${crew.members.length}`}
              </span>
              {crew.status && (
                <Badge variant="outline" className={`text-xs px-1.5 py-0 ${
                  crew.status === "on_job" ? "border-green-400 text-green-700" :
                  crew.status === "available" ? "border-blue-400 text-blue-700" :
                  "border-gray-300 text-gray-500"
                }`}>
                  {crew.status.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">{crewJobs.length} job{crewJobs.length !== 1 ? "s" : ""} today</div>
            {completedToday.length > 0 && (
              <div className="text-xs text-green-600 font-medium">{completedToday.length} done</div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Jobs */}
        {crewJobs.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Daily Assignments
            </p>
            <div>
              {crewJobs.map(job => <JobRow key={job.id} job={job} />)}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">No jobs assigned today</p>
        )}

        {/* Equipment */}
        {crewEquipment.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Package className="w-3 h-3" /> Equipment
            </p>
            <div className="space-y-1.5 pl-1">
              {crewEquipment.map(e => <EquipmentBadge key={e.id} equipment={e} />)}
            </div>
          </div>
        )}
        {crewEquipment.length === 0 && (
          <p className="text-xs text-muted-foreground italic flex items-center gap-1">
            <Package className="w-3 h-3" /> No equipment assigned
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function TeamDailyOverview() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: crews = [], isLoading: loadingCrews } = useQuery({
    queryKey: ["crews_overview"],
    queryFn: () => base44.entities.Crew.list(),
  });

  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ["jobs_today_overview"],
    queryFn: () => base44.entities.Job.filter({
      status: ["scheduled", "dispatched", "in_progress", "paused", "completed"],
    }),
  });

  const { data: equipment = [], isLoading: loadingEquip } = useQuery({
    queryKey: ["equipment_overview"],
    queryFn: () => base44.entities.Equipment.list(),
  });

  const todayJobs = jobs.filter(j => !j.scheduled_date || j.scheduled_date === today);
  const isLoading = loadingCrews || loadingJobs || loadingEquip;

  // Jobs not tied to any crew
  const unassignedJobs = todayJobs.filter(j => !j.crew_id && !j.crew_name);
  // Equipment not tied to any crew
  const unassignedEquipment = equipment.filter(e => !e.assigned_crew);

  // Summary stats
  const inProgressCount = todayJobs.filter(j => j.status === "in_progress").length;
  const completedCount = todayJobs.filter(j => j.status === "completed").length;
  const equipIssues = equipment.filter(e => ["maintenance", "repair", "awaiting_parts"].includes(e.status)).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Teams", value: crews.filter(c => c.status !== "off_duty").length, color: "text-primary" },
          { label: "Jobs Today", value: todayJobs.length, color: "text-blue-600" },
          { label: "In Progress", value: inProgressCount, color: "text-green-600" },
          { label: "Equip. Issues", value: equipIssues, color: equipIssues > 0 ? "text-red-600" : "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border rounded-lg px-3 py-2.5 text-center">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Per-team cards */}
      {crews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <HardHat className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No crews configured</p>
          <p className="text-xs mt-1">Add crews in the system to see team assignments here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {crews.map(crew => (
            <CrewTeamCard
              key={crew.id}
              crew={crew}
              jobs={todayJobs}
              equipment={equipment}
            />
          ))}
        </div>
      )}

      {/* Unassigned jobs */}
      {unassignedJobs.length > 0 && (
        <Card className="border-l-4 border-l-orange-400">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <AlertTriangle className="w-4 h-4" />
              Unassigned Jobs ({unassignedJobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {unassignedJobs.map(job => <JobRow key={job.id} job={job} />)}
          </CardContent>
        </Card>
      )}

      {/* Unassigned / available equipment */}
      {unassignedEquipment.filter(e => e.status === "operational").length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
              <Package className="w-4 h-4" /> Available Unassigned Equipment
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5">
              {unassignedEquipment
                .filter(e => e.status === "operational")
                .map(e => <EquipmentBadge key={e.id} equipment={e} />)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}