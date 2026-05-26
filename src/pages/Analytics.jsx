import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import StatCard from "@/components/dashboard/StatCard";
import { DollarSign, TrendingUp, Users, CheckCircle2 } from "lucide-react";

const PIE_COLORS = ["hsl(152,55%,28%)", "hsl(36,80%,50%)", "hsl(200,60%,45%)", "hsl(280,50%,55%)", "hsl(0,72%,51%)", "hsl(0,0%,70%)"];

export default function Analytics() {
  const { data: leads = [] } = useQuery({ queryKey: ["leads"], queryFn: () => base44.entities.Lead.list() });
  const { data: quotes = [] } = useQuery({ queryKey: ["quotes"], queryFn: () => base44.entities.Quote.list() });
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: () => base44.entities.Job.list() });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => base44.entities.Customer.list() });

  const completedJobs = jobs.filter((j) => j.status === "completed");
  const totalRevenue = completedJobs.reduce((s, j) => s + (j.total_cost || 0), 0);
  const acceptedQuotes = quotes.filter((q) => q.status === "accepted").length;
  const conversionRate = quotes.length > 0 ? Math.round((acceptedQuotes / quotes.length) * 100) : 0;

  const leadsBySource = leads.reduce((acc, l) => { acc[l.source || "other"] = (acc[l.source || "other"] || 0) + 1; return acc; }, {});
  const sourceData = Object.entries(leadsBySource).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));

  const leadsByStatus = leads.reduce((acc, l) => { acc[l.status || "new"] = (acc[l.status || "new"] || 0) + 1; return acc; }, {});
  const statusData = Object.entries(leadsByStatus).map(([name, value]) => ({ name, value }));

  const quotesByStatus = quotes.reduce((acc, q) => { acc[q.status || "draft"] = (acc[q.status || "draft"] || 0) + 1; return acc; }, {});
  const quoteData = Object.entries(quotesByStatus).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Business performance overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={DollarSign} color="primary" />
        <StatCard title="Quote Conversion" value={`${conversionRate}%`} icon={TrendingUp} color="accent" />
        <StatCard title="Total Customers" value={customers.length} icon={Users} color="blue" />
        <StatCard title="Jobs Completed" value={completedJobs.length} icon={CheckCircle2} color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Leads by Source</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(140,12%,90%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(152,55%,28%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Lead Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData.length > 0 ? statusData : [{ name: "No data", value: 1 }]} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {(statusData.length > 0 ? statusData : [{ name: "No data" }]).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Quote Status</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quoteData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(140,12%,90%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(36,80%,50%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}