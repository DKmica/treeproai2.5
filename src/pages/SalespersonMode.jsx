import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import SalesToday from "@/components/salesperson/SalesToday";
import SalesLeadList from "@/components/salesperson/SalesLeadList";
import SalesLeadDetail from "@/components/salesperson/SalesLeadDetail";
import SalesQuotes from "@/components/salesperson/SalesQuotes";
import SalesMe from "@/components/salesperson/SalesMe";
import SalesMap from "@/components/salesperson/SalesMap";
import { CalendarDays, List, MapPin, FileText, User } from "lucide-react";

const TABS = [
  { id: "today", label: "Today", icon: CalendarDays },
  { id: "leads", label: "Leads", icon: List },
  { id: "map", label: "Map", icon: MapPin },
  { id: "quotes", label: "Quotes", icon: FileText },
  { id: "me", label: "Me", icon: User },
];

export default function SalespersonMode() {
  const [activeTab, setActiveTab] = useState("today");
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["current_user"],
    queryFn: () => base44.auth.me(),
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["sp_leads"],
    queryFn: () => base44.entities.Lead.list("-created_date", 200),
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["sp_quotes"],
    queryFn: () => base44.entities.Quote.list("-created_date", 100),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["sp_employees"],
    queryFn: () => base44.entities.Employee.list(),
  });

  const updateLead = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sp_leads"] }),
  });

  // Find this user's employee record
  const myEmployee = employees.find(e =>
    e.email?.toLowerCase() === user?.email?.toLowerCase() ||
    `${e.first_name} ${e.last_name}`.toLowerCase() === user?.full_name?.toLowerCase()
  );

  // Filter to assigned leads (salesperson sees their own; admin sees all)
  const isAdmin = user?.role === "admin";
  const myLeads = isAdmin
    ? leads
    : leads.filter(l => l.assigned_to_id === myEmployee?.id || l.assigned_to === user?.full_name);

  const myQuotes = isAdmin
    ? quotes
    : quotes.filter(q => q.created_by_id === user?.id || q.customer_name);

  if (selectedLeadId) {
    const lead = leads.find(l => l.id === selectedLeadId);
    return (
      <SalesLeadDetail
        lead={lead}
        quotes={quotes.filter(q => q.lead_id === selectedLeadId || q.customer_name === `${lead?.first_name} ${lead?.last_name}`)}
        onBack={() => setSelectedLeadId(null)}
        onUpdate={(data) => updateLead.mutate({ id: selectedLeadId, data })}
        onQuoteCreated={() => queryClient.invalidateQueries({ queryKey: ["sp_quotes"] })}
        user={user}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "today" && (
          <SalesToday
            leads={myLeads}
            onSelectLead={setSelectedLeadId}
            onUpdateLead={(id, data) => updateLead.mutate({ id, data })}
            user={user}
          />
        )}
        {activeTab === "leads" && (
          <SalesLeadList
            leads={myLeads}
            loading={leadsLoading}
            onSelectLead={setSelectedLeadId}
            onUpdateLead={(id, data) => updateLead.mutate({ id, data })}
          />
        )}
        {activeTab === "map" && (
          <SalesMap leads={myLeads} onSelectLead={setSelectedLeadId} />
        )}
        {activeTab === "quotes" && (
          <SalesQuotes quotes={myQuotes} leads={myLeads} />
        )}
        {activeTab === "me" && (
          <SalesMe leads={leads} myLeads={myLeads} quotes={myQuotes} user={user} employee={myEmployee} />
        )}
      </div>

      {/* Bottom Nav */}
      <div className="border-t bg-background safe-area-bottom shrink-0">
        <div className="grid grid-cols-5">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 py-2.5 px-1 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                <span className={`text-[10px] font-medium ${isActive ? "text-primary" : ""}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}