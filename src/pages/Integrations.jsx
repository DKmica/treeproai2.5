import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Plug, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const INTEGRATIONS = [
  { provider: "stripe", name: "Stripe", category: "Payments", description: "Accept credit card payments online. Enable the payment link on invoices.", icon: "💳", docs: "https://stripe.com" },
  { provider: "square", name: "Square", category: "Payments", description: "Point-of-sale and online payment processing.", icon: "⬛", docs: "https://squareup.com" },
  { provider: "quickbooks", name: "QuickBooks", category: "Accounting", description: "Sync invoices, payments, and expenses to QuickBooks Online.", icon: "📊", docs: "https://quickbooks.intuit.com" },
  { provider: "xero", name: "Xero", category: "Accounting", description: "Accounting software for invoice and payment sync.", icon: "📈", docs: "https://xero.com" },
  { provider: "google_calendar", name: "Google Calendar", category: "Scheduling", description: "Sync jobs to Google Calendar for crew scheduling.", icon: "📅", docs: "https://calendar.google.com" },
  { provider: "google_maps", name: "Google Maps", category: "Location", description: "Enable route optimization and map views for crew dispatch.", icon: "🗺️", docs: "https://maps.google.com" },
  { provider: "twilio", name: "Twilio", category: "SMS/Calls", description: "Send SMS reminders to customers and crew for appointments.", icon: "📱", docs: "https://twilio.com" },
  { provider: "sendgrid", name: "SendGrid", category: "Email", description: "Send automated emails for quotes, invoices, and follow-ups.", icon: "📧", docs: "https://sendgrid.com" },
  { provider: "zapier", name: "Zapier", category: "Automation", description: "Connect to 5,000+ apps via Zapier workflows.", icon: "⚡", docs: "https://zapier.com" },
  { provider: "make", name: "Make (Integromat)", category: "Automation", description: "Advanced automation and integration scenarios.", icon: "🔧", docs: "https://make.com" },
];

const STATUS_CONFIG = {
  not_connected: { label: "Not Connected", color: "bg-gray-100 text-gray-600", icon: XCircle },
  connected: { label: "Connected", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  setup_required: { label: "Setup Required", color: "bg-yellow-100 text-yellow-700", icon: AlertCircle },
  error: { label: "Error", color: "bg-red-100 text-red-700", icon: XCircle },
};

const CATEGORIES = ["All", "Payments", "Accounting", "Scheduling", "Location", "SMS/Calls", "Email", "Automation"];

export default function Integrations() {
  const [activeCategory, setActiveCategory] = useState("All");
  const qc = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["integration_settings"],
    queryFn: () => base44.entities.IntegrationSettings.list(),
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ provider, status, notes }) => {
      const existing = settings.find(s => s.provider === provider);
      if (existing) {
        return base44.entities.IntegrationSettings.update(existing.id, { status, notes, connected_at: status === "connected" ? new Date().toISOString() : undefined });
      } else {
        return base44.entities.IntegrationSettings.create({ provider, status, notes, is_enabled: status === "connected" });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["integration_settings"] }); toast.success("Integration status updated"); },
  });

  const getStatus = (provider) => {
    const s = settings.find(s => s.provider === provider);
    return s?.status || "not_connected";
  };

  const filtered = INTEGRATIONS.filter(i => activeCategory === "All" || i.category === activeCategory);
  const connectedCount = settings.filter(s => s.status === "connected").length;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Plug className="w-6 h-6 text-primary" /> Integrations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect third-party services to extend your platform. {connectedCount > 0 && `${connectedCount} connected.`}
        </p>
      </div>

      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
        <AlertCircle className="w-4 h-4 inline mr-1.5" />
        <strong>Integration Required:</strong> These connections require external account setup and API configuration. Mark integrations as "Setup Required" to track what needs attention.
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map(integration => {
          const status = getStatus(integration.provider);
          const config = STATUS_CONFIG[status];
          const StatusIcon = config.icon;

          return (
            <Card key={integration.provider} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{integration.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{integration.name}</h3>
                        <Badge variant="outline" className="text-xs">{integration.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{integration.description}</p>
                    </div>
                  </div>
                  <Badge className={`${config.color} gap-1 shrink-0 text-xs whitespace-nowrap`}>
                    <StatusIcon className="w-3 h-3" />{config.label}
                  </Badge>
                </div>

                <div className="flex gap-2 mt-4">
                  {status === "not_connected" && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                      onClick={() => upsertMutation.mutate({ provider: integration.provider, status: "setup_required", notes: "Pending setup" })}>
                      Mark Setup Required
                    </Button>
                  )}
                  {status === "setup_required" && (
                    <Button size="sm" className="gap-1.5 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => upsertMutation.mutate({ provider: integration.provider, status: "connected" })}>
                      <CheckCircle2 className="w-3 h-3" /> Mark Connected
                    </Button>
                  )}
                  {status === "connected" && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs text-destructive border-destructive/30"
                      onClick={() => upsertMutation.mutate({ provider: integration.provider, status: "not_connected" })}>
                      Disconnect
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs ml-auto" asChild>
                    <a href={integration.docs} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3" /> Docs
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}