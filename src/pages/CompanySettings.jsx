import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, DollarSign, Globe, Shield, Loader2, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_SETTINGS = {
  company_name: "",
  logo_url: "",
  primary_color: "#16a34a",
  phone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  service_area_description: "",
  default_timezone: "America/Chicago",
  default_currency: "USD",
  minimum_job_price: 150,
  default_labor_rate_per_hour: 75,
  crew_hourly_rate: 65,
  estimator_hourly_rate: 85,
  emergency_markup_percent: 40,
  risk_markup_percent: 20,
  profit_margin_percent: 35,
  travel_fee_base: 0,
  travel_fee_per_mile: 0,
  stump_grinding_base_price: 100,
  stump_grinding_per_inch: 4,
  crane_day_rate: 1500,
  dump_fee_base: 75,
  disposal_fee_per_cubic_yard: 25,
  quote_expiration_days: 30,
  public_estimate_disclaimer: "This is a preliminary AI-generated estimate based on photos and information provided. A certified arborist will confirm the final price during a free on-site visit. Prices may vary based on actual site conditions.",
  terms_and_conditions: "",
  customer_portal_enabled: false,
  public_widget_enabled: true,
  max_upload_photos: 10,
  max_photo_size_mb: 10,
  };

function FieldGroup({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function CompanySettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [settingsId, setSettingsId] = useState(null);

  const { data: settingsList = [], isLoading } = useQuery({
    queryKey: ["company_settings"],
    queryFn: () => base44.entities.CompanySettings.list(),
  });

  useEffect(() => {
    if (settingsList.length > 0) {
      const s = settingsList[0];
      setSettingsId(s.id);
      setForm({ ...DEFAULT_SETTINGS, ...s });
    }
  }, [settingsList]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (settingsId) {
        return base44.entities.CompanySettings.update(settingsId, data);
      } else {
        return base44.entities.CompanySettings.create(data);
      }
    },
    onSuccess: (result) => {
      if (!settingsId) setSettingsId(result.id);
      qc.invalidateQueries({ queryKey: ["company_settings"] });
      toast.success("Settings saved successfully");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const setNum = (field) => (e) => setForm((f) => ({ ...f, [field]: parseFloat(e.target.value) || 0 }));
  const setBool = (field) => (val) => setForm((f) => ({ ...f, [field]: val }));

  const isConfigured = !!form.company_name && !!form.phone;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure your business profile, pricing, and platform settings.</p>
        </div>
        <div className="flex items-center gap-3">
          {isConfigured ? (
            <Badge className="bg-green-100 text-green-800 border-green-200 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Configured
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
              <AlertCircle className="w-3 h-3" /> Setup Required
            </Badge>
          )}
          <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </Button>
        </div>
      </div>

      {!isConfigured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Complete your company setup</p>
              <p className="text-amber-700 text-xs mt-0.5">Add your company name, contact info, and pricing to get started. This information powers AI estimates and customer-facing pages.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="company">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
          <TabsTrigger value="company" className="gap-1.5"><Building2 className="w-3.5 h-3.5" />Company</TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" />Pricing</TabsTrigger>
          <TabsTrigger value="public" className="gap-1.5"><Globe className="w-3.5 h-3.5" />Public Widget</TabsTrigger>
          <TabsTrigger value="terms" className="gap-1.5"><Shield className="w-3.5 h-3.5" />Terms</TabsTrigger>
        </TabsList>

        {/* ── Company Info ─────────────────────────────── */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Company Information</CardTitle>
              <CardDescription>Your business contact details and service area.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup label="Company Name *">
                <Input value={form.company_name} onChange={set("company_name")} placeholder="Your Tree Service Company" />
              </FieldGroup>
              <FieldGroup label="Logo URL">
                <Input value={form.logo_url} onChange={set("logo_url")} placeholder="https://yourcompany.com/logo.png" />
                {form.logo_url && <img src={form.logo_url} alt="Logo preview" className="mt-2 h-12 object-contain rounded border" />}
              </FieldGroup>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup label="Phone">
                  <Input value={form.phone} onChange={set("phone")} placeholder="(555) 000-0000" />
                </FieldGroup>
                <FieldGroup label="Email">
                  <Input type="email" value={form.email} onChange={set("email")} placeholder="info@yourcompany.com" />
                </FieldGroup>
              </div>
              <FieldGroup label="Website">
                <Input value={form.website} onChange={set("website")} placeholder="https://yourcompany.com" />
              </FieldGroup>
              <FieldGroup label="Street Address">
                <Input value={form.address} onChange={set("address")} placeholder="123 Main St" />
              </FieldGroup>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <FieldGroup label="City">
                  <Input value={form.city} onChange={set("city")} placeholder="City" />
                </FieldGroup>
                <FieldGroup label="State">
                  <Input value={form.state} onChange={set("state")} placeholder="TX" maxLength={2} />
                </FieldGroup>
                <div className="col-span-2 sm:col-span-2">
                  <FieldGroup label="ZIP">
                    <Input value={form.zip} onChange={set("zip")} placeholder="00000" />
                  </FieldGroup>
                </div>
              </div>
              <FieldGroup label="Service Area Description">
                <Textarea value={form.service_area_description} onChange={set("service_area_description")} placeholder="e.g. Serving Dallas-Fort Worth and surrounding areas within 50 miles" rows={2} />
              </FieldGroup>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldGroup label="Default Timezone">
                  <Input value={form.default_timezone} onChange={set("default_timezone")} placeholder="America/Chicago" />
                </FieldGroup>
                <FieldGroup label="Currency">
                  <Input value={form.default_currency} onChange={set("default_currency")} placeholder="USD" />
                </FieldGroup>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pricing ─────────────────────────────────── */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing & Rates</CardTitle>
              <CardDescription>These rates power your AI estimate engine and quote calculations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FieldGroup label="Minimum Job Price ($)">
                  <Input type="number" value={form.minimum_job_price} onChange={setNum("minimum_job_price")} />
                </FieldGroup>
                <FieldGroup label="Labor Rate / Hour ($)">
                  <Input type="number" value={form.default_labor_rate_per_hour} onChange={setNum("default_labor_rate_per_hour")} />
                </FieldGroup>
                <FieldGroup label="Crew Rate / Hour ($)">
                  <Input type="number" value={form.crew_hourly_rate} onChange={setNum("crew_hourly_rate")} />
                </FieldGroup>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FieldGroup label="Emergency Markup (%)">
                  <Input type="number" value={form.emergency_markup_percent} onChange={setNum("emergency_markup_percent")} />
                </FieldGroup>
                <FieldGroup label="Risk Markup (%)">
                  <Input type="number" value={form.risk_markup_percent} onChange={setNum("risk_markup_percent")} />
                </FieldGroup>
                <FieldGroup label="Profit Margin (%)">
                  <Input type="number" value={form.profit_margin_percent} onChange={setNum("profit_margin_percent")} />
                </FieldGroup>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Stump Grinding</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldGroup label="Base Price ($)">
                    <Input type="number" value={form.stump_grinding_base_price} onChange={setNum("stump_grinding_base_price")} />
                  </FieldGroup>
                  <FieldGroup label="Per Inch DBH ($)">
                    <Input type="number" value={form.stump_grinding_per_inch} onChange={setNum("stump_grinding_per_inch")} />
                  </FieldGroup>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Equipment & Disposal</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FieldGroup label="Crane Day Rate ($)">
                    <Input type="number" value={form.crane_day_rate} onChange={setNum("crane_day_rate")} />
                  </FieldGroup>
                  <FieldGroup label="Dump Fee Base ($)">
                    <Input type="number" value={form.dump_fee_base} onChange={setNum("dump_fee_base")} />
                  </FieldGroup>
                  <FieldGroup label="Disposal / Cubic Yard ($)">
                    <Input type="number" value={form.disposal_fee_per_cubic_yard} onChange={setNum("disposal_fee_per_cubic_yard")} />
                  </FieldGroup>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Travel & Quotes</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FieldGroup label="Travel Base Fee ($)">
                    <Input type="number" value={form.travel_fee_base} onChange={setNum("travel_fee_base")} />
                  </FieldGroup>
                  <FieldGroup label="Travel Fee / Mile ($)">
                    <Input type="number" value={form.travel_fee_per_mile} onChange={setNum("travel_fee_per_mile")} />
                  </FieldGroup>
                  <FieldGroup label="Quote Expiration (days)">
                    <Input type="number" value={form.quote_expiration_days} onChange={setNum("quote_expiration_days")} />
                  </FieldGroup>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Public Widget ───────────────────────────── */}
        <TabsContent value="public">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Public Estimate Widget</CardTitle>
              <CardDescription>Control the public-facing AI estimate page and embed widget.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">Public Estimate Page</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow customers to get AI estimates at <code className="bg-muted px-1 rounded">/estimate</code></p>
                </div>
                <Button
                  variant={form.public_widget_enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBool("public_widget_enabled")(!form.public_widget_enabled)}
                >
                  {form.public_widget_enabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">Customer Portal</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow customers to view and approve quotes online</p>
                </div>
                <Button
                  variant={form.customer_portal_enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBool("customer_portal_enabled")(!form.customer_portal_enabled)}
                >
                  {form.customer_portal_enabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Public Estimate URL</p>
                <p className="text-xs text-muted-foreground mb-2">Share this link or embed it on your website:</p>
                <code className="block text-xs bg-card border rounded p-2 break-all select-all">
                  {window.location.origin}/estimate
                </code>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <FieldGroup label="Max Upload Photos">
                  <Input type="number" value={form.max_upload_photos || 10} onChange={setNum("max_upload_photos")} />
                </FieldGroup>
                <FieldGroup label="Max Photo Size (MB)">
                  <Input type="number" value={form.max_photo_size_mb || 10} onChange={setNum("max_photo_size_mb")} />
                </FieldGroup>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Terms ────────────────────────────────────── */}
        <TabsContent value="terms">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Legal & Disclaimers</CardTitle>
              <CardDescription>These appear on quotes, proposals, and the public estimate page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldGroup label="Public Estimate Disclaimer">
                <Textarea
                  value={form.public_estimate_disclaimer}
                  onChange={set("public_estimate_disclaimer")}
                  placeholder="This is a preliminary estimate..."
                  rows={4}
                />
              </FieldGroup>
              <FieldGroup label="Terms & Conditions">
                <Textarea
                  value={form.terms_and_conditions}
                  onChange={set("terms_and_conditions")}
                  placeholder="Enter your standard terms and conditions..."
                  rows={8}
                />
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end pb-8">
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} size="lg" className="gap-2">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
}