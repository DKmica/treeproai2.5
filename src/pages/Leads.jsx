import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Sparkles, Phone, Mail, MapPin, UserCheck, FileText } from "lucide-react";
import LeadForm from "@/components/leads/LeadForm";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const statusColors = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  attempting_contact: "bg-amber-100 text-amber-700",
  left_voicemail: "bg-orange-100 text-orange-600",
  qualified: "bg-purple-100 text-purple-700",
  quoted: "bg-orange-100 text-orange-700",
  negotiating: "bg-indigo-100 text-indigo-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
  disqualified: "bg-gray-100 text-gray-500",
};

const urgencyColors = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-blue-50 text-blue-600",
  high: "bg-orange-50 text-orange-600",
  emergency: "bg-red-50 text-red-600",
};

export default function Leads() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [search, setSearch] = useState("");
  const [scoringId, setScoringId] = useState(null);
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: () => base44.entities.Lead.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leads"] }); setShowForm(false); toast.success("Lead created"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leads"] }); setEditingLead(null); toast.success("Lead updated"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lead.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead deleted"); },
  });

  const convertToCustomer = async (lead) => {
    const existing = await base44.entities.Customer.filter({ lead_id: lead.id });
    if (existing.length > 0) {
      toast.info("Customer already exists for this lead");
      navigate("/customers");
      return;
    }
    await base44.entities.Customer.create({
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email || "",
      phone: lead.phone || "",
      address: lead.address || "",
      notes: lead.description || "",
      lead_id: lead.id,
    });
    updateMutation.mutate({ id: lead.id, data: { status: "won" } });
    toast.success("Customer created!");
    navigate("/customers");
  };

  const aiScoreMutation = useMutation({
    mutationFn: async (lead) => {
      setScoringId(lead.id);
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Score this tree service lead on a scale of 0-100. Consider urgency, service potential, and conversion probability.
Lead: ${lead.first_name} ${lead.last_name}
Description: ${lead.description || "No description"}
Urgency: ${lead.urgency}
Source: ${lead.source}
Address: ${lead.address || "Not provided"}`,
        response_json_schema: {
          type: "object",
          properties: {
            score: { type: "number" },
            notes: { type: "string" },
          },
        },
      });
      await base44.entities.Lead.update(lead.id, {
        ai_score: result.score,
        ai_notes: result.notes,
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["leads"] }); setScoringId(null); toast.success("AI scoring complete"); },
    onError: () => { setScoringId(null); toast.error("AI scoring failed"); },
  });

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    return !q || `${l.first_name} ${l.last_name} ${l.email} ${l.address}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{leads.length} total leads</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Lead
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No leads found</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((lead) => (
            <Card key={lead.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{lead.first_name} {lead.last_name}</h3>
                    <Badge className={statusColors[lead.status]}>{lead.status}</Badge>
                    <Badge variant="outline" className={urgencyColors[lead.urgency]}>{lead.urgency}</Badge>
                    {lead.ai_score != null && (
                      <Badge className="bg-primary/10 text-primary gap-1">
                        <Sparkles className="w-3 h-3" /> {lead.ai_score}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                    {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                    {lead.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.address}</span>}
                  </div>
                  {lead.description && <p className="text-sm text-muted-foreground line-clamp-1">{lead.description}</p>}
                  {lead.ai_notes && <p className="text-xs text-primary/80 italic">AI: {lead.ai_notes}</p>}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingLead(lead)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => aiScoreMutation.mutate(lead)} disabled={scoringId === lead.id}>
                      <Sparkles className="w-4 h-4 mr-2" />{scoringId === lead.id ? "Scoring..." : "AI Score"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateMutation.mutate({ id: lead.id, data: { status: "contacted" } })}>Mark Contacted</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateMutation.mutate({ id: lead.id, data: { status: "qualified" } })}>Mark Qualified</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => convertToCustomer(lead)} className="gap-2">
                      <UserCheck className="w-4 h-4" />Convert to Customer
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/quotes?new=1&customer_name=${encodeURIComponent(lead.first_name + ' ' + lead.last_name)}&lead_id=${lead.id}`)} className="gap-2">
                      <FileText className="w-4 h-4" />Create Quote
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(lead.id)}>Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      <LeadForm open={showForm} onOpenChange={setShowForm} onSubmit={(d) => createMutation.mutate(d)} />
      {editingLead && (
        <LeadForm
          open={!!editingLead}
          onOpenChange={() => setEditingLead(null)}
          initialData={editingLead}
          onSubmit={(d) => updateMutation.mutate({ id: editingLead.id, data: d })}
        />
      )}
    </div>
  );
}