import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isToday, isPast, parseISO, format } from "date-fns";
import { Phone, MapPin, Zap, AlertTriangle, ChevronRight, Navigation, MessageSquare, Clock, Flame } from "lucide-react";
import { toast } from "sonner";

const urgencyColors = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700",
};

const statusLabels = {
  new: { label: "New", cls: "bg-blue-100 text-blue-700" },
  contacted: { label: "Contacted", cls: "bg-yellow-100 text-yellow-700" },
  attempting_contact: { label: "Attempting", cls: "bg-amber-100 text-amber-700" },
  left_voicemail: { label: "Voicemail", cls: "bg-orange-100 text-orange-600" },
  qualified: { label: "Qualified", cls: "bg-purple-100 text-purple-700" },
  quoted: { label: "Quoted", cls: "bg-indigo-100 text-indigo-700" },
  negotiating: { label: "Negotiating", cls: "bg-teal-100 text-teal-700" },
  won: { label: "WON ✓", cls: "bg-green-100 text-green-700" },
  lost: { label: "Lost", cls: "bg-red-100 text-red-700" },
};

export default function SalesToday({ leads = [], onSelectLead, onUpdateLead, user }) {
  const today = new Date().toISOString().split("T")[0];

  const todayLeads = leads.filter(l =>
    l.follow_up_date === today ||
    l.urgency === "emergency" ||
    (l.status === "new" && !l.follow_up_date)
  );

  const hotLeads = leads.filter(l =>
    (l.ai_score >= 80 || l.urgency === "emergency" || l.urgency === "high") &&
    !["won","lost","disqualified"].includes(l.status)
  ).slice(0, 5);

  const overdueLeads = leads.filter(l =>
    l.follow_up_date && isPast(parseISO(l.follow_up_date)) && !isToday(parseISO(l.follow_up_date)) &&
    !["won","lost","disqualified"].includes(l.status)
  );

  const handleNavigate = (lead) => {
    if (!lead.address) { toast.error("No address on file"); return; }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.address)}`, "_blank");
  };

  const handleCall = (lead) => {
    if (!lead.phone) { toast.error("No phone number on file"); return; }
    window.location.href = `tel:${lead.phone}`;
  };

  const handleText = (lead) => {
    if (!lead.phone) { toast.error("No phone number on file"); return; }
    const msg = `Hi ${lead.first_name}, this is ${user?.full_name || "your tree service representative"}. I'm reaching out about your tree service request. When would be a good time to talk?`;
    window.location.href = `sms:${lead.phone}?body=${encodeURIComponent(msg)}`;
  };

  const handleOnMyWay = (lead) => {
    const msg = `Hi ${lead.first_name}, I'm on my way to your property now. I'll be there in about 15-20 minutes. See you soon!`;
    if (lead.phone) window.location.href = `sms:${lead.phone}?body=${encodeURIComponent(msg)}`;
    onUpdateLead(lead.id, { status: "contacted", last_contact_date: today });
    toast.success("On My Way text template opened");
  };

  const LeadCard = ({ lead, showActions = true }) => (
    <Card
      className={`p-4 transition-all active:scale-[0.98] ${
        lead.urgency === "emergency" ? "border-red-300 bg-red-50/40" :
        lead.urgency === "high" ? "border-orange-200 bg-orange-50/20" : ""
      }`}
      onClick={() => onSelectLead(lead.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(lead.urgency === "emergency" || lead.urgency === "high") && (
              <Flame className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span className="font-semibold text-base">{lead.first_name} {lead.last_name}</span>
            <Badge className={`text-xs ${urgencyColors[lead.urgency]}`}>{lead.urgency}</Badge>
            <Badge className={`text-xs ${statusLabels[lead.status]?.cls || "bg-gray-100 text-gray-600"}`}>
              {statusLabels[lead.status]?.label || lead.status}
            </Badge>
          </div>
          {lead.address && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{lead.address}</span>
            </p>
          )}
          {lead.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{lead.description}</p>
          )}
          <div className="flex gap-3 text-xs text-muted-foreground">
            {lead.ai_score != null && (
              <span className="flex items-center gap-1 text-primary font-medium">
                <Zap className="w-3 h-3" /> Score: {lead.ai_score}
              </span>
            )}
            {lead.estimated_value && (
              <span className="font-medium text-green-700">${lead.estimated_value.toLocaleString()}</span>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
      </div>

      {showActions && (
        <div className="flex gap-2 mt-3 pt-3 border-t" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="outline" className="flex-1 h-9 gap-1.5 text-xs" onClick={() => handleCall(lead)}>
            <Phone className="w-3.5 h-3.5" /> Call
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-9 gap-1.5 text-xs" onClick={() => handleText(lead)}>
            <MessageSquare className="w-3.5 h-3.5" /> Text
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-9 gap-1.5 text-xs" onClick={() => handleNavigate(lead)}>
            <Navigation className="w-3.5 h-3.5" /> Drive
          </Button>
          <Button size="sm" className="flex-1 h-9 gap-1.5 text-xs" onClick={() => handleOnMyWay(lead)}>
            On My Way
          </Button>
        </div>
      )}
    </Card>
  );

  return (
    <div className="p-4 space-y-5 pb-6">
      <div>
        <h2 className="text-xl font-bold">Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, {user?.full_name?.split(" ")[0] || "there"} 👋</h2>
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-primary/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-primary">{todayLeads.length}</p>
          <p className="text-xs text-muted-foreground">Today</p>
        </div>
        <div className={`${overdueLeads.length > 0 ? "bg-red-100" : "bg-muted/50"} rounded-xl p-3 text-center`}>
          <p className={`text-2xl font-bold ${overdueLeads.length > 0 ? "text-red-600" : ""}`}>{overdueLeads.length}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </div>
        <div className="bg-orange-100 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{hotLeads.length}</p>
          <p className="text-xs text-muted-foreground">Hot Leads</p>
        </div>
      </div>

      {/* Overdue */}
      {overdueLeads.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-red-600 flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-4 h-4" /> Overdue Follow-Ups
          </h3>
          <div className="space-y-2">
            {overdueLeads.slice(0, 3).map(l => <LeadCard key={l.id} lead={l} />)}
          </div>
        </section>
      )}

      {/* Today */}
      <section>
        <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2">
          <Clock className="w-4 h-4 text-primary" /> Today's Schedule
        </h3>
        {todayLeads.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-sm">
            No appointments scheduled for today
          </Card>
        ) : (
          <div className="space-y-2">
            {todayLeads.map(l => <LeadCard key={l.id} lead={l} />)}
          </div>
        )}
      </section>

      {/* Hot leads */}
      {hotLeads.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-orange-600 flex items-center gap-1.5 mb-2">
            <Flame className="w-4 h-4" /> Hot Leads
          </h3>
          <div className="space-y-2">
            {hotLeads.map(l => <LeadCard key={l.id} lead={l} showActions={false} />)}
          </div>
        </section>
      )}
    </div>
  );
}