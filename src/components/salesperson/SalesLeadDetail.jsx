import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, MessageSquare, Mail, MapPin, Navigation, Camera,
  Clipboard, FileText, Sparkles, ChevronRight, Clock, Flame,
  CheckCircle2, AlertTriangle, User, Edit3
} from "lucide-react";
import { format, parseISO } from "date-fns";
import SalesAssessmentWorkflow from "./SalesAssessmentWorkflow";
import SalesQuoteBuilder from "./SalesQuoteBuilder";
import SalesCloseAssist from "./SalesCloseAssist";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "attempting_contact", label: "Attempting Contact" },
  { value: "left_voicemail", label: "Left Voicemail" },
  { value: "qualified", label: "Qualified" },
  { value: "quoted", label: "Quoted" },
  { value: "negotiating", label: "Negotiating" },
  { value: "won", label: "Won ✓" },
  { value: "lost", label: "Lost" },
];

const FOLLOW_UP_OPTIONS = [
  { value: "sold", label: "Sold ✓" },
  { value: "follow_up", label: "Follow Up" },
  { value: "waiting_spouse", label: "Waiting on Spouse" },
  { value: "waiting_insurance", label: "Waiting on Insurance" },
  { value: "too_expensive", label: "Too Expensive" },
  { value: "got_cheaper_quote", label: "Got Cheaper Quote" },
  { value: "not_ready", label: "Not Ready" },
  { value: "lost", label: "Lost" },
];

export default function SalesLeadDetail({ lead, quotes = [], onBack, onUpdate, onQuoteCreated, user }) {
  const [screen, setScreen] = useState("detail"); // detail | assessment | quote | close
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showFollowUpMenu, setShowFollowUpMenu] = useState(false);
  const queryClient = useQueryClient();

  const { data: aiRecord } = useQuery({
    queryKey: ["ai_record_lead", lead?.id],
    queryFn: () => base44.entities.AIAnalysisRecord.filter({ lead_id: lead.id }),
    enabled: !!lead?.id,
    select: arr => arr[0],
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ["activity_lead", lead?.id],
    queryFn: () => base44.entities.ActivityLog.filter({ related_id: lead.id }),
    enabled: !!lead?.id,
  });

  if (!lead) return (
    <div className="p-4 text-center text-muted-foreground">Lead not found</div>
  );

  const handleCall = () => {
    if (!lead.phone) { toast.error("No phone number"); return; }
    window.location.href = `tel:${lead.phone}`;
    onUpdate({ contact_attempts: (lead.contact_attempts || 0) + 1, last_contact_date: new Date().toISOString().split("T")[0] });
  };

  const handleText = (template = "default") => {
    if (!lead.phone) { toast.error("No phone number"); return; }
    const templates = {
      default: `Hi ${lead.first_name}, this is ${user?.full_name || "your arborist"}. Reaching out about your tree service request. When works for you?`,
      omw: `Hi ${lead.first_name}, I'm on my way — be there in ~15 mins!`,
      quote_sent: `Hi ${lead.first_name}, your quote is ready! I'll send it to ${lead.email || "your email"} now. Any questions, just reply here.`,
      followup: `Hi ${lead.first_name}, just checking in on the tree service quote I sent. Did you have any questions?`,
      deposit: `Hi ${lead.first_name}, great talking with you! Here's the deposit link to get your job scheduled: [link]`,
    };
    window.location.href = `sms:${lead.phone}?body=${encodeURIComponent(templates[template] || templates.default)}`;
  };

  const handleNavigate = () => {
    if (!lead.address) { toast.error("No address on file"); return; }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.address)}`, "_blank");
  };

  const handleStatusChange = (status) => {
    onUpdate({ status, last_contact_date: new Date().toISOString().split("T")[0] });
    setShowStatusMenu(false);
    base44.entities.ActivityLog.create({
      related_type: "Lead", related_id: lead.id,
      actor: user?.full_name || "salesperson",
      action: `Status changed to: ${status}`,
    }).catch(() => {});
    toast.success(`Status → ${status}`);
  };

  const handleFollowUpOutcome = (outcome) => {
    const data = { follow_up_notes: outcome };
    if (outcome === "sold") data.status = "won";
    if (outcome === "lost") data.status = "lost";
    onUpdate(data);
    setShowFollowUpMenu(false);
    base44.entities.ActivityLog.create({
      related_type: "Lead", related_id: lead.id,
      actor: user?.full_name || "salesperson",
      action: `Follow-up outcome: ${outcome}`,
    }).catch(() => {});
    toast.success("Updated");
  };

  if (screen === "assessment") {
    return (
      <SalesAssessmentWorkflow
        lead={lead}
        onBack={() => setScreen("detail")}
        onComplete={() => { setScreen("quote"); queryClient.invalidateQueries(); }}
        user={user}
      />
    );
  }

  if (screen === "quote") {
    return (
      <SalesQuoteBuilder
        lead={lead}
        aiRecord={aiRecord}
        onBack={() => setScreen("detail")}
        onQuoteCreated={() => { onQuoteCreated?.(); setScreen("detail"); }}
        user={user}
      />
    );
  }

  if (screen === "close") {
    return (
      <SalesCloseAssist
        lead={lead}
        quotes={quotes}
        onBack={() => setScreen("detail")}
        user={user}
      />
    );
  }

  const urgencyColors = {
    low: "bg-gray-100 text-gray-600", normal: "bg-blue-100 text-blue-700",
    high: "bg-orange-100 text-orange-700", emergency: "bg-red-100 text-red-700",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-background sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-lg truncate">{lead.first_name} {lead.last_name}</h2>
          <div className="flex gap-1.5 flex-wrap">
            <Badge className={`text-xs ${urgencyColors[lead.urgency]}`}>{lead.urgency}</Badge>
            <Badge
              className={`text-xs cursor-pointer ${lead.status === "won" ? "bg-green-100 text-green-700" : lead.status === "lost" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}
              onClick={() => setShowStatusMenu(!showStatusMenu)}
            >
              {lead.status?.replace(/_/g, " ")} ▾
            </Badge>
          </div>
        </div>
      </div>

      {/* Status dropdown */}
      {showStatusMenu && (
        <div className="absolute top-16 left-4 right-4 z-50 bg-white border rounded-xl shadow-xl overflow-hidden">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className="w-full text-left px-4 py-3 text-sm hover:bg-muted active:bg-muted/80 border-b last:border-0"
              onClick={() => handleStatusChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
          <button className="w-full text-left px-4 py-3 text-sm text-muted-foreground" onClick={() => setShowStatusMenu(false)}>Cancel</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          <button onClick={handleCall} className="flex flex-col items-center gap-1 p-3 bg-green-50 rounded-xl active:bg-green-100 transition-colors">
            <Phone className="w-5 h-5 text-green-600" />
            <span className="text-xs font-medium text-green-700">Call</span>
          </button>
          <button onClick={() => handleText()} className="flex flex-col items-center gap-1 p-3 bg-blue-50 rounded-xl active:bg-blue-100">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Text</span>
          </button>
          <button onClick={handleNavigate} className="flex flex-col items-center gap-1 p-3 bg-purple-50 rounded-xl active:bg-purple-100">
            <Navigation className="w-5 h-5 text-purple-600" />
            <span className="text-xs font-medium text-purple-700">Drive</span>
          </button>
          <button onClick={() => lead.email && (window.location.href = `mailto:${lead.email}`)} className="flex flex-col items-center gap-1 p-3 bg-orange-50 rounded-xl active:bg-orange-100">
            <Mail className="w-5 h-5 text-orange-600" />
            <span className="text-xs font-medium text-orange-700">Email</span>
          </button>
        </div>

        {/* Main Action Buttons */}
        <div className="space-y-2">
          <Button className="w-full h-12 text-base gap-2" onClick={() => setScreen("assessment")}>
            <Camera className="w-5 h-5" /> Start On-Site Assessment
          </Button>
          <Button variant="outline" className="w-full h-12 text-base gap-2" onClick={() => setScreen("quote")}>
            <FileText className="w-5 h-5" /> Build Quote
          </Button>
          <Button variant="outline" className="w-full h-12 text-base gap-2 text-purple-700 border-purple-200 bg-purple-50" onClick={() => setScreen("close")}>
            <Sparkles className="w-5 h-5 text-purple-500" /> Help Me Close This
          </Button>
        </div>

        {/* Contact Info */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4" /> Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2 text-sm">
            {lead.phone && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {lead.phone}</span>
                <button onClick={handleCall} className="text-primary text-xs font-medium">Call</button>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5 truncate"><Mail className="w-3.5 h-3.5 shrink-0" /> {lead.email}</span>
                <button onClick={() => window.location.href = `mailto:${lead.email}`} className="text-primary text-xs font-medium shrink-0">Email</button>
              </div>
            )}
            {lead.address && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5 truncate"><MapPin className="w-3.5 h-3.5 shrink-0" /> {lead.address}</span>
                <button onClick={handleNavigate} className="text-primary text-xs font-medium shrink-0">Navigate</button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead Details */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><Clipboard className="w-4 h-4" /> Job Details</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2 text-sm">
            {lead.description && <p>{lead.description}</p>}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {lead.urgency && <div><span className="text-muted-foreground">Urgency:</span> <span className="font-medium capitalize">{lead.urgency}</span></div>}
              {lead.ai_score != null && <div><span className="text-muted-foreground">AI Score:</span> <span className="font-medium text-primary">{lead.ai_score}/100</span></div>}
              {lead.estimated_value && <div><span className="text-muted-foreground">Est. Value:</span> <span className="font-medium text-green-700">${lead.estimated_value.toLocaleString()}</span></div>}
              {lead.source && <div><span className="text-muted-foreground">Source:</span> <span className="font-medium capitalize">{lead.source.replace(/_/g," ")}</span></div>}
            </div>
            {lead.follow_up_notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs">
                <span className="font-medium text-yellow-800">Notes: </span>
                <span className="text-yellow-700">{lead.follow_up_notes}</span>
              </div>
            )}
            {lead.ai_notes && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 text-xs">
                <span className="font-medium text-primary">AI: </span>
                <span className="text-muted-foreground">{lead.ai_notes}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Assessment Summary */}
        {aiRecord && (
          <Card className="border-primary/20">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2 text-primary"><Sparkles className="w-4 h-4" /> AI Assessment</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {aiRecord.detected_species && <div><span className="text-muted-foreground">Species:</span> <span className="font-medium">{aiRecord.detected_species}</span></div>}
                {aiRecord.estimated_height_ft_high && <div><span className="text-muted-foreground">Height:</span> <span className="font-medium">{aiRecord.estimated_height_ft_low}–{aiRecord.estimated_height_ft_high} ft</span></div>}
                {aiRecord.risk_level && <div><span className="text-muted-foreground">Risk:</span> <span className="font-medium capitalize">{aiRecord.risk_level}</span></div>}
                {aiRecord.confidence_score && <div><span className="text-muted-foreground">Confidence:</span> <span className="font-medium">{aiRecord.confidence_score}%</span></div>}
              </div>
              {(aiRecord.price_low || aiRecord.price_high) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs">
                  <span className="text-green-800 font-medium">AI Range: </span>
                  <span className="text-green-700 font-bold">${aiRecord.price_low?.toLocaleString()} – ${aiRecord.price_high?.toLocaleString()}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {aiRecord.crane_required && <Badge className="text-xs bg-red-100 text-red-700">Crane Required</Badge>}
                {aiRecord.structures_nearby && <Badge className="text-xs bg-yellow-100 text-yellow-700">Structures Nearby</Badge>}
                {aiRecord.stump_grinding_likely && <Badge className="text-xs bg-blue-100 text-blue-700">Stump Likely</Badge>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quotes */}
        {quotes.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Quotes</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {quotes.map(q => (
                <div key={q.id} className="flex items-center justify-between text-sm border rounded-lg p-2.5">
                  <div>
                    <p className="font-medium">#{q.quote_number}</p>
                    <p className="text-xs text-muted-foreground capitalize">{q.status?.replace(/_/g," ")}</p>
                  </div>
                  <p className="font-bold text-green-700">${(q.total_amount || 0).toLocaleString()}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Follow-up outcome */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Follow-Up Outcome</p>
          <div className="grid grid-cols-2 gap-2">
            {FOLLOW_UP_OPTIONS.slice(0, 4).map(opt => (
              <Button
                key={opt.value}
                variant="outline"
                size="sm"
                className={`text-xs h-9 ${opt.value === "sold" ? "border-green-300 text-green-700 bg-green-50" : opt.value === "lost" ? "border-red-300 text-red-700 bg-red-50" : ""}`}
                onClick={() => handleFollowUpOutcome(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FOLLOW_UP_OPTIONS.slice(4).map(opt => (
              <Button
                key={opt.value}
                variant="outline"
                size="sm"
                className={`text-xs h-9 ${opt.value === "sold" ? "border-green-300 text-green-700 bg-green-50" : opt.value === "lost" ? "border-red-300 text-red-700 bg-red-50" : ""}`}
                onClick={() => handleFollowUpOutcome(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Text Templates */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Quick Texts</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {[
              { key: "omw", label: "On My Way" },
              { key: "quote_sent", label: "Quote Sent" },
              { key: "followup", label: "Follow Up" },
              { key: "deposit", label: "Deposit Request" },
            ].map(t => (
              <Button key={t.key} variant="outline" size="sm" className="w-full h-9 text-xs justify-start gap-2" onClick={() => handleText(t.key)}>
                <MessageSquare className="w-3.5 h-3.5" /> {t.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        {activityLogs.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {activityLogs.slice(0, 8).map(log => (
                  <div key={log.id} className="flex gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p className="font-medium">{log.action}</p>
                      {log.notes && <p className="text-muted-foreground">{log.notes}</p>}
                      <p className="text-muted-foreground">{log.created_date ? format(new Date(log.created_date), "MMM d, h:mm a") : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}