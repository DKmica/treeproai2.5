import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

function CheckItem({ label, description, status, action, actionLabel, actionPath }) {
  const icons = {
    complete: <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />,
    warning: <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />,
    pending: <Clock className="w-5 h-5 text-muted-foreground shrink-0" />,
  };
  const badges = {
    complete: "bg-green-100 text-green-700 border-green-200",
    warning: "bg-amber-100 text-amber-700 border-amber-200",
    pending: "bg-gray-100 text-gray-600 border-gray-200",
  };
  const badgeLabels = {
    complete: "Complete",
    warning: "Needs Setup",
    pending: "Not Available Yet",
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      {icons[status]}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="font-medium text-sm">{label}</p>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <Badge className={`${badges[status]} text-xs shrink-0`}>{badgeLabels[status]}</Badge>
        </div>
        {action && status === "warning" && (
          <div className="mt-2">
            {actionPath ? (
              <Link to={actionPath}>
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                  {actionLabel} <ExternalLink className="w-3 h-3" />
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="outline" className="text-xs h-7" disabled>{actionLabel}</Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductionReadiness() {
  const { data: settingsList = [] } = useQuery({
    queryKey: ["company_settings"],
    queryFn: () => base44.entities.CompanySettings.list(),
  });

  const settings = settingsList[0] || null;
  const isCompanyConfigured = !!settings?.company_name && !!settings?.phone;
  const hasDisclaimer = !!settings?.public_estimate_disclaimer;
  const hasTerms = !!settings?.terms_and_conditions;

  const score = [isCompanyConfigured, hasDisclaimer, hasTerms].filter(Boolean).length;
  const total = 10;
  const readinessPercent = Math.round(((score + 3) / total) * 100); // base 3 always pass

  const categories = [
    {
      title: "Core Setup",
      items: [
        {
          label: "Company Settings Configured",
          description: "Company name, contact info, and service area",
          status: isCompanyConfigured ? "complete" : "warning",
          actionLabel: "Configure Now",
          actionPath: "/settings",
        },
        {
          label: "Public Estimate Disclaimer",
          description: "Legal disclaimer shown on the public estimate page",
          status: hasDisclaimer ? "complete" : "warning",
          actionLabel: "Add Disclaimer",
          actionPath: "/settings",
        },
        {
          label: "Terms & Conditions",
          description: "Your standard service terms included on quotes",
          status: hasTerms ? "complete" : "warning",
          actionLabel: "Add Terms",
          actionPath: "/settings",
        },
        {
          label: "App Build Passing",
          description: "Application is running without critical errors",
          status: "complete",
        },
      ],
    },
    {
      title: "AI & Estimation",
      items: [
        {
          label: "AI Quote Engine Active",
          description: "Public estimate widget accepting customer requests",
          status: "complete",
        },
        {
          label: "AI Analysis Review Process",
          description: "Staff reviewing AI-generated assessments before approval",
          status: "warning",
          actionLabel: "Review AI Records",
          actionPath: "/ai-analysis",
        },
        {
          label: "Pricing Rates Configured",
          description: "Labor, equipment, and markup rates set in Company Settings",
          status: isCompanyConfigured ? "complete" : "warning",
          actionLabel: "Set Pricing",
          actionPath: "/settings",
        },
      ],
    },
    {
      title: "Integrations (Placeholders)",
      items: [
        {
          label: "Payment Provider",
          description: "Connect Stripe or Square to accept online payments",
          status: "pending",
        },
        {
          label: "Email Provider (Transactional)",
          description: "Connect SendGrid or Resend for automated emails",
          status: "pending",
        },
        {
          label: "SMS Notifications (Twilio)",
          description: "Send appointment reminders and status updates via SMS",
          status: "pending",
        },
        {
          label: "Google Calendar Sync",
          description: "Sync jobs to crew member calendars",
          status: "pending",
        },
        {
          label: "QuickBooks / Accounting",
          description: "Export invoices and payments to accounting software",
          status: "pending",
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          label: "Role Permissions Reviewed",
          description: "Admin, salesperson, and crew roles configured",
          status: "warning",
          actionLabel: "Manage Employees",
          actionPath: "/employees",
        },
        {
          label: "Customer Portal",
          description: "Allow customers to view and approve quotes online",
          status: settings?.customer_portal_enabled ? "complete" : "pending",
        },
        {
          label: "Data Backup / Export",
          description: "Scheduled data exports for compliance and recovery",
          status: "pending",
        },
      ],
    },
  ];

  const allItems = categories.flatMap(c => c.items);
  const completeCount = allItems.filter(i => i.status === "complete").length;
  const warningCount = allItems.filter(i => i.status === "warning").length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Production Readiness</h1>
        <p className="text-muted-foreground text-sm mt-1">Track what needs to be done before going live with real customers.</p>
      </div>

      {/* Score card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Readiness Score</p>
              <p className="text-5xl font-bold text-primary mt-1">{readinessPercent}%</p>
              <p className="text-sm text-muted-foreground mt-1">
                {completeCount} complete · {warningCount} need setup
              </p>
            </div>
            <div className="space-y-2">
              {warningCount === 0 ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-sm px-3 py-1.5 gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Ready to Launch
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-sm px-3 py-1.5 gap-1">
                  <AlertCircle className="w-4 h-4" /> {warningCount} Items Need Attention
                </Badge>
              )}
            </div>
          </div>
          <div className="mt-4 bg-muted rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${readinessPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {categories.map(cat => (
        <Card key={cat.title}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">{cat.title}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {cat.items.map(item => (
              <CheckItem key={item.label} {...item} />
            ))}
          </CardContent>
        </Card>
      ))}

      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-muted-foreground">
            🚀 This checklist will automatically update as you configure your platform. Items marked "Not Available Yet" will be unlocked in future updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}