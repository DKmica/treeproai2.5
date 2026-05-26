import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

const ENTITY_COLORS = {
  Quote: "bg-blue-100 text-blue-700",
  Job: "bg-green-100 text-green-700",
  Invoice: "bg-purple-100 text-purple-700",
  Payment: "bg-emerald-100 text-emerald-700",
  Customer: "bg-orange-100 text-orange-700",
  AIAnalysisRecord: "bg-yellow-100 text-yellow-700",
  CompanySettings: "bg-gray-100 text-gray-700",
};

function AuditEntry({ log }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = log.old_value || log.new_value;

  return (
    <div className="py-3 border-b last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${ENTITY_COLORS[log.entity_type] || "bg-gray-100 text-gray-600"} text-xs`}>
              {log.entity_type}
            </Badge>
            <span className="text-sm font-medium">{log.action?.replace(/_/g, " ")}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            <span>By: {log.actor_name || log.actor_id || "system"}</span>
            {log.notes && <span className="text-gray-500">{log.notes}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {log.created_date ? format(new Date(log.created_date), "MMM d, h:mm a") : "—"}
          </span>
          {hasData && (
            <button onClick={() => setExpanded(v => !v)} className="text-primary text-xs flex items-center gap-0.5">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>
      {expanded && hasData && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {log.old_value && Object.keys(log.old_value).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-2">
              <p className="font-medium text-red-700 mb-1">Before</p>
              <pre className="text-red-600 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(log.old_value, null, 2)}</pre>
            </div>
          )}
          {log.new_value && Object.keys(log.new_value).length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded p-2">
              <p className="font-medium text-green-700 mb-1">After</p>
              <pre className="text-green-600 whitespace-pre-wrap overflow-x-auto">{JSON.stringify(log.new_value, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit_logs"],
    queryFn: () => base44.entities.AuditLog.list("-created_date", 200),
  });

  const filtered = logs.filter(l => {
    const matchSearch =
      (l.action || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.actor_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.entity_type || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.notes || "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || l.entity_type === filterType;
    return matchSearch && matchType;
  });

  const entityTypes = [...new Set(logs.map(l => l.entity_type).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> Audit Log
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Immutable record of all sensitive changes in the system.
        </p>
      </div>

      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        <strong>Security note:</strong> Server-side enforcement required for complete audit trail.
        Client-side audit entries are created throughout the app. For production, backend functions
        should create audit entries for all privileged operations.
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions, actors, entities..." className="pl-9" />
        </div>
        <select
          className="border rounded-md h-9 px-3 text-sm bg-background"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="all">All Types</option>
          {entityTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-muted-foreground">No audit entries found</p>
          <p className="text-sm text-muted-foreground mt-1">Entries are created automatically for sensitive operations</p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-3">{filtered.length} entries</p>
            {filtered.map(log => <AuditEntry key={log.id} log={log} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}