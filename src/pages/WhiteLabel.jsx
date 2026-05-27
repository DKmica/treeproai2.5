import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, Palette, Mail, Loader2, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/treeproWorkflow";

export default function WhiteLabel() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["white_label"],
    queryFn: () => base44.entities.WhiteLabelSettings.list(),
  });

  const existing = settings[0] || null;
  const [form, setForm] = useState({
    app_name: existing?.app_name || "",
    logo_url: existing?.logo_url || "",
    primary_color: existing?.primary_color || "#16a34a",
    secondary_color: existing?.secondary_color || "#f59e0b",
    custom_domain: existing?.custom_domain || "",
    support_email: existing?.support_email || "",
    footer_text: existing?.footer_text || "",
    show_powered_by: existing?.show_powered_by ?? true,
  });

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (existing) {
      await base44.entities.WhiteLabelSettings.update(existing.id, form);
    } else {
      await base44.entities.WhiteLabelSettings.create(form);
    }
    await logAudit({ actorName: "admin", action: "white_label_settings_updated", entityType: "WhiteLabelSettings", entityId: existing?.id || "new", newValue: form });
    qc.invalidateQueries({ queryKey: ["white_label"] });
    toast.success("White-label settings saved");
    setSaving(false);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Palette className="w-6 h-6 text-primary" /> White-Label Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Customize branding for your company's platform instance.</p>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>Integration required: Custom Domain</strong> — Custom domain configuration requires DNS setup and SSL provisioning at the infrastructure level. Contact your platform provider.
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4" /> Branding</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>App / Brand Name</Label>
              <Input value={form.app_name} onChange={set("app_name")} placeholder="Your Company Name" />
            </div>
            <div className="space-y-1">
              <Label>Logo URL</Label>
              <Input value={form.logo_url} onChange={set("logo_url")} placeholder="https://yourcompany.com/logo.png" />
              {form.logo_url && <img src={form.logo_url} alt="Logo preview" className="h-10 mt-1 rounded" />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <input type="color" value={form.primary_color} onChange={set("primary_color")} className="h-9 w-12 rounded border cursor-pointer" />
                  <Input value={form.primary_color} onChange={set("primary_color")} className="flex-1 font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  <input type="color" value={form.secondary_color} onChange={set("secondary_color")} className="h-9 w-12 rounded border cursor-pointer" />
                  <Input value={form.secondary_color} onChange={set("secondary_color")} className="flex-1 font-mono text-sm" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4" /> Domain & Links</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Custom Domain <Badge className="ml-2 bg-orange-100 text-orange-700 text-xs border-0">Integration required: DNS setup</Badge></Label>
              <Input value={form.custom_domain} onChange={set("custom_domain")} placeholder="app.yourcompany.com" />
              <p className="text-xs text-muted-foreground">DNS CNAME and SSL setup required at infrastructure level.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Mail className="w-4 h-4" /> Email & Footer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Support Email</Label>
              <Input type="email" value={form.support_email} onChange={set("support_email")} placeholder="support@yourcompany.com" />
            </div>
            <div className="space-y-1">
              <Label>Footer Text</Label>
              <Input value={form.footer_text} onChange={set("footer_text")} placeholder="© 2025 Your Company. All rights reserved." />
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={form.show_powered_by} onChange={e => setForm(f => ({ ...f, show_powered_by: e.target.checked }))} className="w-4 h-4" />
              Show "Powered by TreePro AI" in footer
            </label>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="gap-2 w-full sm:w-auto">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save White-Label Settings
        </Button>
      </form>
    </div>
  );
}