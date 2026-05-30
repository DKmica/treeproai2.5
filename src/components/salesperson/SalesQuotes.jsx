import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileText, ChevronRight, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG = {
  draft: { label: "Draft", cls: "bg-gray-100 text-gray-600" },
  needs_review: { label: "Needs Review", cls: "bg-yellow-100 text-yellow-700" },
  sent: { label: "Sent", cls: "bg-blue-100 text-blue-700" },
  viewed: { label: "Viewed", cls: "bg-indigo-100 text-indigo-700" },
  approved: { label: "Approved ✓", cls: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-700" },
  expired: { label: "Expired", cls: "bg-orange-100 text-orange-700" },
  converted_to_job: { label: "Job Created", cls: "bg-teal-100 text-teal-700" },
  invoiced: { label: "Invoiced", cls: "bg-purple-100 text-purple-700" },
  paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-700" },
};

export default function SalesQuotes({ quotes = [], leads = [] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = quotes.filter(q => {
    const s = search.toLowerCase();
    const matchQ = !s || `${q.quote_number} ${q.customer_name}`.toLowerCase().includes(s);
    if (filter === "open") return matchQ && ["draft","sent","viewed","needs_review"].includes(q.status);
    if (filter === "approved") return matchQ && ["approved","converted_to_job"].includes(q.status);
    if (filter === "closed") return matchQ && ["rejected","expired"].includes(q.status);
    return matchQ;
  });

  const totalPending = quotes.filter(q => ["sent","viewed"].includes(q.status)).reduce((s, q) => s + (q.total_amount || 0), 0);
  const totalWon = quotes.filter(q => ["approved","converted_to_job","paid"].includes(q.status)).reduce((s, q) => s + (q.total_amount || 0), 0);

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      <div className="p-4 border-b space-y-3 bg-background sticky top-0 z-10">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-600">Pending</p>
            <p className="text-xl font-bold text-blue-700">${totalPending.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-green-600">Won</p>
            <p className="text-xl font-bold text-green-700">${totalWon.toLocaleString()}</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search quotes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <div className="flex gap-1.5">
          {["all","open","approved","closed"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">No quotes found</Card>
        ) : (
          filtered.map(q => (
            <Card key={q.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="font-semibold text-sm">#{q.quote_number}</span>
                    <Badge className={`text-xs ${STATUS_CONFIG[q.status]?.cls || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_CONFIG[q.status]?.label || q.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{q.customer_name}</p>
                  <p className="text-xl font-bold text-primary">${(q.total_amount || 0).toLocaleString()}</p>
                  {q.valid_until && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Expires {format(new Date(q.valid_until), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {q.status === "approved" && <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />}
                  {q.status === "rejected" && <XCircle className="w-5 h-5 text-red-500 ml-auto" />}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}