import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Jan", revenue: 12400 },
  { month: "Feb", revenue: 18200 },
  { month: "Mar", revenue: 22100 },
  { month: "Apr", revenue: 28500 },
  { month: "May", revenue: 24800 },
  { month: "Jun", revenue: 31200 },
  { month: "Jul", revenue: 35600 },
  { month: "Aug", revenue: 29800 },
  { month: "Sep", revenue: 33400 },
  { month: "Oct", revenue: 37200 },
  { month: "Nov", revenue: 28900 },
  { month: "Dec", revenue: 41500 },
];

export default function RevenueChart() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Revenue Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(152, 55%, 28%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(152, 55%, 28%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(140, 12%, 90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(150, 10%, 45%)" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(150, 10%, 45%)" tickFormatter={(v) => `$${v / 1000}k`} />
              <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(152, 55%, 28%)" fill="url(#revenueGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}