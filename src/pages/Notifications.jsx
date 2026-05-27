import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bell, CheckCheck, Users, FileText, Briefcase, Receipt,
  Wrench, ScanSearch, AlertCircle, Info, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const TYPE_CONFIG = {
  new_lead: { icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
  quote_approved: { icon: FileText, color: "text-green-600", bg: "bg-green-100" },
  job_assigned: { icon: Briefcase, color: "text-purple-600", bg: "bg-purple-100" },
  job_completed: { icon: CheckCheck, color: "text-green-600", bg: "bg-green-100" },
  invoice_overdue: { icon: Receipt, color: "text-red-600", bg: "bg-red-100" },
  equipment_service_due: { icon: Wrench, color: "text-orange-600", bg: "bg-orange-100" },
  ai_review_needed: { icon: ScanSearch, color: "text-indigo-600", bg: "bg-indigo-100" },
  change_order: { icon: AlertCircle, color: "text-yellow-600", bg: "bg-yellow-100" },
  general: { icon: Info, color: "text-muted-foreground", bg: "bg-muted" },
};

export default function Notifications() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => base44.entities.Notification.list("-created_date"),
  });

  const markRead = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { read: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { read: true })));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications_unread"] });
      toast.success("All notifications marked as read");
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-muted-foreground text-sm mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="gap-1.5"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark All Read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-muted-foreground">No notifications yet</p>
          <p className="text-sm text-muted-foreground mt-1">You'll see alerts here for new leads, approvals, and more</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => {
            const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.general;
            const Icon = config.icon;
            return (
              <Card
                key={notif.id}
                className={`transition-all cursor-pointer hover:shadow-md ${!notif.read ? "border-primary/30 bg-primary/5" : ""}`}
                onClick={() => { if (!notif.read) markRead.mutate(notif.id); }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${config.bg} shrink-0`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium ${!notif.read ? "text-foreground" : "text-muted-foreground"}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                        )}
                      </div>
                      {notif.message && (
                        <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                      )}
                      {notif.created_date && (
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(notif.created_date), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}