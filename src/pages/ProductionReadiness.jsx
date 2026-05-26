import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

function CheckItem({ label, pass, warning, link, note }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <div className="shrink-0 mt-0.5">
        {pass ? (
          <CheckCircle2 className="w-4 h-4 text-green-600" />
        ) : warning ? (
          <AlertCircle className="w-4 h-4 text-yellow-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${pass ? "text-foreground" : warning ? "text-yellow-700" : "text-muted-foreground"}`}>
          {label}
        </p>
        {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
      </div>
      {link && (
        <Link to={link} className="text-xs text-primary hover:underline shrink-0">Fix →</Link>
      )}
    </div>
  );
}

function Section({ title, children, score, total }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge className={pct === 100 ? "bg-green-100 text-green-700" : pct >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
            {score}/{total} complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

export default function ProductionReadiness() {
  const { data: settings = [], isLoading: loadingSettings } = useQuery({
    queryKey: ["company_settings"],
    queryFn: () => base44.entities.CompanySettings.list(),
  });
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => base44.entities.Employee.list() });
  const { data: quotes = [] } = useQuery({ queryKey: ["quotes"], queryFn: () => base44.entities.Quote.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: () => base44.entities.Job.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: () => base44.entities.Invoice.list() });
  const { data: salespersons = [] } = useQuery({ queryKey: ["salespersons"], queryFn: () => base44.entities.Salesperson.list() });
  const { data: crews = [] } = useQuery({ queryKey: ["crews"], queryFn: () => base44.entities.Crew.list() });

  const s = settings[0] || null;
  const hasCompanyName = !!s?.company_name && s.company_name !== "Your Tree Service Company";
  const hasPhone = !!s?.phone && s.phone !== "(555) 000-0000";
  const hasEmail = !!s?.email;
  const hasDisclaimer = !!s?.public_estimate_disclaimer;
  const hasTerms = !!s?.terms_and_conditions;
  const hasPricing = s && s.minimum_job_price > 0 && s.crew_hourly_rate > 0;
  const hasPortal = !!s?.customer_portal_enabled;
  const hasWidget = !!s?.public_widget_enabled;
  const hasServiceArea = !!s?.service_area_description;

  const hasApprovedQuote = quotes.some(q => q.status === "approved" || q.status === "converted_to_job");
  const hasCompletedJob = jobs.some(j => j.status === "completed" || j.status === "invoiced" || j.status === "paid");
  const hasPaidInvoice = invoices.some(i => i.status === "paid");
  const hasCrews = crews.length > 0;
  const hasEmployees = employees.length > 0;
  const hasSalespeople = salespersons.length > 0;

  if (loadingSettings) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const companyChecks = [hasCompanyName, hasPhone, hasEmail, hasServiceArea, hasPricing].filter(Boolean).length;
  const contentChecks = [hasDisclaimer, hasTerms].filter(Boolean).length;
  const workflowChecks = [hasApprovedQuote, hasCompletedJob, hasPaidInvoice].filter(Boolean).length;
  const teamChecks = [hasCrews, hasEmployees, hasSalespeople].filter(Boolean).length;

  const totalPass = companyChecks + contentChecks + workflowChecks + teamChecks;
  const totalItems = 5 + 2 + 3 + 3;
  const overallPct = Math.round((totalPass / totalItems) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Go-Live Checklist</h1>
        <p className="text-muted-foreground text-sm mt-1">Track what's needed before launching with real customers.</p>
      </div>

      {/* Overall */}
      <Card className={overallPct === 100 ? "border-green-400 bg-green-50" : overallPct >= 60 ? "border-yellow-400 bg-yellow-50" : "border-red-300 bg-red-50"}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-lg">{overallPct}% Ready</p>
              <p className="text-sm text-muted-foreground">{totalPass} of {totalItems} items complete</p>
            </div>
            {overallPct === 100 ? (
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            ) : (
              <div className="text-3xl font-bold text-muted-foreground">{overallPct}%</div>
            )}
          </div>
          <div className="mt-3 h-2 bg-white rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${overallPct === 100 ? "bg-green-500" : overallPct >= 60 ? "bg-yellow-500" : "bg-red-400"}`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Section title="Company Setup" score={companyChecks} total={5}>
        <CheckItem label="Company name configured" pass={hasCompanyName} link={!hasCompanyName ? "/settings" : null} note={!hasCompanyName ? "Set your real company name in Company Settings" : null} />
        <CheckItem label="Phone number configured" pass={hasPhone} link={!hasPhone ? "/settings" : null} />
        <CheckItem label="Email address configured" pass={hasEmail} link={!hasEmail ? "/settings" : null} />
        <CheckItem label="Service area description" pass={hasServiceArea} link={!hasServiceArea ? "/settings" : null} />
        <CheckItem label="Pricing rates configured" pass={hasPricing} link={!hasPricing ? "/settings" : null} note="Minimum job price, labor rate, crew rate" />
      </Section>

      <Section title="Legal & Content" score={contentChecks} total={2}>
        <CheckItem label="Public estimate disclaimer" pass={hasDisclaimer} link={!hasDisclaimer ? "/settings" : null} note="Appears on customer-facing estimate pages" />
        <CheckItem label="Terms & conditions" pass={hasTerms} warning={!hasTerms} link="/settings" note="Optional but recommended for professional proposals" />
      </Section>

      <Section title="Workflow Verification" score={workflowChecks} total={3}>
        <CheckItem label="At least one quote approved" pass={hasApprovedQuote} warning={!hasApprovedQuote} note="Test the quote approval workflow" link="/quotes" />
        <CheckItem label="At least one job completed" pass={hasCompletedJob} warning={!hasCompletedJob} note="Test the job completion workflow" link="/jobs" />
        <CheckItem label="At least one invoice paid" pass={hasPaidInvoice} warning={!hasPaidInvoice} note="Test the payment recording workflow" link="/invoices" />
      </Section>

      <Section title="Team Setup" score={teamChecks} total={3}>
        <CheckItem label="Crew configured" pass={hasCrews} warning={!hasCrews} link="/jobs" note="Add at least one crew to assign jobs" />
        <CheckItem label="Employees added" pass={hasEmployees} link="/employees" note="Add team members for time tracking" />
        <CheckItem label="Sales team configured" pass={hasSalespeople} warning={!hasSalespeople} link="/sales" note="Add salespersons for lead assignment" />
      </Section>

      <Section title="Integrations (Future)" score={0} total={4}>
        <CheckItem label="Payment processing (Stripe/Square)" pass={false} warning note="Integration required — set up in IntegrationSettings when ready" />
        <CheckItem label="Email notifications (SMTP/SendGrid)" pass={false} warning note="Integration required — needed for auto-emails to customers" />
        <CheckItem label="SMS notifications (Twilio)" pass={false} warning note="Integration required — for crew dispatch alerts" />
        <CheckItem label="Accounting integration (QuickBooks/Xero)" pass={false} warning note="Integration required — for financial sync" />
      </Section>

      <div className="text-xs text-muted-foreground text-center pb-4">
        Items marked with ⚠ are recommended but not blocking. Items marked ✗ should be fixed before going live.
      </div>
    </div>
  );
}