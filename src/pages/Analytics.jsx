import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, DollarSign, Users, Briefcase, FileText } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { format } from "date-fns";

const COLORS = ["#16a34a", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"];

function StatCard({ label, value, sub, icon: IconComponent, color = "text-primary" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          {IconComponent && <IconComponent className={`w-5 h-5 mt-0.5 ${color} opacity-60`} />}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const { data: leads = [], isLoading: loadingLeads } = useQuery({ queryKey: ["leads"], queryFn: () => base44.entities.Lead.list("-created_date", 500) });
  const { data: quotes = [], isLoading: loadingQuotes } = useQuery({ queryKey: ["quotes"], queryFn: () => base44.entities.Quote.list("-created_date", 500) });
  const { data: jobs = [], isLoading: loadingJobs } = useQuery({ queryKey: ["jobs"], queryFn: () => base44.entities.Job.list("-created_date", 500) });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => base44.entities.Customer.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: () => base44.entities.Invoice.list("-created_date", 500) });
  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: () => base44.entities.Payment.list("-created_date", 200) });
  const { data: payrollRecords = [] } = useQuery({ queryKey: ["payroll_records"], queryFn: () => base44.entities.PayrollRecord.list("-created_date", 500) });

  const isLoading = loadingLeads || loadingQuotes || loadingJobs;

  // Key metrics
  const totalRevenue = invoices.filter(i => ["paid", "partially_paid"].includes(i.status)).reduce((s, i) => s + (i.amount_paid || i.total || 0), 0);
  const pendingRevenue = invoices.filter(i => ["sent", "viewed", "overdue"].includes(i.status)).reduce((s, i) => s + (i.balance_due || i.total || 0), 0);
  const overdueRevenue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + (i.balance_due || 0), 0);

  const approvedQuotes = quotes.filter(q => ["approved", "converted_to_job", "invoiced", "paid"].includes(q.status));
  const sentQuotes = quotes.filter(q => ["sent", "viewed", "approved", "converted_to_job", "invoiced", "paid"].includes(q.status));
  const conversionRate = sentQuotes.length > 0 ? Math.round((approvedQuotes.length / sentQuotes.length) * 100) : 0;

  const pendingQuoteValue = quotes.filter(q => ["draft", "needs_review", "sent", "viewed"].includes(q.status)).reduce((s, q) => s + (q.total_amount || 0), 0);
  const avgTicket = approvedQuotes.length > 0 ? Math.round(approvedQuotes.reduce((s, q) => s + (q.total_amount || 0), 0) / approvedQuotes.length) : 0;

  // Payroll analytics
  const paidPayroll = payrollRecords.filter(r => r.status === "paid");
  const totalPayrollCost = paidPayroll.reduce((s, r) => s + (r.gross_pay || 0), 0);
  const totalCommissionPaid = paidPayroll.reduce((s, r) => s + (r.commission_total || 0) + (r.sales_commission_total || 0), 0);
  const totalStumpPay = paidPayroll.reduce((s, r) => s + (r.stump_pay_total || 0), 0);
  const payrollByPosition = paidPayroll.reduce((acc, r) => {
    acc[r.position] = (acc[r.position] || 0) + (r.gross_pay || 0);
    return acc;
  }, {});
  const payrollPositionData = Object.entries(payrollByPosition).map(([name, value]) => ({ name, value: Math.round(value) }));
  // Labor margin: revenue - payroll cost
  const laborMargin = totalRevenue > 0 ? Math.round(((totalRevenue - totalPayrollCost) / totalRevenue) * 100) : null;

  const completedJobs = jobs.filter(j => ["completed", "invoiced", "paid"].includes(j.status)).length;
  const activeJobs = jobs.filter(j => ["scheduled", "dispatched", "in_progress"].includes(j.status)).length;

  // Quote status breakdown
  const quoteStatusData = [
    { name: "Draft", value: quotes.filter(q => q.status === "draft").length },
    { name: "Sent", value: quotes.filter(q => q.status === "sent").length },
    { name: "Viewed", value: quotes.filter(q => q.status === "viewed").length },
    { name: "Approved", value: approvedQuotes.length },
    { name: "Rejected", value: quotes.filter(q => q.status === "rejected").length },
    { name: "Converted", value: quotes.filter(q => q.status === "converted_to_job").length },
  ].filter(d => d.value > 0);

  // Lead source breakdown
  const sourceMap = {};
  leads.forEach(l => { const s = l.source || "other"; sourceMap[s] = (sourceMap[s] || 0) + 1; });
  const leadSourceData = Object.entries(sourceMap).map(([name, value]) => ({ name, value }));

  // Lead status funnel
  const leadStatusData = [
    { name: "New", value: leads.filter(l => l.status === "new").length },
    { name: "Contacted", value: leads.filter(l => l.status === "contacted").length },
    { name: "Qualified", value: leads.filter(l => l.status === "qualified").length },
    { name: "Quoted", value: leads.filter(l => l.status === "quoted").length },
    { name: "Won", value: leads.filter(l => l.status === "won").length },
    { name: "Lost", value: leads.filter(l => l.status === "lost").length },
  ].filter(d => d.value > 0);

  // Job status breakdown
  const jobStatusData = [
    { name: "Unscheduled", value: jobs.filter(j => j.status === "unscheduled").length },
    { name: "Scheduled", value: jobs.filter(j => j.status === "scheduled").length },
    { name: "In Progress", value: jobs.filter(j => j.status === "in_progress").length },
    { name: "Completed", value: jobs.filter(j => j.status === "completed").length },
    { name: "Invoiced", value: jobs.filter(j => j.status === "invoiced").length },
    { name: "Paid", value: jobs.filter(j => j.status === "paid").length },
  ].filter(d => d.value > 0);

  // Revenue by month (last 6 months)
  const monthlyRevenue = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthStr = format(d, "MMM");
    const yearMonth = format(d, "yyyy-MM");
    const rev = invoices
      .filter(inv => inv.updated_date?.startsWith(yearMonth) && ["paid","partially_paid"].includes(inv.status))
      .reduce((s, inv) => s + (inv.amount_paid || 0), 0);
    const quoteVal = quotes
      .filter(q => q.created_date?.startsWith(yearMonth))
      .reduce((s, q) => s + (q.total_amount || 0), 0);
    monthlyRevenue.push({ month: monthStr, revenue: rev, quotes: quoteVal });
  }

  // Invoice status breakdown
  const invoiceStatusData = [
    { name: "Draft", value: invoices.filter(i => i.status === "draft").length },
    { name: "Sent", value: invoices.filter(i => i.status === "sent").length },
    { name: "Paid", value: invoices.filter(i => i.status === "paid").length },
    { name: "Overdue", value: invoices.filter(i => i.status === "overdue").length },
    { name: "Partial", value: invoices.filter(i => i.status === "partially_paid").length },
  ].filter(d => d.value > 0);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Business performance overview</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} sub="From paid invoices" icon={DollarSign} color="text-green-600" />
        <StatCard label="Pending Revenue" value={`$${pendingRevenue.toLocaleString()}`} sub="Outstanding invoices" icon={DollarSign} color="text-yellow-600" />
        {overdueRevenue > 0 && <StatCard label="Overdue" value={`$${overdueRevenue.toLocaleString()}`} sub="Past due date" icon={DollarSign} color="text-red-600" />}
        <StatCard label="Pending Quotes" value={`$${pendingQuoteValue.toLocaleString()}`} sub="Open quote pipeline" icon={FileText} />
        <StatCard label="Quote Conversion" value={`${conversionRate}%`} sub={`${approvedQuotes.length} of ${sentQuotes.length} sent`} icon={TrendingUp} color="text-blue-600" />
        <StatCard label="Avg Ticket" value={`$${avgTicket.toLocaleString()}`} sub="Per approved quote" icon={DollarSign} />
        <StatCard label="Completed Jobs" value={completedJobs} sub={`${activeJobs} active now`} icon={Briefcase} color="text-green-600" />
        <StatCard label="Total Customers" value={customers.length} sub={`${leads.length} total leads`} icon={Users} />
        <StatCard label="Total Payroll Paid" value={`$${totalPayrollCost.toLocaleString()}`} sub="Gross wages paid" icon={DollarSign} color="text-orange-600" />
        <StatCard label="Commission Paid" value={`$${totalCommissionPaid.toLocaleString()}`} sub="Work + sales commission" icon={DollarSign} color="text-purple-600" />
        {laborMargin !== null && <StatCard label="Labor Margin" value={`${laborMargin}%`} sub="Revenue after payroll" icon={TrendingUp} color={laborMargin > 50 ? "text-green-600" : "text-yellow-600"} />}
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Revenue & Quotes (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyRevenue.every(m => m.revenue === 0 && m.quotes === 0) ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No revenue data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyRevenue} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
                  <Bar dataKey="revenue" name="Revenue" fill="#16a34a" radius={[3,3,0,0]} />
                  <Bar dataKey="quotes" name="Quotes" fill="#f59e0b" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Quote Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {quoteStatusData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No quotes yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={quoteStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {quoteStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lead Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            {leadStatusData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No leads yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={leadStatusData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="value" name="Leads" fill="#3b82f6" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {leadSourceData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No leads yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={leadSourceData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {leadSourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Job Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {jobStatusData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No jobs yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={jobStatusData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Jobs" fill="#8b5cf6" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Invoice Status</CardTitle>
          </CardHeader>
          <CardContent>
            {invoiceStatusData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No invoices yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={invoiceStatusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {invoiceStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payroll breakdown */}
      {payrollPositionData.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Payroll Cost by Position (Paid)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={payrollPositionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => `$${v.toLocaleString()}`} />
                  <Bar dataKey="value" name="Payroll" fill="#f97316" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Payroll Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {[
                  { label: "Total Gross Payroll", value: `$${totalPayrollCost.toLocaleString()}` },
                  { label: "Work Commission", value: `$${paidPayroll.reduce((s,r)=>s+(r.commission_total||0),0).toLocaleString()}` },
                  { label: "Sales Commission", value: `$${paidPayroll.reduce((s,r)=>s+(r.sales_commission_total||0),0).toLocaleString()}` },
                  { label: "Stump Grinder Pay", value: `$${totalStumpPay.toLocaleString()}` },
                  { label: "Total Bonuses", value: `$${paidPayroll.reduce((s,r)=>s+(r.bonuses||0),0).toLocaleString()}` },
                  laborMargin !== null && { label: "Labor Margin %", value: `${laborMargin}%` },
                ].filter(Boolean).map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold">{row.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pipeline Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {[
              { label: "Total Leads", value: leads.length, sub: `${leads.filter(l=>l.status==="new").length} new` },
              { label: "Total Quotes", value: quotes.length, sub: `${quotes.filter(q=>["sent","viewed"].includes(q.status)).length} awaiting response` },
              { label: "Approved Quotes", value: approvedQuotes.length, sub: `${conversionRate}% conversion rate` },
              { label: "Active Jobs", value: activeJobs, sub: `${completedJobs} completed` },
              { label: "Total Invoices", value: invoices.length, sub: `${invoices.filter(i=>i.status==="overdue").length} overdue` },
              { label: "Total Customers", value: customers.length, sub: "all time" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <div className="text-right">
                  <span className="font-semibold">{row.value}</span>
                  {row.sub && <span className="text-xs text-muted-foreground ml-2">({row.sub})</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}