import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, MapPin, Calendar, Users, DollarSign, Receipt } from "lucide-react";
import { logActivity, logAudit, createNotification } from "@/lib/treeproWorkflow";
import { useNavigate } from "react-router-dom";
import JobForm from "@/components/jobs/JobForm";
import GenerateInvoiceDialog from "@/components/jobs/GenerateInvoiceDialog";
import { toast } from "sonner";
import { format } from "date-fns";

const statusColors = {
  unscheduled: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  dispatched: "bg-purple-100 text-purple-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  paused: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  needs_follow_up: "bg-pink-100 text-pink-700",
  invoiced: "bg-teal-100 text-teal-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function Jobs() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [invoiceJob, setInvoiceJob] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({ queryKey: ["jobs"], queryFn: () => base44.entities.Job.list("-created_date") });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: () => base44.entities.Customer.list() });
  const { data: crews = [] } = useQuery({ queryKey: ["crews"], queryFn: () => base44.entities.Crew.list() });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const job = await base44.entities.Job.create(data);
      logActivity({ relatedType: "Job", relatedId: job.id, actor: "staff", action: `Job scheduled for ${data.customer_name}`, notes: data.description || "" });
      logAudit({ actorName: "staff", action: "job_created", entityType: "Job", entityId: job.id, newValue: { customer: data.customer_name, status: data.status, scheduled_date: data.scheduled_date } });
      createNotification({ type: "job_assigned", title: `Job scheduled: ${data.customer_name}`, message: data.description || "", relatedType: "Job", relatedId: job.id });
      return job;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["jobs"] }); setShowForm(false); toast.success("Job scheduled"); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const job = await base44.entities.Job.update(id, data);
      if (data.status) {
        logActivity({ relatedType: "Job", relatedId: id, actor: "staff", action: `Job status changed to ${data.status}`, notes: data.completion_notes || "" });
        if (data.status === "completed") {
          logAudit({ actorName: "staff", action: "job_completed", entityType: "Job", entityId: id, newValue: { status: "completed", completion_date: data.completion_date } });
          createNotification({ type: "job_completed", title: "Job completed", message: `Job marked complete`, relatedType: "Job", relatedId: id });
        }
      }
      return job;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["jobs"] }); setEditing(null); toast.success("Job updated"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Job.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["jobs"] }); toast.success("Deleted"); },
  });

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    return !q || `${j.customer_name} ${j.description} ${j.crew_name}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">{jobs.length} total jobs</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2"><Plus className="w-4 h-4" /> Schedule Job</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search jobs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center"><p className="text-muted-foreground">No jobs found</p></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((j) => (
            <Card key={j.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{j.customer_name}</h3>
                    <Badge className={statusColors[j.status]}>{j.status?.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{j.description}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {j.scheduled_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(j.scheduled_date), "MMM d, yyyy")}</span>}
                    {j.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{j.address}</span>}
                    {j.crew_name && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{j.crew_name}</span>}
                    {j.total_cost > 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />${j.total_cost.toLocaleString()}</span>}
                  </div>
                  {/* Prominent Generate Invoice button for completed jobs */}
                  {j.status === "completed" && (
                    <Button
                      size="sm"
                      className="gap-1.5 mt-1"
                      onClick={() => setInvoiceJob(j)}
                    >
                      <Receipt className="w-3.5 h-3.5" /> Generate Invoice
                    </Button>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(j)}>Edit</DropdownMenuItem>
                    {j.status === "scheduled" && <DropdownMenuItem onClick={() => updateMutation.mutate({ id: j.id, data: { status: "in_progress" } })}>Start Job</DropdownMenuItem>}
                    {j.status === "in_progress" && <DropdownMenuItem onClick={() => updateMutation.mutate({ id: j.id, data: { status: "completed", completion_date: new Date().toISOString().split("T")[0] } })}>Complete Job</DropdownMenuItem>}
                    {j.status === "completed" && (
                      <DropdownMenuItem onClick={() => setInvoiceJob(j)}>
                        <Receipt className="w-4 h-4 mr-2" />Generate Invoice
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(j.id)}>Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      <JobForm open={showForm} onOpenChange={setShowForm} customers={customers} crews={crews} onSubmit={(d) => createMutation.mutate(d)} />
      {editing && <JobForm open={!!editing} onOpenChange={() => setEditing(null)} customers={customers} crews={crews} initialData={editing} onSubmit={(d) => updateMutation.mutate({ id: editing.id, data: d })} />}
      {invoiceJob && <GenerateInvoiceDialog job={invoiceJob} onClose={() => setInvoiceJob(null)} />}
    </div>
  );
}