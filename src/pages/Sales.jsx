import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus, Search, MoreVertical, Phone, Mail, MapPin, Sparkles,
  CalendarDays, UserCheck, TrendingUp, AlertTriangle, Clock
} from "lucide-react";
import SalespersonForm from "@/components/sales/SalespersonForm";
import LeadAssignModal from "@/components/sales/LeadAssignModal";
import { format, isToday, isTomorrow, isPast, parseISO, isThisWeek } from "date-fns";

const statusColors = {
  new: "bg-blue-100 text-blue-700 border-blue-200",
  contacted: "bg-yellow-100 text-yellow-700 border-yellow-200",
  attempting_contact: "bg-amber-100 text-amber-700 border-amber-200",
  left_voicemail: "bg-orange-100 text-orange-600 border-orange-200",
  qualified: "bg-purple-100 text-purple-700 border-purple-200",
  quoted: "bg-orange-100 text-orange-700 border-orange-200",
  negotiating: "bg-indigo-100 text-indigo-700 border-indigo-200",
  won: "bg-green-100 text-green-700 border-green-200",
  lost: "bg-red-100 text-red-700 border-red-200",
  disqualified: "bg-gray-100 text-gray-500 border-gray-200",
};

const urgencyColors = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-50 text-blue-600",
  high: "bg-orange-50 text-orange-600",
  emergency: "bg-red-50 text-red-600",
};

function followUpLabel(dateStr) {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (isPast(d) && !isToday(d)) return { label: "Overdue", cls: "text-red-600 font-semibold" };
  if (isToday(d)) return { label: "Today", cls: "text-orange-600 font-semibold" };
  if (isTomorrow(d)) return { label: "Tomorrow", cls: "text-yellow-600" };
  if (isThisWeek(d)) return { label: format(d, "EEEE"), cls: "text-foreground" };
  return { label: format(d, "MMM d"), cls: "text-muted-foreground" };
}

export default function Sales() {
  const [search, setSearch] = useState("");
  const [filterSalesperson, setFilterSalesperson] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showSalespersonForm, setShowSalespersonForm] = useState(false);
  const [editingSalesperson, setEditingSalesperson] = useState(null);
  const [assigningLead, setAssigningLead] = useState(null);
  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date"),
  });
  const { data: allEmployees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list(),
  });
  const salespersons = allEmployees.filter((e) => e.position === "salesperson");

  const updateLead = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead updated"); },
  });

  const createSalesperson = useMutation({
    mutationFn: (data) => base44.entities.Employee.create({ ...data, position: "salesperson" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); setShowSalespersonForm(false); toast.success("Salesperson added"); },
  });

  const updateSalesperson = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); setEditingSalesperson(null); toast.success("Salesperson updated"); },
  });

  const deleteSalesperson = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); toast.success("Salesperson removed"); },
  });

  const activeLeads = leads.filter((l) => l.status !== "won" && l.status !== "lost");

  const filteredLeads = activeLeads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${l.first_name} ${l.last_name} ${l.email} ${l.address} ${l.assigned_to}`.toLowerCase().includes(q);
    const matchSp = filterSalesperson === "all" || l.assigned_to_id === filterSalesperson || (filterSalesperson === "unassigned" && !l.assigned_to_id);
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    return matchSearch && matchSp && matchStatus;
  });

  // Schedule: leads with follow_up_date, sorted
  const scheduleLeads = [...activeLeads]
    .filter((l) => l.follow_up_date)
    .sort((a, b) => a.follow_up_date.localeCompare(b.follow_up_date));

  // Stats
  const unassigned = activeLeads.filter((l) => !l.assigned_to_id).length;
  const overdue = activeLeads.filter((l) => l.follow_up_date && isPast(parseISO(l.follow_up_date)) && !isToday(parseISO(l.follow_up_date))).length;
  const todayFollowUps = activeLeads.filter((l) => l.follow_up_date && isToday(parseISO(l.follow_up_date))).length;

  const handleAutoAssign = async (lead) => {
    if (salespersons.length === 0) { toast.error("Add salespersons first."); return; }
    toast.info("AI is analyzing and assigning...");
    const salesList = salespersons.filter((s) => s.status === "active").map((s) =>
      `${s.first_name} ${s.last_name} (id: ${s.id}, territory: ${s.territory || "any"}, specialties: ${(s.specialties || []).join(", ") || "general"}, max_leads: ${s.max_leads || 10})`
    ).join("\n");
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Assign this tree service lead to the best salesperson.
Lead: ${lead.first_name} ${lead.last_name}, ${lead.description || ""}, urgency: ${lead.urgency}, address: ${lead.address || ""}
Salespersons:\n${salesList}
Pick the best fit and suggest a follow-up date within 1-3 business days.`,
      response_json_schema: {
        type: "object",
        properties: {
          assigned_salesperson_id: { type: "string" },
          assigned_salesperson_name: { type: "string" },
          follow_up_date: { type: "string" },
          notes: { type: "string" },
        },
      },
    });
    updateLead.mutate({
      id: lead.id,
      data: {
        assigned_to: result.assigned_salesperson_name || salespersons.find(s => s.id === result.assigned_salesperson_id)?.first_name + " " + salespersons.find(s => s.id === result.assigned_salesperson_id)?.last_name,
        assigned_to_id: result.assigned_salesperson_id,
        follow_up_date: result.follow_up_date,
        follow_up_notes: result.notes,
        status: lead.status === "new" ? "contacted" : lead.status,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground mt-1">Lead assignments, schedules & salesperson tracking</p>
        </div>
        <Button onClick={() => setShowSalespersonForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Salesperson
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Active Leads</p>
          <p className="text-2xl font-bold mt-1">{activeLeads.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Unassigned</p>
          <p className={`text-2xl font-bold mt-1 ${unassigned > 0 ? "text-orange-600" : ""}`}>{unassigned}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Today's Follow-ups</p>
          <p className={`text-2xl font-bold mt-1 ${todayFollowUps > 0 ? "text-primary" : ""}`}>{todayFollowUps}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-500" /> Overdue</p>
          <p className={`text-2xl font-bold mt-1 ${overdue > 0 ? "text-red-600" : ""}`}>{overdue}</p>
        </Card>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" />Schedule</TabsTrigger>
          <TabsTrigger value="leads" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />All Leads</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><UserCheck className="w-3.5 h-3.5" />Team</TabsTrigger>
        </TabsList>

        {/* SCHEDULE TAB */}
        <TabsContent value="schedule" className="mt-4 space-y-3">
          {scheduleLeads.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">No follow-ups scheduled yet. Assign leads and set follow-up dates.</Card>
          ) : (
            <div className="space-y-2">
              {scheduleLeads.map((lead) => {
                const fu = followUpLabel(lead.follow_up_date);
                return (
                  <Card key={lead.id} className={`p-4 transition-shadow hover:shadow-md ${fu?.cls?.includes("red") ? "border-red-200 bg-red-50/30" : fu?.cls?.includes("orange") ? "border-orange-200 bg-orange-50/20" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-16 text-center shrink-0">
                        <p className={`text-xs font-semibold ${fu?.cls}`}>{fu?.label}</p>
                        {lead.follow_up_date && <p className="text-[10px] text-muted-foreground">{format(parseISO(lead.follow_up_date), "MMM d")}</p>}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm">{lead.first_name} {lead.last_name}</span>
                          <Badge className={`text-xs ${statusColors[lead.status]}`}>{lead.status}</Badge>
                          <Badge variant="outline" className={`text-xs ${urgencyColors[lead.urgency]}`}>{lead.urgency}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {lead.assigned_to && <span className="font-medium text-foreground flex items-center gap-1"><UserCheck className="w-3 h-3" />{lead.assigned_to}</span>}
                          {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                          {lead.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.address}</span>}
                        </div>
                        {lead.follow_up_notes && <p className="text-xs text-muted-foreground italic">{lead.follow_up_notes}</p>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="shrink-0"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAssigningLead(lead)}>Re-assign / Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateLead.mutate({ id: lead.id, data: { status: "contacted", contact_attempts: (lead.contact_attempts || 0) + 1, last_contact_date: new Date().toISOString().split("T")[0] } })}>Mark Contacted</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateLead.mutate({ id: lead.id, data: { status: "qualified" } })}>Mark Qualified</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateLead.mutate({ id: lead.id, data: { status: "won" } })}>Mark Won</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateLead.mutate({ id: lead.id, data: { status: "lost" } })}>Mark Lost</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ALL LEADS TAB */}
        <TabsContent value="leads" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterSalesperson} onValueChange={setFilterSalesperson}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Salesperson" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Salespeople</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {salespersons.map((s) => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {["new", "contacted", "attempting_contact", "left_voicemail", "qualified", "quoted", "negotiating"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g," ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filteredLeads.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">No leads found.</Card>
          ) : (
            <div className="space-y-2">
              {filteredLeads.map((lead) => (
                <Card key={lead.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{lead.first_name} {lead.last_name}</span>
                        <Badge className={`text-xs ${statusColors[lead.status]}`}>{lead.status}</Badge>
                        <Badge variant="outline" className={`text-xs ${urgencyColors[lead.urgency]}`}>{lead.urgency}</Badge>
                        {lead.ai_score != null && (
                          <Badge className="text-xs bg-primary/10 text-primary gap-1"><Sparkles className="w-3 h-3" />{lead.ai_score}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {lead.assigned_to ? (
                          <span className="font-medium text-foreground flex items-center gap-1"><UserCheck className="w-3 h-3 text-primary" />{lead.assigned_to}</span>
                        ) : (
                          <span className="text-orange-500 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Unassigned</span>
                        )}
                        {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                        {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                        {lead.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.address}</span>}
                      </div>
                      {lead.follow_up_date && (
                        <p className="text-xs flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          <span className={followUpLabel(lead.follow_up_date)?.cls}>Follow-up: {followUpLabel(lead.follow_up_date)?.label}</span>
                        </p>
                      )}
                      {lead.description && <p className="text-xs text-muted-foreground line-clamp-1">{lead.description}</p>}
                      {lead.ai_notes && <p className="text-xs text-primary/80 italic">AI: {lead.ai_notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => handleAutoAssign(lead)}>
                        <Sparkles className="w-3 h-3" /> Auto-assign
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAssigningLead(lead)}>Assign / Schedule</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateLead.mutate({ id: lead.id, data: { status: "contacted", contact_attempts: (lead.contact_attempts || 0) + 1, last_contact_date: new Date().toISOString().split("T")[0] } })}>Mark Contacted</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateLead.mutate({ id: lead.id, data: { status: "qualified" } })}>Mark Qualified</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateLead.mutate({ id: lead.id, data: { status: "won" } })}>Mark Won ✓</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateLead.mutate({ id: lead.id, data: { status: "lost" } })}>Mark Lost</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TEAM TAB */}
        <TabsContent value="team" className="mt-4 space-y-3">
          {salespersons.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-muted-foreground mb-3">No salespersons added yet.</p>
              <Button onClick={() => setShowSalespersonForm(true)} className="gap-2"><Plus className="w-4 h-4" />Add First Salesperson</Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {salespersons.map((sp) => {
                const spLeads = activeLeads.filter((l) => l.assigned_to_id === sp.id);
                const spWon = leads.filter((l) => l.assigned_to_id === sp.id && l.status === "won").length;
                return (
                  <Card key={sp.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{sp.first_name} {sp.last_name}</p>
                        {sp.territory && <p className="text-xs text-muted-foreground">{sp.territory}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className={sp.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                          {sp.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingSalesperson(sp)}>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteSalesperson.mutate(sp.id)}>Remove</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-lg font-bold">{spLeads.length}</p>
                        <p className="text-[10px] text-muted-foreground">Active</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-lg font-bold text-green-600">{spWon}</p>
                        <p className="text-[10px] text-muted-foreground">Won</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2">
                        <p className="text-lg font-bold">{sp.max_leads || 10}</p>
                        <p className="text-[10px] text-muted-foreground">Capacity</p>
                      </div>
                    </div>
                    {sp.specialties?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sp.specialties.map((s) => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                      </div>
                    )}
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {sp.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{sp.phone}</span>}
                      {sp.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" />{sp.email}</span>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SalespersonForm
        open={showSalespersonForm || !!editingSalesperson}
        onOpenChange={(v) => { if (!v) { setShowSalespersonForm(false); setEditingSalesperson(null); } }}
        initialData={editingSalesperson}
        onSubmit={(d) => editingSalesperson ? updateSalesperson.mutate({ id: editingSalesperson.id, data: d }) : createSalesperson.mutate(d)}
      />

      {assigningLead && (
        <LeadAssignModal
          open={!!assigningLead}
          onOpenChange={(v) => { if (!v) setAssigningLead(null); }}
          lead={assigningLead}
          salespersons={salespersons}
          onSave={(data) => { updateLead.mutate({ id: assigningLead.id, data }); setAssigningLead(null); }}
        />
      )}
    </div>
  );
}