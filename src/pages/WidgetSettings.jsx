import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code, Copy, Globe, Loader2, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function WidgetSettings() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["widget_settings"],
    queryFn: () => base44.entities.PublicWidgetSettings.list(),
  });

  const existing = settings[0] || null;
  const [form, setForm] = useState({
    widget_enabled: existing?.widget_enabled ?? true,
    widget_title: existing?.widget_title || "Get a Free Tree Service Estimate",
    welcome_message: existing?.welcome_message || "Upload photos of your tree and get an AI-powered estimate instantly.",
    brand_color: existing?.brand_color || "#16a34a",
    success_message: existing?.success_message || "Thank you! Our team will follow up within 1 business day.",
    disclaimer: existing?.disclaimer || "This is a preliminary AI estimate. A certified arborist will confirm pricing on-site.",
    require_phone: existing?.require_phone ?? true,
    require_email: existing?.require_email ?? false,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        widget_enabled: existing.widget_enabled ?? true,
        widget_title: existing.widget_title || "Get a Free Tree Service Estimate",
        welcome_message: existing.welcome_message || "",
        brand_color: existing.brand_color || "#16a34a",
        success_message: existing.success_message || "",
        disclaimer: existing.disclaimer || "",
        require_phone: existing.require_phone ?? true,
        require_email: existing.require_email ?? false,
      });
    }
  }, [existing?.id]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  const publicUrl = `${window.location.origin}/estimate`;
  const embedCode = `<iframe
  src="${publicUrl}"
  width="100%"
  height="700"
  frameborder="0"
  title="${form.widget_title}"
  style="border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12);"
></iframe>`;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const data = { ...form, iframe_embed_code: embedCode, public_url: publicUrl };
    if (existing) {
      await base44.entities.PublicWidgetSettings.update(existing.id, data);
    } else {
      await base44.entities.PublicWidgetSettings.create(data);
    }
    qc.invalidateQueries({ queryKey: ["widget_settings"] });
    toast.success("Widget settings saved");
    setSaving(false);
  };

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Embed code copied!");
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary" /> Public Widget Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configure the public estimate widget that generates leads.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Widget Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
              <input type="checkbox" checked={form.widget_enabled} onChange={e => setForm(f => ({ ...f, widget_enabled: e.target.checked }))} className="w-4 h-4 accent-green-600" />
              Widget Enabled (public estimate page active)
            </label>
            <div className="space-y-1">
              <Label>Widget Title</Label>
              <Input value={form.widget_title} onChange={set("widget_title")} />
            </div>
            <div className="space-y-1">
              <Label>Welcome Message</Label>
              <Textarea value={form.welcome_message} onChange={set("welcome_message")} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Brand Color</Label>
              <div className="flex gap-2">
                <input type="color" value={form.brand_color} onChange={set("brand_color")} className="h-9 w-12 rounded border cursor-pointer" />
                <Input value={form.brand_color} onChange={set("brand_color")} className="flex-1 font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Success Message</Label>
              <Textarea value={form.success_message} onChange={set("success_message")} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Disclaimer Text</Label>
              <Textarea value={form.disclaimer} onChange={set("disclaimer")} rows={2} />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.require_phone} onChange={e => setForm(f => ({ ...f, require_phone: e.target.checked }))} className="w-4 h-4" />
                Require Phone
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.require_email} onChange={e => setForm(f => ({ ...f, require_email: e.target.checked }))} className="w-4 h-4" />
                Require Email
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Public URL */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4" /> Public Estimate URL</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={publicUrl} readOnly className="font-mono text-sm bg-muted" />
              <Button type="button" variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("URL copied"); }}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Open estimate page →</a>
          </CardContent>
        </Card>

        {/* Embed code */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Code className="w-4 h-4" /> Embed Code</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={copyEmbed} className="gap-1.5 text-xs">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Code"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">{embedCode}</pre>
            <p className="text-xs text-muted-foreground mt-2">Paste this iframe code into any website to embed the AI estimate widget.</p>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Widget Settings
        </Button>
      </form>
    </div>
  );
}