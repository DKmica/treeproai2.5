import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Briefcase, Users } from "lucide-react";

export default function RecentActivity() {
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads-recent"],
    queryFn: () => base44.entities.Lead.list("-created_date", 3),
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["jobs-recent"],
    queryFn: () => base44.entities.Job.list("-created_date", 3),
  });

  const isLoading = leadsLoading || jobsLoading;

  const activities = [
    ...leads.map((l) => ({
      type: "lead",
      icon: Users,
      title: `New lead: ${l.first_name} ${l.last_name}`,
      subtitle: l.source || "Direct",
      date: l.created_date,
      color: "text-blue-600 bg-blue-50",
    })),
    ...jobs.map((j) => ({
      type: "job",
      icon: Briefcase,
      title: `Job: ${j.description?.slice(0, 40) || "Service"}`,
      subtitle: j.status,
      date: j.created_date,
      color: "text-primary bg-primary/10",
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activities.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${a.color}`}>
                  <a.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{a.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}