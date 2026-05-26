import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  MapPin, Phone, CheckCircle2, Clock, Camera, Navigation,
  AlertTriangle, Loader2, ChevronRight, HardHat, Play, Pause,
  ShieldCheck, Timer
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { logActivity, createNotification } from "@/lib/treeproWorkflow";

const JOB_STATUS_ACTIONS = {
  scheduled: { label: "Start Drive", next: "dispatched", icon: Navigation, color: "bg-blue-600 hover:bg-blue-700" },
  dispatched: { label: "Arrived on Site", next: "in_progress", icon: MapPin, color: "bg-green-600 hover:bg-green-700" },
  in_progress: { label: "Complete Job", next: "completed", icon: CheckCircle2, color: "bg-primary hover:bg-primary/90" },
  paused: { label: "Resume Job", next: "in_progress", icon: Play, color: "bg-yellow-600 hover:bg-yellow-700" },
};

function SafetyChecklistDialog({ job, onClose, onSave }) {
  const [form, setForm] = useState({
    ppe_confirmed: false,
    power_lines_checked: false,
    drop_zone_confirmed: false,
    traffic_control_needed: false,
    customer_property_protected: false,
    hazards_found: false,
    hazard_description: "",
    safe_to_proceed: true,
    notes: "",
  });

  const checks = [
    { key: "ppe_confirmed", label: "PPE confirmed (hard hats, gloves, chaps, eye/ear protection)" },
    { key: "power_lines_checked", label: "Power line proximity checked" },
    { key: "drop_zone_confirmed", label: "Drop zone cleared and secured" },
    { key: "traffic_control_needed", label: "Traffic control needed (check if yes)" },
    { key: "customer_property_protected", label: "Customer property protected (vehicles, landscaping)" },
    { key: "hazards_found", label: "Any hazards found on site?" },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600" /> Pre-Job Safety Checklist
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Complete before starting work: <strong>{job.customer_name}</strong></p>
          {checks.map(({ key, label }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={!!form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                className="mt-0.5 w-4 h-4 accent-green-600"
              />
              <span className="text-sm leading-snug">{label}</span>
            </label>
          ))}
          {form.hazards_found && (
            <div className="space-y-1 pl-7">
              <label className="text-xs font-medium text-muted-foreground">Describe the hazard(s):</label>
              <Textarea
                value={form.hazard_description}
                onChange={e => setForm(f => ({ ...f, hazard_description: e.target.value }))}
                rows={2}
                placeholder="Describe hazards found..."
                className="text-sm"
              />
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-red-700">
                <input
                  type="checkbox"
                  checked={!form.safe_to_proceed}
                  onChange={e => setForm(f => ({ ...f, safe_to_proceed: !e.target.checked }))}
                  className="w-4 h-4 accent-red-600"
                />
                Unsafe to proceed — stop work
              </label>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Additional notes:</label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Any other site observations..."
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onSave({ ...form, job_id: job.id, completed_by: "crew", completed_at: new Date().toISOString() })}
            className="bg-green-600 hover:bg-green-700 gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            Submit Checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobCard({ job, onUpdateStatus, onUploadPhoto, onSafetyChecklist }) {
  const [notes, setNotes] = useState(job.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const qc = useQueryClient();
  const action = JOB_STATUS_ACTIONS[job.status];
  const [clockedIn, setClockedIn] = useState(!!job.time_in);
  const [clockingIn, setClockingIn] = useState(false);

  const saveNotes = async () => {
    setSavingNotes(true);
    await base44.entities.Job.update(job.id, { notes });
    qc.invalidateQueries({ queryKey: ["crew_jobs"] });
    setSavingNotes(false);
    toast.success("Notes saved");
  };

  const openMaps = () => {
    const addr = encodeURIComponent(job.address || "");
    window.open(`https://maps.google.com/?q=${addr}`, "_blank");
  };

  const callCustomer = () => {
    if (job.customer_phone) window.location.href = `tel:${job.customer_phone}`;
  };

  const handleClockIn = async () => {
    setClockingIn(true);
    const now = new Date().toISOString();
    await base44.entities.Job.update(job.id, { time_in: now });
    await base44.entities.TimeEntry.create({ employee_id: "crew", job_id: job.id, clock_in: now, status: "clocked_in" });
    qc.invalidateQueries({ queryKey: ["crew_jobs"] });
    setClockedIn(true);
    setClockingIn(false);
    toast.success("Clocked in — time tracking started");
  };

  const handleClockOut = async () => {
    setClockingIn(true);
    const now = new Date().toISOString();
    await base44.entities.Job.update(job.id, { time_out: now });
    const entries = await base44.entities.TimeEntry.filter({ job_id: job.id, status: "clocked_in" });
    if (entries.length > 0) {
      await base44.entities.TimeEntry.update(entries[0].id, { clock_out: now, status: "clocked_out" });
    }
    qc.invalidateQueries({ queryKey: ["crew_jobs"] });
    setClockedIn(false);
    setClockingIn(false);
    toast.success("Clocked out");
  };

  return (
    <Card className="overflow-hidden shadow-md">
      <div className={`h-2 ${job.status === "in_progress" ? "bg-green-500" : job.status === "dispatched" ? "bg-blue-500" : job.status === "paused" ? "bg-yellow-500" : "bg-muted"}`} />
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-base leading-tight">{job.customer_name}</h3>
            <p className="text-muted-foreground text-sm mt-0.5">{job.description?.slice(0, 80)}{job.description?.length > 80 ? "..." : ""}</p>
          </div>
          <Badge variant="outline" className={
            job.status === "in_progress" ? "border-green-500 text-green-700" :
            job.status === "completed" ? "border-gray-400 text-gray-600" :
            job.status === "paused" ? "border-yellow-500 text-yellow-700" :
            "border-blue-400 text-blue-700"
          }>
            {job.status?.replace(/_/g, " ")}
          </Badge>
        </div>

        {/* Address + Phone */}
        <div className="flex gap-2 flex-wrap">
          {job.address && (
            <Button variant="outline" size="sm" onClick={openMaps} className="gap-1.5 text-xs">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              {job.address}
            </Button>
          )}
          {job.customer_phone && (
            <Button variant="outline" size="sm" onClick={callCustomer} className="gap-1.5 text-xs">
              <Phone className="w-3.5 h-3.5 text-green-600" />
              Call Customer
            </Button>
          )}
        </div>

        {/* Job info pills */}
        <div className="flex flex-wrap gap-2">
          {job.scheduled_date && (
            <span className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
              <Clock className="w-3 h-3" />{format(new Date(job.scheduled_date), "MMM d, yyyy")}
            </span>
          )}
          {job.crew_name && (
            <span className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full">
              <HardHat className="w-3 h-3" />{job.crew_name}
            </span>
          )}
          {job.time_in && (
            <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              <Timer className="w-3 h-3" />In: {format(new Date(job.time_in), "h:mm a")}
            </span>
          )}
        </div>

        {/* Hazard / risk alert */}
        {(job.hazards || (job.notes && job.notes.toLowerCase().includes("hazard"))) && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800 font-medium">{job.hazards || "Hazard noted — review before starting"}</p>
          </div>
        )}

        {/* Safety + Time tracking row */}
        <div className="flex gap-2 flex-wrap">
          {job.status === "in_progress" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSafetyChecklist(job)}
              className="gap-1.5 text-xs border-green-300 text-green-700"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Safety Check
            </Button>
          )}
          {(job.status === "in_progress" || job.status === "dispatched") && (
            clockedIn ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClockOut}
                disabled={clockingIn}
                className="gap-1.5 text-xs border-red-300 text-red-700"
              >
                {clockingIn ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
                Clock Out
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClockIn}
                disabled={clockingIn}
                className="gap-1.5 text-xs border-blue-300 text-blue-700"
              >
                {clockingIn ? <Loader2 className="w-3 h-3 animate-spin" /> : <Timer className="w-3.5 h-3.5" />}
                Clock In
              </Button>
            )
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Job Notes</p>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes, observations, or issues..."
            rows={3}
            className="text-sm resize-none"
          />
          <Button size="sm" variant="outline" onClick={saveNotes} disabled={savingNotes} className="text-xs h-7">
            {savingNotes ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            Save Notes
          </Button>
        </div>

        {/* Photo upload */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Upload Photos</p>
          <div className="flex gap-2 flex-wrap">
            {["before", "during", "after", "hazard"].map(type => (
              <Button
                key={type}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs capitalize h-8"
                onClick={() => onUploadPhoto(job.id, type)}
              >
                <Camera className="w-3.5 h-3.5" />{type}
              </Button>
            ))}
          </div>
        </div>

        {/* Pause button while in progress */}
        {job.status === "in_progress" && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 border-yellow-400 text-yellow-700 hover:bg-yellow-50"
            onClick={() => onUpdateStatus(job.id, "paused")}
          >
            <Pause className="w-4 h-4" /> Pause Job
          </Button>
        )}

        {/* Main action button */}
        {action && job.status !== "completed" && (
          <Button
            className={`w-full h-12 text-base font-semibold gap-2 text-white ${action.color}`}
            onClick={() => onUpdateStatus(job.id, action.next)}
          >
            <action.icon className="w-5 h-5" />
            {action.label}
            <ChevronRight className="w-5 h-5 ml-auto" />
          </Button>
        )}
        {job.status === "completed" && (
          <div className="flex items-center justify-center gap-2 py-3 text-green-700 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            Job Completed
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CrewMode() {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [safetyJob, setSafetyJob] = useState(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["crew_jobs"],
    queryFn: () => base44.entities.Job.filter({ status: ["scheduled", "dispatched", "in_progress", "paused"] }),
  });

  const todayJobs = jobs.filter(j => {
    if (!j.scheduled_date) return true;
    const today = new Date().toISOString().slice(0, 10);
    return j.scheduled_date === today;
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => {
      const data = { status };
      if (status === "completed") {
        data.completion_date = new Date().toISOString().slice(0, 10);
        data.time_out = data.time_out || new Date().toISOString();
      }
      return base44.entities.Job.update(id, data);
    },
    onSuccess: async (_, { id, status }) => {
      qc.invalidateQueries({ queryKey: ["crew_jobs"] });
      toast.success("Status updated");
      if (status === "completed") {
        const job = jobs.find(j => j.id === id);
        await logActivity({ relatedType: "Job", relatedId: id, actor: "crew", action: "Job completed on site", notes: job?.customer_name || "" });
        await createNotification({ type: "job_completed", title: `Job completed: ${job?.customer_name || ""}`, message: `Ready to invoice.`, relatedType: "Job", relatedId: id });
      }
    },
    onError: () => toast.error("Failed to update status"),
  });

  const handleUploadPhoto = (jobId, type) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.JobPhoto.create({ job_id: jobId, photo_url: file_url, type, uploaded_by: "crew" });
      setUploading(false);
      toast.success(`${type} photo uploaded`);
    };
    input.click();
  };

  const handleSafetySubmit = async (checklistData) => {
    await base44.entities.SafetyChecklist.create(checklistData);
    await logActivity({ relatedType: "Job", relatedId: checklistData.job_id, actor: "crew", action: "Safety checklist completed", notes: checklistData.safe_to_proceed ? "Safe to proceed" : "UNSAFE — work stopped" });
    if (!checklistData.safe_to_proceed) {
      await createNotification({ type: "general", title: "⚠️ Unsafe Job Site", message: `Crew flagged safety issue — work stopped. Job ID: ${checklistData.job_id}`, relatedType: "Job", relatedId: checklistData.job_id });
    }
    setSafetyJob(null);
    toast.success(checklistData.safe_to_proceed ? "Safety check submitted — safe to proceed" : "Safety issue reported");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      <div className="sticky top-0 bg-background border-b py-4 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <HardHat className="w-5 h-5 text-primary" /> Crew Mode
            </h1>
            <p className="text-muted-foreground text-xs">
              {format(new Date(), "EEEE, MMMM d")} · {todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""} today
            </p>
          </div>
          {uploading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
            </div>
          )}
        </div>
      </div>

      {todayJobs.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-500 mb-3 opacity-60" />
          <p className="font-semibold text-lg">No jobs scheduled today</p>
          <p className="text-muted-foreground text-sm mt-1">Check back later or contact your supervisor</p>
        </div>
      ) : (
        <div className="space-y-4">
          {todayJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onUpdateStatus={(id, status) => updateStatus.mutate({ id, status })}
              onUploadPhoto={handleUploadPhoto}
              onSafetyChecklist={(j) => setSafetyJob(j)}
            />
          ))}
        </div>
      )}

      {/* Other jobs section */}
      {jobs.length > todayJobs.length && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Other Active Jobs</p>
          <div className="space-y-3">
            {jobs.filter(j => !todayJobs.includes(j)).map(job => (
              <JobCard
                key={job.id}
                job={job}
                onUpdateStatus={(id, status) => updateStatus.mutate({ id, status })}
                onUploadPhoto={handleUploadPhoto}
                onSafetyChecklist={(j) => setSafetyJob(j)}
              />
            ))}
          </div>
        </div>
      )}

      {safetyJob && (
        <SafetyChecklistDialog
          job={safetyJob}
          onClose={() => setSafetyJob(null)}
          onSave={handleSafetySubmit}
        />
      )}
    </div>
  );
}