import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function LeadAssignModal({ open, onOpenChange, lead, salespersons = [], onSave }) {
  const [assignedToId, setAssignedToId] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [status, setStatus] = useState("new");

  useEffect(() => {
    if (lead) {
      setAssignedToId(lead.assigned_to_id || "");
      setFollowUpDate(lead.follow_up_date || "");
      setFollowUpNotes(lead.follow_up_notes || "");
      setStatus(lead.status || "new");
    }
  }, [lead, open]);

  const handleSave = () => {
    const sp = salespersons.find((s) => s.id === assignedToId);
    onSave({
      assigned_to_id: assignedToId || null,
      assigned_to: sp?.name || null,
      follow_up_date: followUpDate || null,
      follow_up_notes: followUpNotes || null,
      status,
    });
  };

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign & Schedule Lead</DialogTitle>
          <p className="text-sm text-muted-foreground">{lead.first_name} {lead.last_name}</p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Assign To</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger><SelectValue placeholder="Select salesperson..." /></SelectTrigger>
              <SelectContent>
                {salespersons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.current_lead_count || 0}/{s.max_leads || 10} leads)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["new", "contacted", "qualified", "quoted"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Follow-up Date</Label>
            <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Follow-up Notes</Label>
            <Textarea
              value={followUpNotes}
              onChange={(e) => setFollowUpNotes(e.target.value)}
              placeholder="What should the salesperson know or do?"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}