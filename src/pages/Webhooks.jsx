import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Webhook, Plus, Trash2, Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const EVENT_OPTIONS = [
  { id: "lead.created", label: "Lead Created" },
  { id: "analysis.created", label: "AI Analysis Created" },
  { id: "quote.approved", label: "Quote Approved" },
  { id: "quote.rejected", label: "Quote Rejected" },
  { id: "job.started", label: "Job Started" },
  { id: "job.completed", label: "Job Completed" },
  { id: "invoice.created", label: "Invoice Created" },
  { id: "invoice.paid", label: "Invoice Paid (Full)" },
  { id: "payment.recorded", label: "Payment Recorded" },
  { id: "customer.created", label: "Customer Created" },
];

function WebhookForm({ onClose, onSave }) {
  const [form, setForm] = useState({ url: "", events: [], notes: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.url.startsWith("http")) { toast.error("Enter a valid URL starting with https://"); return; }
    if (form.events.length === 0) { toast.error("Select at least one event"); return; }
    setSaving(true);
    // Generate a placeholder secret
    const arr = new Uint8Array(20);
    crypto.getRandomValues(arr);
    const secret = "whsec_" + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    await onSave({ ...form, secret_placeholder: secret, is_active: true, failure_count: 0 });
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Webhook Endpoint</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Endpoint URL *</Label>
            <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://yourapp.com/webhooks/treepro" type="url" />
          </div>
          <div className="space-y-2">
            <Label>Events to Subscribe *</Label>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_OPTIONS.map(ev => (
                <label key={ev.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={form.events.includes(ev.id)}
                    onChange={e => setForm(f => ({ ...f, events: e.target.checked ? [...f.events, ev.id] : f.events.filter(x => x !== ev.id) }))}
                    className="w-3.5 h-3.5"
                  />
                  {ev.label}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What is this webhook for?" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Endpoint
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Webhooks() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => base44.entities.WebhookEndpoint.list("-created_date"),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.WebhookEndpoint.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); setShowCreate(false); toast.success("Webhook endpoint created"); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.WebhookEndpoint.update(id, { is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); toast.success("Webhook updated"); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.WebhookEndpoint.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhooks"] }); toast.success("Webhook deleted"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Webhook className="w-6 h-6 text-primary" /> Webhook Endpoints
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Configure webhooks to receive real-time events in external systems.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Endpoint
        </Button>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>Integration required: Webhook delivery</strong> — Actual webhook HTTP delivery requires a backend function or automation to POST to these endpoints when events occur.
          This UI manages endpoint configuration. Use the automations system to wire up event delivery.
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Webhook className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-muted-foreground">No webhook endpoints yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => (
            <Card key={wh.id} className={!wh.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {wh.is_active
                        ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        : <XCircle className="w-4 h-4 text-gray-400 shrink-0" />
                      }
                      <p className="font-mono text-sm font-medium truncate">{wh.url}</p>
                      <Badge className={wh.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                        {wh.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {(wh.failure_count || 0) > 0 && (
                        <Badge className="bg-red-100 text-red-700">{wh.failure_count} failures</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(wh.events || []).map(ev => (
                        <Badge key={ev} variant="outline" className="text-xs">{ev}</Badge>
                      ))}
                    </div>
                    {wh.notes && <p className="text-xs text-muted-foreground mt-1">{wh.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Created {wh.created_date ? format(new Date(wh.created_date), "MMM d, yyyy") : "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleMut.mutate({ id: wh.id, is_active: !wh.is_active })}>
                      {wh.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this webhook?")) deleteMut.mutate(wh.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && <WebhookForm onClose={() => setShowCreate(false)} onSave={(data) => createMut.mutate(data)} />}
    </div>
  );
}