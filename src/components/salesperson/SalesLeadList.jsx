import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, Phone, ChevronRight, Zap, Flame, AlertTriangle } from "lucide-react";
import { isToday, isPast, parseISO } from "date-fns";

const STATUS_COLORS = {
  new: "bg-blue-100 text-blue-700", contacted: "bg-yellow-100 text-yellow-700",
  attempting_contact: "bg-amber-100 text-amber-700", left_voicemail: "bg-orange-100 text-orange-600",
  qualified: "bg-purple-100 text-purple-700", quoted: "bg-indigo-100 text-indigo-700",
  negotiating: "bg-teal-100 text-teal-700", won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

export default function SalesLeadList({ leads = [], loading, onSelectLead, onUpdateLead }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchQ = !q || `${l.first_name} ${l.last_name} ${l.address} ${l.description}`.toLowerCase().includes(q);
    if (filter === "active") return matchQ && !["won","lost","disqualified"].includes(l.status);
    if (filter === "hot") return matchQ && (l.ai_score >= 75 || l.urgency === "emergency" || l.urgency === "high");
    if (filter === "today") {
      const todayStr = new Date().toISOString().split("T")[0];
      return matchQ && l.follow_up_date === todayStr;
    }
    if (filter === "overdue") return matchQ && l.follow_up_date && isPast(parseISO(l.follow_up_date)) && !isToday(parseISO(l.follow_up_date));
    if (filter === "quoted") return matchQ && l.status === "quoted";
    if (filter === "won") return matchQ && l.status === "won";
    return matchQ;
  });

  if (loading) return (
    <div className="p-4 space-y-3">
      {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-3 border-b bg-background sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {["active","hot","today","overdue","quoted","won"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">No leads found</Card>
        ) : (
          filtered.map(lead => (
            <Card
              key={lead.id}
              className={`p-4 cursor-pointer active:scale-[0.98] transition-all ${
                lead.urgency === "emergency" ? "border-red-200 bg-red-50/30" :
                lead.urgency === "high" ? "border-orange-200" : ""
              }`}
              onClick={() => onSelectLead(lead.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(lead.urgency === "emergency" || lead.urgency === "high") && (
                      <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    <span className="font-semibold">{lead.first_name} {lead.last_name}</span>
                    <Badge className={`text-xs ${STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-600"}`}>
                      {lead.status?.replace(/_/g, " ")}
                    </Badge>
                    {(lead.urgency === "emergency" || lead.urgency === "high") && (
                      <Badge className="text-xs bg-red-100 text-red-700">{lead.urgency}</Badge>
                    )}
                  </div>
                  {lead.address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{lead.address}</span>
                    </p>
                  )}
                  {lead.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {lead.phone}
                    </p>
                  )}
                  {lead.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{lead.description}</p>
                  )}
                  <div className="flex gap-3 text-xs">
                    {lead.ai_score != null && (
                      <span className="flex items-center gap-1 text-primary font-medium">
                        <Zap className="w-3 h-3" /> {lead.ai_score}
                      </span>
                    )}
                    {lead.estimated_value && (
                      <span className="text-green-700 font-semibold">${lead.estimated_value.toLocaleString()}</span>
                    )}
                    {lead.follow_up_date && (
                      <span className={`flex items-center gap-1 ${isPast(parseISO(lead.follow_up_date)) && !isToday(parseISO(lead.follow_up_date)) ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                        {isToday(parseISO(lead.follow_up_date)) ? "Today" : lead.follow_up_date}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}