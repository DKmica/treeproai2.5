import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Key, Plus, Trash2, Loader2, AlertCircle, Copy, CheckCircle2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { logAudit } from "@/lib/treeproWorkflow";
import { useAuth } from "@/lib/AuthContext";

function generateKeyPreview() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  const raw = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return { prefix: `tp_${raw.slice(0, 8)}`, display: `tp_${raw.slice(0, 8)}...${raw.slice(-4)}` };
}

export default function APIKeys() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyData, setNewKeyData] = useState(null);
  const [form, setForm] = useState({ name: "", permissions: ["read"], notes: "" });

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api_keys"],
    queryFn: () => base44.entities.APIKey.list("-created_date"),
  });

  const createMut = useMutation({
    mutationFn: async (data) => {
      const { prefix, display } = generateKeyPreview();
      return base44.entities.APIKey.create({ ...data, key_prefix: prefix, is_active: true });
    },
    onSuccess: async (key) => {
      qc.invalidateQueries({ queryKey: ["api_keys"] });
      setNewKeyData(key);
      setShowCreate(false);
      await logAudit({ actorName: "admin", action: "api_key_created", entityType: "APIKey", entityId: key.id, newValue: { name: key.name, prefix: key.key_prefix } });
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.APIKey.update(id, { is_active }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api_keys"] }); toast.success("API key updated"); },
  });

  const deleteMut = useMutation({
    mutationFn: async (key) => {
      await base44.entities.APIKey.delete(key.id);
      await logAudit({ actorName: "admin", action: "api_key_deleted", entityType: "APIKey", entityId: key.id, oldValue: { name: key.name } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api_keys"] }); toast.success("API key deleted"); },
  });

  const PERMISSION_OPTIONS = ["read", "write", "leads", "quotes", "jobs", "invoices", "admin"];

  if (user && user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <ShieldOff className="w-12 h-12 text-muted-foreground opacity-40" />
        <p className="text-lg font-semibold text-muted-foreground">Admin Access Required</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Key className="w-6 h-6 text-primary" /> API Keys
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage API keys for programmatic access to your platform data.</p>
        </div>
        <Button onClick={() => { setForm({ name: "", permissions: ["read"], notes: "" }); setShowCreate(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Create API Key
        </Button>
      </div>

      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 flex gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>Security notice:</strong> API keys are stored as prefixes only. Raw keys are never stored after creation.
          Full API authentication requires backend implementation. This UI manages key metadata.
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-muted-foreground">No API keys yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map(key => (
            <Card key={key.id} className={!key.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{key.name}</p>
                      <Badge className={key.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                        {key.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {(key.scopes || []).map(s => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground mt-1">{key.key_prefix}••••••••••••</p>
                    {key.notes && <p className="text-xs text-muted-foreground mt-1">{key.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Created {key.created_date ? format(new Date(key.created_date), "MMM d, yyyy") : "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleMut.mutate({ id: key.id, is_active: !key.is_active })}>
                      {key.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this API key?")) deleteMut.mutate(key); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create API Key</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Key Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Zapier Integration" />
            </div>
            <div className="space-y-1">
              <Label>Permissions</Label>
              <div className="flex flex-wrap gap-2">
                {PERMISSION_OPTIONS.map(p => (
                  <label key={p} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(p)}
                      onChange={e => {
                        setForm(f => ({
                          ...f,
                          permissions: e.target.checked
                            ? [...f.permissions, p]
                            : f.permissions.filter(x => x !== p)
                        }));
                      }}
                      className="w-3.5 h-3.5"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What is this key used for?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => { if (!form.name.trim()) { toast.error("Name required"); return; } createMut.mutate({ name: form.name, scopes: form.permissions, notes: form.notes }); }} disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New key display */}
      {newKeyData && (
        <Dialog open onOpenChange={() => setNewKeyData(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600" /> API Key Created</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Your new API key has been created. The key prefix is shown below. The full raw key value is not stored and cannot be retrieved later.</p>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Key Prefix (stored)</p>
                <div className="flex gap-2">
                  <code className="font-mono text-sm flex-1">{newKeyData.key_prefix}••••••••••••</code>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(newKeyData.key_prefix); toast.success("Copied"); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                <strong>Backend integration required:</strong> To use this API key for real authentication, your backend functions must validate the key hash. This UI manages key metadata only.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setNewKeyData(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}