import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Camera, Wrench, Loader2, X, AlertTriangle, ChevronRight, Image, Clock
} from "lucide-react";
import { toast } from "sonner";
import { getMaintenanceStatus } from "@/components/equipment/MaintenanceDashboard";
import { logActivity, createNotification } from "@/lib/treeproWorkflow";

const PHOTO_TYPES = ["before", "during", "after", "hazard"];

function PhotoSection({ jobId, photos, onPhotoAdded }) {
  const [uploading, setUploading] = useState(null); // type being uploaded

  const triggerUpload = (type) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(type);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.JobPhoto.create({ job_id: jobId, photo_url: file_url, type, uploaded_by: "crew" });
        onPhotoAdded(type, file_url);
        toast.success(`${type} photo uploaded`);
      } catch {
        toast.error("Upload failed — try again");
      }
      setUploading(null);
    };
    input.click();
  };

  const typePhotos = (type) => photos.filter(p => p.type === type);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Camera className="w-4 h-4 text-primary" /> Site Photos
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {PHOTO_TYPES.map(type => {
          const taken = typePhotos(type);
          const isUploading = uploading === type;
          return (
            <button
              key={type}
              onClick={() => triggerUpload(type)}
              disabled={isUploading}
              className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed p-4 transition-all min-h-[90px] ${
                taken.length > 0
                  ? "border-green-400 bg-green-50 text-green-700"
                  : "border-muted-foreground/30 bg-muted/20 text-muted-foreground hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : taken.length > 0 ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Image className="w-5 h-5" />
              )}
              <span className="text-xs font-medium capitalize">{type}</span>
              {taken.length > 0 && (
                <span className="text-xs">{taken.length} photo{taken.length > 1 ? "s" : ""}</span>
              )}
            </button>
          );
        })}
      </div>
      {photos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">Tap a category to take or upload a photo</p>
      )}
    </div>
  );
}

function EquipmentHoursSection({ equipment, hoursMap, onHoursChange }) {
  if (!equipment.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Wrench className="w-4 h-4 text-primary" /> Equipment Hours
      </h3>
      <p className="text-xs text-muted-foreground">Enter hours used for each piece of equipment on this job.</p>
      <div className="space-y-2">
        {equipment.map(e => {
          const addHours = hoursMap[e.id] ?? "";
          const projected = (e.hours_used || 0) + (parseFloat(addHours) || 0);
          const projItem = { hours_used: projected, hours_at_last_maintenance: e.hours_at_last_maintenance || 0, maintenance_interval_hours: e.maintenance_interval_hours || 0 };
          const mStatus = e.maintenance_interval_hours > 0 ? getMaintenanceStatus(projItem) : null;

          return (
            <div key={e.id} className="border rounded-xl p-3 space-y-2 bg-card">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{e.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {e.type?.replace(/_/g, " ")} · {e.hours_used || 0} hrs total
                  </p>
                </div>
                {mStatus?.level === "overdue" && (
                  <Badge className="bg-red-100 text-red-700 text-xs shrink-0">
                    <AlertTriangle className="w-3 h-3 mr-1" />Overdue
                  </Badge>
                )}
                {mStatus?.level === "due_soon" && (
                  <Badge className="bg-yellow-100 text-yellow-700 text-xs shrink-0">Due soon</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Hours used"
                  value={addHours}
                  onChange={e2 => onHoursChange(e.id, e2.target.value)}
                  className="h-9 text-sm"
                />
                {parseFloat(addHours) > 0 && (
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    → {projected} hrs
                  </span>
                )}
              </div>
              {mStatus && mStatus.level !== "ok" && parseFloat(addHours) > 0 && (
                <p className="text-xs text-yellow-700 bg-yellow-50 rounded-lg px-2 py-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  After update: {mStatus.label} — schedule maintenance.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Full-screen mobile completion form shown when crew taps "Complete Job".
 * Handles photo uploads + equipment hours before finalizing the status.
 */
export default function JobCompletionForm({ job, equipment = [], onConfirm, onCancel }) {
  const [photos, setPhotos] = useState([]);
  const [hoursMap, setHoursMap] = useState({});
  const [completionNotes, setCompletionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handlePhotoAdded = (type, url) => {
    setPhotos(prev => [...prev, { type, url }]);
  };

  const handleHoursChange = (equipId, val) => {
    setHoursMap(prev => ({ ...prev, [equipId]: val }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // 1. Save equipment hours
      const hoursUpdates = equipment.filter(e => parseFloat(hoursMap[e.id]) > 0);
      await Promise.all(hoursUpdates.map(e => {
        const newTotal = (e.hours_used || 0) + parseFloat(hoursMap[e.id]);
        return base44.entities.Equipment.update(e.id, { hours_used: newTotal });
      }));

      // 2. Update job to completed
      await base44.entities.Job.update(job.id, {
        status: "completed",
        completion_date: new Date().toISOString().slice(0, 10),
        time_out: new Date().toISOString(),
        ...(completionNotes ? { completion_notes: completionNotes } : {}),
      });

      // 3. Activity + notification
      await logActivity({
        relatedType: "Job",
        relatedId: job.id,
        actor: "crew",
        action: "Job completed on site",
        notes: `${photos.length} photos uploaded. ${hoursUpdates.length} equipment items logged.`,
      });
      await createNotification({
        type: "job_completed",
        title: `Job completed: ${job.customer_name}`,
        message: `${photos.length} photos. Ready to invoice.`,
        relatedType: "Job",
        relatedId: job.id,
      });

      toast.success("Job marked complete!");
      onConfirm();
    } catch (err) {
      toast.error("Failed to complete job: " + err.message);
    }
    setSaving(false);
  };

  const hasAfterPhoto = photos.some(p => p.type === "after");

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background sticky top-0">
        <div>
          <h2 className="font-bold text-base">Complete Job</h2>
          <p className="text-xs text-muted-foreground truncate max-w-[220px]">{job.customer_name}</p>
        </div>
        <button onClick={onCancel} className="p-2 rounded-full hover:bg-muted">
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        <PhotoSection jobId={job.id} photos={photos} onPhotoAdded={handlePhotoAdded} />

        <div className="border-t" />

        <EquipmentHoursSection
          equipment={equipment}
          hoursMap={hoursMap}
          onHoursChange={handleHoursChange}
        />

        <div className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" /> Completion Notes
          </h3>
          <Textarea
            placeholder="Any final observations, issues, or customer feedback..."
            value={completionNotes}
            onChange={e => setCompletionNotes(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />
        </div>

        {!hasAfterPhoto && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800">No <strong>after</strong> photo yet. It's recommended before completing.</p>
          </div>
        )}
      </div>

      {/* Footer action */}
      <div className="px-4 py-4 border-t bg-background">
        <Button
          className="w-full h-13 text-base font-semibold gap-2"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Mark Job Complete
              <ChevronRight className="w-5 h-5 ml-auto" />
            </>
          )}
        </Button>
        <Button variant="ghost" className="w-full mt-2 text-sm text-muted-foreground" onClick={onCancel} disabled={saving}>
          Go Back
        </Button>
      </div>
    </div>
  );
}