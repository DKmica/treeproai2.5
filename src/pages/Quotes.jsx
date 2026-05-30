import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Sparkles, FileText, Loader2 } from "lucide-react";
import QuoteForm from "@/components/quotes/QuoteForm";
import GenerateFromAssessmentModal from "@/components/quotes/GenerateFromAssessmentModal";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const statusColors = {
  draft: "bg-muted text-muted-foreground",
  needs_review: "bg-yellow-100 text-yellow-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-indigo-100 text-indigo-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
  converted_to_job: "bg-teal-100 text-teal-700",
  invoiced: "bg-purple-100 text-purple-700",
  paid: "bg-emerald-100 text-emerald-700",
};

export default function Quotes() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [prefillAssessmentText, setPrefillAssessmentText] = useState("");
  const [prefillCustomerName, setPrefillCustomerName] = useState("");
  const [prefillStructuredAnalysis, setPrefillStructuredAnalysis] = useState(null);
  const location = useLocation();

  useEffect(() => {
    if (location.state?.autoOpenAssessment && location.state?.assessmentText) {
      setPrefillAssessmentText(location.state.assessmentText);
      setPrefillCustomerName(location.state.prefillCustomerName || "");
      setPrefillStructuredAnalysis(location.state.structuredAnalysis || null);
      setShowAssessmentModal(true);
      window.history.replaceState({}, "");
    }
    // Auto-open form when coming from leads with ?new=1
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setShowForm(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location.state]);
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery({ queryKey: ["quotes"], queryFn: () => base44.entities.Quote.list("-created_date") });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => base44.entities.Customer.list() });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Quote.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quotes"] }); setShowForm(false); toast.success("Quote created"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Quote.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quotes"] }); setEditing(null); toast.success("Quote updated"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Quote.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["quotes"] }); toast.success("Deleted"); },
  });

  const aiGenerateQuote = async (customer) => {
    setGenerating(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a professional tree service quote for customer: ${customer.first_name} ${customer.last_name} at ${customer.address || "their property"}.
Include common tree services like trimming, removal, stump grinding. Generate realistic line items with descriptions, quantities, and prices.`,
      response_json_schema: {
        type: "object",
        properties: {
          line_items: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unit_price: { type: "number" }, total: { type: "number" } } } },
          notes: { type: "string" },
        },
      },
    });
    const total = result.line_items.reduce((s, i) => s + (i.total || 0), 0);
    await base44.entities.Quote.create({
      quote_number: `Q-${Date.now().toString(36).toUpperCase()}`,
      customer_id: customer.id,
      customer_name: `${customer.first_name} ${customer.last_name}`,
      line_items: result.line_items,
      total_amount: total,
      notes: result.notes,
      ai_generated: true,
      status: "draft",
    });
    queryClient.invalidateQueries({ queryKey: ["quotes"] });
    setGenerating(false);
    toast.success("AI quote generated!");
  };

  const filtered = quotes.filter((q) => {
    const s = search.toLowerCase();
    return !s || `${q.quote_number} ${q.customer_name}`.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-sm text-muted-foreground mt-1">{quotes.length} total quotes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setShowAssessmentModal(true)}>
            <Sparkles className="w-4 h-4 text-primary" /> From AI Assessment
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={generating || customers.length === 0}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Generate
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {customers.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => aiGenerateQuote(c)}>{c.first_name} {c.last_name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> New Quote</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search quotes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center"><p className="text-muted-foreground">No quotes found</p></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((q) => (
            <Card key={q.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/quotes/${q.id}`)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-semibold">{q.quote_number}</h3>
                    <Badge className={statusColors[q.status]}>{q.status}</Badge>
                    {q.ai_generated && <Badge className="bg-primary/10 text-primary gap-1"><Sparkles className="w-3 h-3" />AI</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{q.customer_name}</p>
                  <p className="text-lg font-bold">${(q.total_amount || 0).toLocaleString()}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" onClick={e => e.stopPropagation()}><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/quotes/${q.id}`)}>View Details</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditing(q)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateMutation.mutate({ id: q.id, data: { status: "sent" } })}>Mark Sent</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateMutation.mutate({ id: q.id, data: { status: "approved" } })}>Mark Approved</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(q.id)}>Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      <QuoteForm open={showForm} onOpenChange={setShowForm} customers={customers} onSubmit={(d) => createMutation.mutate(d)} />
      {editing && <QuoteForm open={!!editing} onOpenChange={() => setEditing(null)} customers={customers} initialData={editing} onSubmit={(d) => updateMutation.mutate({ id: editing.id, data: d })} />}
      <GenerateFromAssessmentModal
        open={showAssessmentModal}
        onOpenChange={(v) => { setShowAssessmentModal(v); if (!v) { setPrefillAssessmentText(""); setPrefillCustomerName(""); setPrefillStructuredAnalysis(null); } }}
        customers={customers}
        prefillText={prefillAssessmentText}
        prefillCustomerName={prefillCustomerName}
        prefillStructuredAnalysis={prefillStructuredAnalysis}
        onQuoteCreated={() => queryClient.invalidateQueries({ queryKey: ["quotes"] })}
      />
    </div>
  );
}