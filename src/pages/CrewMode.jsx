import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  MapPin, Phone, Play, Pause, CheckCircle2, Clock, Camera, Navigation,
  AlertTriangle, Loader2, Upload, ChevronRight, HardHat
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const JOB_STATUS_ACTIONS = {
  scheduled: { label: "Start Drive", next: "dispatched", icon: Navigation, color: "bg-blue-600 hover:bg-blue-700" },
  dispatched: { label: "Arrived on Site", next: "in_progress", icon: MapPin, color: "bg-green-600 hover:bg-green-700" },
  in_progress: { label: "Complete Job", next: "completed", icon: CheckCircle2, color: "bg-primary hover:bg-primary/90" },
};

function JobCard({ job, onUpdateStatus, onUploadPhoto }) {
  const [notes, setNotes] = useState(job.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const qc = useQueryClient();
  const action = JOB_STATUS_ACTIONS[job.status];

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

  return (
    <Card className="overflow-hidden shadow-md">
      <div className={`h-2 ${job.status === "in_progress" ? "bg-green-500" : job.status === "dispatched" ? "bg-blue-500" : "bg-muted"}`} />
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
            "border-blue-400 text-blue-700"
          }>
            {job.status?.replace("_", " ")}
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
        </div>

        {/* Hazard alert */}
        {job.notes && job.notes.toLowerCase().includes("hazard") && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800 font-medium">Hazard noted — review site notes before starting</p>
          </div>
        )}

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
            {["before", "during", "after"].map(type => (
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

        {/* Action button */}
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
  const fileRef = { current: null };
  const [pendingUpload, setPendingUpload] = useState(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["crew_jobs"],
    queryFn: () => base44.entities.Job.filter({ status: ["scheduled", "dispatched", "in_progress"] }),
  });

  const todayJobs = jobs.filter(j => {
    if (!j.scheduled_date) return true;
    const today = new Date().toISOString().slice(0, 10);
    return j.scheduled_date === today;
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Job.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crew_jobs"] }); toast.success("Status updated"); },
    onError: () => toast.error("Failed to update status"),
  });

  const handleUploadPhoto = (jobId, type) => {
    setPendingUpload({ jobId, type });
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
      setPendingUpload(null);
    };
    input.click();
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
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}