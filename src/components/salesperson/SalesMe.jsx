import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Target, Clock, Star, ChevronRight, User, Phone, Mail } from "lucide-react";
import { isThisMonth, parseISO } from "date-fns";

export default function SalesMe({ leads = [], myLeads = [], quotes = [], user, employee }) {
  const monthLeads = myLeads.filter(l => l.created_date && isThisMonth(parseISO(l.created_date)));
  const wonLeads = myLeads.filter(l => l.status === "won");
  const wonThisMonth = myLeads.filter(l => l.status === "won" && l.updated_date && isThisMonth(parseISO(l.updated_date)));
  const activeLeads = myLeads.filter(l => !["won","lost","disqualified"].includes(l.status));

  const myQuotes = quotes.filter(q => q.lead_id && myLeads.some(l => l.id === q.lead_id));
  const sentQuotes = myQuotes.filter(q => ["sent","viewed","approved","converted_to_job","paid"].includes(q.status));
  const wonQuotes = myQuotes.filter(q => ["approved","converted_to_job","paid"].includes(q.status));
  const totalRevenue = wonQuotes.reduce((s, q) => s + (q.total_amount || 0), 0);
  const pendingRevenue = myQuotes.filter(q => ["sent","viewed"].includes(q.status)).reduce((s, q) => s + (q.total_amount || 0), 0);

  const closeRate = sentQuotes.length > 0 ? Math.round((wonQuotes.length / sentQuotes.length) * 100) : 0;
  const commissionRate = employee?.commission_percent || 0;
  const estimatedCommission = totalRevenue * (commissionRate / 100);

  const monthlyGoal = 20000;
  const goalPct = Math.min(100, Math.round((totalRevenue / monthlyGoal) * 100));

  const overdueFollowUps = myLeads.filter(l => {
    if (!l.follow_up_date) return false;
    try { return isPast(parseISO(l.follow_up_date)) && !isToday(parseISO(l.follow_up_date)); } catch { return false; }
  });

  function isPast(date) { return date < new Date(); }
  function isToday(date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  }

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* Profile */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-4">
        <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-xl font-bold">
          {(user?.full_name || "U").charAt(0)}
        </div>
        <div>
          <h2 className="font-bold text-lg">{user?.full_name || "Salesperson"}</h2>
          {employee && (
            <>
              {employee.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{employee.phone}</p>}
              {employee.territory && <Badge className="text-xs mt-1 bg-primary/10 text-primary">{employee.territory}</Badge>}
            </>
          )}
        </div>
      </div>

      {/* This Month Goal */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Monthly Goal Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Revenue Sold</span>
            <span className="font-bold">${totalRevenue.toLocaleString()} / ${monthlyGoal.toLocaleString()}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all ${goalPct >= 100 ? "bg-green-500" : goalPct >= 70 ? "bg-primary" : "bg-orange-400"}`}
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{goalPct}% of monthly goal — {goalPct >= 100 ? "🎉 Goal reached!" : `$${(monthlyGoal - totalRevenue).toLocaleString()} remaining`}</p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Active Leads</p>
          <p className="text-2xl font-bold text-foreground mt-0.5">{activeLeads.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Jobs Won</p>
          <p className="text-2xl font-bold text-green-600 mt-0.5">{wonLeads.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Close Rate</p>
          <p className="text-2xl font-bold text-primary mt-0.5">{closeRate}%</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Quotes Sent</p>
          <p className="text-2xl font-bold mt-0.5">{sentQuotes.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Revenue Sold</p>
          <p className="text-xl font-bold text-green-700 mt-0.5">${totalRevenue.toLocaleString()}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Pending Revenue</p>
          <p className="text-xl font-bold text-blue-600 mt-0.5">${pendingRevenue.toLocaleString()}</p>
        </Card>
      </div>

      {/* Commission */}
      {commissionRate > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-xs text-green-600 font-medium">Estimated Commission ({commissionRate}%)</p>
            <p className="text-2xl font-bold text-green-700 mt-1">${estimatedCommission.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-0.5">Based on $${totalRevenue.toLocaleString()} revenue sold</p>
          </CardContent>
        </Card>
      )}

      {/* Pending follow-ups */}
      {overdueFollowUps.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">{overdueFollowUps.length} overdue follow-up{overdueFollowUps.length > 1 ? "s" : ""}</p>
        </div>
      )}

      {/* Won this month */}
      {wonThisMonth.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" /> Won This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {wonThisMonth.map(l => (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{l.first_name} {l.last_name}</span>
                {l.estimated_value && <span className="text-green-700 font-bold">${l.estimated_value.toLocaleString()}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}