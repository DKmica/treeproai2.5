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
  const { data: settings = [], isLoading: loadingSettings } = useQuery({ queryKey: ["company_settings"], queryFn: () => base44.entities.CompanySettings.list() });
  const { data: employees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => base44.entities.Employee.list() });
  const { data: quotes = [] } = useQuery({ queryKey: ["quotes"], queryFn: () => base44.entities.Quote.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: () => base44.entities.Job.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: () => base44.entities.Invoice.list() });
  const { data: salespersons = [] } = useQuery({ queryKey: ["salespersons"], queryFn: () => base44.entities.Salesperson.list() });
  const { data: crews = [] } = useQuery({ queryKey: ["crews"], queryFn: () => base44.entities.Crew.list() });
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => base44.entities.Lead.list() });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => base44.entities.Customer.list() });
  const { data: aiRecords = [] } = useQuery({ queryKey: ["ai_analysis"], queryFn: () => base44.entities.AIAnalysisRecord.list() });
  const { data: equipment = [] } = useQuery({ queryKey: ["equipment"], queryFn: () => base44.entities.Equipment.list() });
  const { data: integrations = [] } = useQuery({ queryKey: ["integration_settings"], queryFn: () => base44.entities.IntegrationSettings.list() });
  const { data: trees = [] } = useQuery({ queryKey: ["trees"], queryFn: () => base44.entities.TreeRecord.list() });
  const { data: maintenance = [] } = useQuery({ queryKey: ["maintenance"], queryFn: () => base44.entities.MaintenanceRecord.list() });
  const { data: notifications = [] } = useQuery({ queryKey: ["notifications"], queryFn: () => base44.entities.Notification.list() });
  const { data: activityLogs = [] } = useQuery({ queryKey: ["activity_logs"], queryFn: () => base44.entities.ActivityLog.list() });
  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: () => base44.entities.Payment.list() });

  const s = settings[0] || null;

  // Company setup checks
  const hasCompanyName = !!s?.company_name && s.company_name !== "Your Tree Service Company" && !["accurate tree","dallas","demo"].some(v => s.company_name?.toLowerCase().includes(v));
  const hasPhone = !!s?.phone && s.phone !== "(555) 000-0000";
  const hasEmail = !!s?.email;
  const hasDisclaimer = !!s?.public_estimate_disclaimer;
  const hasTerms = !!s?.terms_and_conditions;
  const hasPricing = s && (s.minimum_job_price || 0) > 0 && (s.crew_hourly_rate || 0) > 0;
  const hasPricingFloors = s && (s.minimum_large_removal_price || 0) > 0 && (s.minimum_extreme_removal_price || 0) > 0 && (s.minimum_crane_removal_price || 0) > 0;
  const hasPortal = !!s?.customer_portal_enabled;
  const hasWidget = !!s?.public_widget_enabled;
  const hasServiceArea = !!s?.service_area_description;
  const hasLogo = !!s?.logo_url;

  // Workflow checks
  const hasApprovedQuote = quotes.some(q => ["approved", "converted_to_job", "invoiced", "paid"].includes(q.status));
  const hasCompletedJob = jobs.some(j => ["completed", "invoiced", "paid"].includes(j.status));
  const hasPaidInvoice = invoices.some(i => i.status === "paid");
  const hasConvertedQuoteToJob = quotes.some(q => q.status === "converted_to_job");
  const hasCrewCompleted = jobs.some(j => j.status === "completed" && j.crew_id);
  const hasPublicLead = leads.some(l => l.source === "website" || l.source === "form");
  const hasAIAnalysis = aiRecords.length > 0;
  const hasReviewedAnalysis = aiRecords.some(r => r.human_review_status === "reviewed" || r.human_review_status === "corrected");
  const hasPaymentRecorded = payments.length > 0;

  // Team checks
  const hasCrews = crews.length > 0;
  const hasEmployees = employees.length > 0;
  const hasSalespeople = salespersons.length > 0;

  // Data checks
  const hasCustomers = customers.length > 0;
  const hasEquipment = equipment.length > 0;
  const hasMaintenanceRecord = maintenance.length > 0;
  const hasTreeInventory = trees.length > 0;
  const hasNotifications = notifications.length > 0;
  const hasActivityLog = activityLogs.length > 0;

  // Integration checks
  const getIntegrationStatus = (provider) => integrations.find(i => i.provider === provider)?.status || "not_connected";
  const hasPaymentIntegration = ["stripe","square"].some(p => getIntegrationStatus(p) === "connected");
  const hasEmailIntegration = getIntegrationStatus("sendgrid") === "connected";
  const hasSMSIntegration = getIntegrationStatus("twilio") === "connected";
  const hasAccountingIntegration = ["quickbooks","xero"].some(p => getIntegrationStatus(p) === "connected");

  // No hardcoded demo branding
  const noHardcodedBranding = hasCompanyName;

  if (loadingSettings) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  // Score calculations
  const companyChecks = [hasCompanyName, hasPhone, hasEmail, hasServiceArea, hasPricing, hasPricingFloors, hasLogo].filter(Boolean).length;
  const contentChecks = [hasDisclaimer, hasTerms, hasPortal].filter(Boolean).length;
  const workflowChecks = [hasPublicLead, hasAIAnalysis, hasReviewedAnalysis, hasApprovedQuote, hasConvertedQuoteToJob, hasCompletedJob, hasPaymentRecorded, hasPaidInvoice].filter(Boolean).length;
  const teamChecks = [hasCrews, hasEmployees, hasSalespeople, hasCustomers].filter(Boolean).length;
  const dataChecks = [hasEquipment, hasMaintenanceRecord, hasTreeInventory, hasActivityLog].filter(Boolean).length;
  const integrationChecks = [hasPaymentIntegration, hasEmailIntegration, hasSMSIntegration, hasAccountingIntegration].filter(Boolean).length;

  const totalPass = companyChecks + contentChecks + workflowChecks + teamChecks + dataChecks;
  const totalItems = 7 + 3 + 8 + 4 + 4;
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
              <p className="text-sm text-muted-foreground">{totalPass} of {totalItems} core items complete</p>
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

      <Section title="Company Setup" score={companyChecks} total={7}>
        <CheckItem label="Company name configured (no demo/hardcoded branding)" pass={hasCompanyName} link={!hasCompanyName ? "/settings" : null} note={!hasCompanyName ? "Remove any Dallas/DFW/Accurate Tree/demo references" : "Company name looks good"} />
        <CheckItem label="Phone number configured" pass={hasPhone} link={!hasPhone ? "/settings" : null} />
        <CheckItem label="Email address configured" pass={hasEmail} link={!hasEmail ? "/settings" : null} />
        <CheckItem label="Service area description" pass={hasServiceArea} link={!hasServiceArea ? "/settings" : null} />
        <CheckItem label="Base pricing rates configured" pass={hasPricing} link={!hasPricing ? "/settings" : null} note="Minimum job price, labor rate, crew rate" />
        <CheckItem label="Complexity-based pricing floors configured" pass={hasPricingFloors} link={!hasPricingFloors ? "/settings" : null} note="Minimums for large/high-risk/extreme/crane removals — ensures realistic pricing for complex trees" />
        <CheckItem label="Logo uploaded" pass={hasLogo} warning={!hasLogo} link="/settings" note="Optional but recommended for professional appearance" />
      </Section>

      <Section title="Legal & Content" score={contentChecks} total={3}>
        <CheckItem label="Public estimate disclaimer" pass={hasDisclaimer} link={!hasDisclaimer ? "/settings" : null} note="Appears on customer-facing estimate pages" />
        <CheckItem label="Terms & conditions" pass={hasTerms} warning={!hasTerms} link="/settings" note="Recommended for professional proposals" />
        <CheckItem label="Customer portal enabled" pass={hasPortal} warning={!hasPortal} link="/settings" note="Required for customer quote approval links" />
      </Section>

      <Section title="End-to-End Workflow" score={workflowChecks} total={8}>
        <CheckItem label="At least one lead from public estimate" pass={hasPublicLead} warning={!hasPublicLead} note="Test the public /estimate page" link="/estimate" />
        <CheckItem label="AI analysis record created" pass={hasAIAnalysis} warning={!hasAIAnalysis} note="Created when customers use public estimate" link="/ai-analysis" />
        <CheckItem label="AI analysis reviewed by staff" pass={hasReviewedAnalysis} warning={!hasReviewedAnalysis} link="/ai-analysis" />
        <CheckItem label="At least one quote approved" pass={hasApprovedQuote} warning={!hasApprovedQuote} note="Test the quote approval workflow" link="/quotes" />
        <CheckItem label="Quote converted to job" pass={hasConvertedQuoteToJob} warning={!hasConvertedQuoteToJob} link="/quotes" />
        <CheckItem label="At least one job completed" pass={hasCompletedJob} warning={!hasCompletedJob} note="Complete a job via Crew Mode or Jobs page" link="/jobs" />
        <CheckItem label="Payment recorded" pass={hasPaymentRecorded} warning={!hasPaymentRecorded} note="Record a payment on an invoice" link="/invoices" />
        <CheckItem label="At least one invoice paid" pass={hasPaidInvoice} warning={!hasPaidInvoice} link="/invoices" />
      </Section>

      <Section title="Team Setup" score={teamChecks} total={4}>
        <CheckItem label="Crew configured" pass={hasCrews} warning={!hasCrews} link="/jobs" note="Add at least one crew to assign jobs" />
        <CheckItem label="Employees added" pass={hasEmployees} link="/employees" note="Add team members for time tracking" />
        <CheckItem label="Sales team configured" pass={hasSalespeople} warning={!hasSalespeople} link="/sales" />
        <CheckItem label="Customers in system" pass={hasCustomers} warning={!hasCustomers} link="/customers" />
      </Section>

      <Section title="Data & Records" score={dataChecks} total={4}>
        <CheckItem label="Equipment tracked" pass={hasEquipment} warning={!hasEquipment} link="/equipment" />
        <CheckItem label="Maintenance records logged" pass={hasMaintenanceRecord} warning={!hasMaintenanceRecord} link="/maintenance" />
        <CheckItem label="Tree inventory started" pass={hasTreeInventory} warning={!hasTreeInventory} link="/tree-inventory" note="Track customer trees for repeat business" />
        <CheckItem label="Activity logs being created" pass={hasActivityLog} warning={!hasActivityLog} note="Created automatically as you use the platform" />
      </Section>

      <Section title="Integrations (External Setup Required)" score={integrationChecks} total={4}>
        <CheckItem label="Payment processing (Stripe/Square)" pass={hasPaymentIntegration} warning={!hasPaymentIntegration} note="Integration required — configure in Integrations" link="/integrations" />
        <CheckItem label="Email notifications (SendGrid)" pass={hasEmailIntegration} warning={!hasEmailIntegration} note="Integration required — for auto-emails to customers" link="/integrations" />
        <CheckItem label="SMS notifications (Twilio)" pass={hasSMSIntegration} warning={!hasSMSIntegration} note="Integration required — for crew dispatch alerts" link="/integrations" />
        <CheckItem label="Accounting integration (QuickBooks/Xero)" pass={hasAccountingIntegration} warning={!hasAccountingIntegration} note="Integration required — for financial sync" link="/integrations" />
      </Section>

      <div className="text-xs text-muted-foreground text-center pb-4">
        ✓ = Ready · ⚠ = Recommended but optional · ✗ = Action required before going live with real customers
      </div>
    </div>
  );
}