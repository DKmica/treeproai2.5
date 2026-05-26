import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from "date-fns";

const STATUS_COLORS = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-amber-100 text-amber-800 border-amber-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function JobsCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => base44.entities.Job.list(),
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad to start on Sunday
  const startPad = monthStart.getDay();
  const paddedDays = [...Array(startPad).fill(null), ...days];

  const jobsForDay = (date) =>
    jobs.filter((j) => j.scheduled_date && isSameDay(parseISO(j.scheduled_date), date));

  const selectedDayJobs = selectedDay ? jobsForDay(selectedDay) : [];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="w-4 h-4 text-primary" />
            Job Schedule
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium w-28 text-center">{format(currentMonth, "MMMM yyyy")}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {paddedDays.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} className="h-14 border-b border-r border-border/50 bg-muted/20" />;

            const dayJobs = jobsForDay(day);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`h-14 border-b border-r border-border/50 p-1 cursor-pointer transition-colors
                  ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "hover:bg-muted/40"}
                  ${!isCurrentMonth ? "opacity-40" : ""}
                `}
              >
                <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-0.5
                  ${isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"}
                `}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {dayJobs.slice(0, 2).map((job) => (
                    <div
                      key={job.id}
                      className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate border ${STATUS_COLORS[job.status] || STATUS_COLORS.scheduled}`}
                    >
                      {job.customer_name || job.description}
                    </div>
                  ))}
                  {dayJobs.length > 2 && (
                    <div className="text-[10px] text-muted-foreground px-1">+{dayJobs.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected day detail */}
        {selectedDay && (
          <div className="border-t border-border p-4 bg-muted/20">
            <p className="text-sm font-semibold mb-3">{format(selectedDay, "EEEE, MMMM d, yyyy")}</p>
            {selectedDayJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs scheduled.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayJobs.map((job) => (
                  <div key={job.id} className="bg-card rounded-lg border border-border p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{job.description}</p>
                      <Badge className={`text-xs shrink-0 ${STATUS_COLORS[job.status]}`}>
                        {job.status?.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {job.customer_name && (
                        <span className="font-medium text-foreground">{job.customer_name}</span>
                      )}
                      {job.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {job.address}
                        </span>
                      )}
                      {job.crew_name && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {job.crew_name}
                        </span>
                      )}
                    </div>
                    {job.total_cost && (
                      <p className="text-xs font-semibold text-primary">${job.total_cost.toLocaleString()}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}