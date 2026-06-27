import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, Camera, Fuel } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/treeproWorkflow";

const CATEGORIES = [
  { value: "fuel", label: "Fuel", color: "bg-red-100 text-red-700" },
  { value: "supplies", label: "Supplies", color: "bg-blue-100 text-blue-700" },
  { value: "equipment_rental", label: "Equipment Rental", color: "bg-purple-100 text-purple-700" },
  { value: "dump", label: "Dump Fee", color: "bg-orange-100 text-orange-700" },
  { value: "travel", label: "Travel", color: "bg-cyan-100 text-cyan-700" },
  { value: "other", label: "Other", color: "bg-gray-100 text-gray-700" },
];

const catStyle = (c) => CATEGORIES.find((x) => x.value === c)?.color || "bg-gray-100 text-gray-700";
const catLabel = (c) => CATEGORIES.find((x) => x.value === c)?.label || c;

export default function ExpenseLogSection({ job }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: "fuel", amount: "", description: "", receipt_url: "" });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: expenses = [] } = useQuery({
    queryKey: ["job_expenses", job.id],
    queryFn: () => base44.entities.JobExpense.filter({ job_id: job.id }, "-created_date"),
  });

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const handleReceiptUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setForm((f) => ({ ...f, receipt_url: file_url }));
        toast.success("Receipt photo attached");
      } catch {
        toast.error("Upload failed");
      }
      setUploading(false);
    };
    input.click();
  };

  const handleAdd = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.JobExpense.create({
        job_id: job.id,
        customer_name: job.customer_name,
        category: form.category,
        amount: amt,
        description: form.description,
        expense_date: new Date().toISOString().slice(0, 10),
        logged_by: "crew",
        receipt_url: form.receipt_url,
      });
      const newTotal = total + amt;
      await base44.entities.Job.update(job.id, { expenses_total: newTotal });
      await logActivity({
        relatedType: "Job",
        relatedId: job.id,
        actor: "crew",
        action: `Expense logged: ${catLabel(form.category)} $${amt.toFixed(2)}`,
        notes: form.description || "",
      });
      setForm({ category: "fuel", amount: "", description: "", receipt_url: "" });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["job_expenses", job.id] });
      qc.invalidateQueries({ queryKey: ["crew_jobs"] });
      toast.success("Expense added");
    } catch {
      toast.error("Failed to add expense");
    }
    setSaving(false);
  };

  const handleDelete = async (exp) => {
    try {
      await base44.entities.JobExpense.delete(exp.id);
      const newTotal = Math.max(0, total - (exp.amount || 0));
      await base44.entities.Job.update(job.id, { expenses_total: newTotal });
      qc.invalidateQueries({ queryKey: ["job_expenses", job.id] });
      qc.invalidateQueries({ queryKey: ["crew_jobs"] });
      toast.success("Expense removed");
    } catch {
      toast.error("Failed to remove expense");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Fuel className="w-3.5 h-3.5" /> Job Expenses
        </p>
        {total > 0 && <span className="text-xs font-semibold">${total.toFixed(2)}</span>}
      </div>

      {expenses.length > 0 && (
        <div className="space-y-1.5">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-2 text-xs bg-muted/60 rounded-md p-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Badge className={catStyle(e.category)}>{catLabel(e.category)}</Badge>
                  <span className="font-semibold">${(e.amount || 0).toFixed(2)}</span>
                </div>
                {e.description && <p className="text-muted-foreground mt-0.5 truncate">{e.description}</p>}
                {e.receipt_url && (
                  <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-[11px]">
                    View receipt
                  </a>
                )}
              </div>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => handleDelete(e)}>
                <Trash2 className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-2 border rounded-md p-2.5 bg-background">
          <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="Amount $"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="h-8 text-sm"
          />
          <Textarea
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="text-sm resize-none"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleReceiptUpload} disabled={uploading}>
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              {form.receipt_url ? "Receipt ✓" : "Receipt"}
            </Button>
            <Button size="sm" className="text-xs flex-1" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
              Save Expense
            </Button>
            <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full text-xs gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Expense
        </Button>
      )}
    </div>
  );
}