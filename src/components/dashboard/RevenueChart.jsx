import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function RevenueChart() {
  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => base44.entities.Job.list("-created_date", 500),
  });
  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes"],
    queryFn: () => base44.entities.Quote.list("-created_date", 500),
  });

  // Build last 12 months from real job + quote data
  const chartData = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const yearMonth = format(d, "yyyy-MM");
    const monthLabel = format(d, "MMM");

    // Revenue = total_cost of completed/invoiced/paid jobs in that month
    const revenue = jobs
      .filter(j =>
        ["completed", "invoiced", "paid"].includes(j.status) &&
        (j.completion_date?.startsWith(yearMonth) || j.updated_date?.startsWith(yearMonth))
      )
      .reduce((s, j) => s + (j.total_cost || 0), 0);

    // Won quotes = approved/converted quotes created that month
    const wonQuotes = quotes
      .filter(q =>
        ["approved", "converted_to_job", "invoiced", "paid"].includes(q.status) &&
        q.created_date?.startsWith(yearMonth)
      )
      .reduce((s, q) => s + (q.total_amount || 0), 0);

    chartData.push({ month: monthLabel, revenue, wonQuotes });
  }

  const hasData = chartData.some(d => d.revenue > 0 || d.wonQuotes > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Revenue Overview (12 months)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {!hasData ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No revenue data yet — complete jobs will appear here
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(194, 90%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(194, 90%, 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="quotesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(24, 90%, 55%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(24, 90%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 18%, 88%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(220, 12%, 48%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 12%, 48%)" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v, name) => [`$${v.toLocaleString()}`, name === "revenue" ? "Job Revenue" : "Won Quotes"]} />
                <Area type="monotone" dataKey="wonQuotes" name="wonQuotes" stroke="hsl(24, 90%, 55%)" fill="url(#quotesGrad)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="revenue" name="revenue" stroke="hsl(194, 90%, 45%)" fill="url(#revenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}