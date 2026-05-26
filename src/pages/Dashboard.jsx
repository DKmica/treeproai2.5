import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Users, FileText, Briefcase, DollarSign, TreePine, TrendingUp } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import RecentActivity from "@/components/dashboard/RecentActivity";
import JobStatusChart from "@/components/dashboard/JobStatusChart";
import JobsCalendar from "@/components/dashboard/JobsCalendar";

export default function Dashboard() {
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => base44.entities.Lead.list() });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => base44.entities.Customer.list() });
  const { data: quotes = [] } = useQuery({ queryKey: ["quotes"], queryFn: () => base44.entities.Quote.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: () => base44.entities.Job.list() });

  const activeJobs = jobs.filter((j) => j.status === "scheduled" || j.status === "in_progress").length;
  const totalRevenue = jobs.filter((j) => j.status === "completed").reduce((sum, j) => sum + (j.total_cost || 0), 0);
  const pendingQuotes = quotes.filter((q) => q.status === "sent" || q.status === "draft").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your tree service operations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Leads" value={leads.filter((l) => l.status !== "won" && l.status !== "lost").length} icon={Users} color="blue" trend={12} />
        <StatCard title="Pending Quotes" value={pendingQuotes} icon={FileText} color="accent" />
        <StatCard title="Active Jobs" value={activeJobs} icon={Briefcase} color="primary" />
        <StatCard title="Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} color="purple" trend={8} />
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