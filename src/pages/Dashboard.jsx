import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, Briefcase, DollarSign } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import RecentActivity from "@/components/dashboard/RecentActivity";
import JobStatusChart from "@/components/dashboard/JobStatusChart";
import JobsCalendar from "@/components/dashboard/JobsCalendar";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => base44.entities.Lead.list() });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => base44.entities.Customer.list() });
  const { data: quotes = [] } = useQuery({ queryKey: ["quotes"], queryFn: () => base44.entities.Quote.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: () => base44.entities.Job.list() });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: () => base44.entities.Invoice.list() });

  const activeJobs = jobs.filter((j) => ["scheduled", "dispatched", "in_progress"].includes(j.status)).length;
  const totalRevenue = jobs.filter((j) => ["completed", "invoiced", "paid"].includes(j.status)).reduce((sum, j) => sum + (j.total_cost || 0), 0);
  const pendingQuotes = quotes.filter((q) => q.status === "sent" || q.status === "draft").length;
  const overdueInvoices = invoices.filter(i => i.status === "overdue").length;
  const newLeads = leads.filter(l => l.status === "new").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Your tree service operations at a glance</p>
        </div>
        {overdueInvoices > 0 && (
          <Badge
            className="bg-red-100 text-red-700 border-red-200 cursor-pointer"
            onClick={() => navigate("/invoices")}
          >
            ⚠ {overdueInvoices} overdue invoice{overdueInvoices > 1 ? "s" : ""}
          </Badge>
        )}
        {newLeads > 0 && (
          <Badge
            className="bg-blue-100 text-blue-700 border-blue-200 cursor-pointer"
            onClick={() => navigate("/leads")}
          >
            {newLeads} new lead{newLeads > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Leads" value={leads.filter((l) => l.status !== "won" && l.status !== "lost").length} icon={Users} color="blue" onClick={() => navigate("/leads")} />
        <StatCard title="Pending Quotes" value={pendingQuotes} icon={FileText} color="accent" onClick={() => navigate("/quotes")} />
        <StatCard title="Active Jobs" value={activeJobs} icon={Briefcase} color="primary" onClick={() => navigate("/jobs")} />
        <StatCard title="Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} color="purple" onClick={() => navigate("/invoices")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <JobStatusChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <JobsCalendar />
        </div>
        <RecentActivity />
      </div>
    </div>
  );
}