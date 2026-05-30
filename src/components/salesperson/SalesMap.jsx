import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, ChevronRight, Flame, List, Map } from "lucide-react";

const URGENCY_COLORS = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700",
};

export default function SalesMap({ leads = [], onSelectLead }) {
  const [view, setView] = useState("list"); // list | map
  const activeLeads = leads.filter(l => !["won","lost","disqualified"].includes(l.status) && l.address);

  const openInMaps = (lead) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lead.address)}`, "_blank");
  };

  const openRouteInMaps = () => {
    const addresses = activeLeads.slice(0, 8).map(l => l.address).filter(Boolean);
    if (addresses.length === 0) return;
    if (addresses.length === 1) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addresses[0])}`, "_blank");
      return;
    }
    const origin = "My+Location";
    const destination = encodeURIComponent(addresses[addresses.length - 1]);
    const waypoints = addresses.slice(0, -1).map(a => encodeURIComponent(a)).join("|");
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`, "_blank");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-background sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Lead Map</h2>
          <Badge className="text-xs">{activeLeads.length} active leads</Badge>
        </div>
        <Button className="w-full h-11 gap-2" onClick={openRouteInMaps}>
          <Navigation className="w-4 h-4" /> Open Today's Route in Google Maps
        </Button>
        <div className="flex gap-2">
          <button
            onClick={() => setView("list")}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${view === "list" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <List className="w-3.5 h-3.5 inline mr-1" /> List
          </button>
          <button
            onClick={() => setView("map")}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${view === "map" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Map className="w-3.5 h-3.5 inline mr-1" /> Map
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === "map" ? (
          <div className="flex flex-col items-center justify-center h-full p-6 space-y-4 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <MapPin className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Google Maps Integration</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tap "Open Today's Route" to view all leads on Google Maps with optimal driving directions.
              </p>
            </div>
            <Button onClick={openRouteInMaps} className="gap-2">
              <Navigation className="w-4 h-4" /> Open in Google Maps
            </Button>
            <p className="text-xs text-muted-foreground">
              Integration required: Google Maps Embed API for in-app map view
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {activeLeads.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground text-sm">No active leads with addresses</Card>
            ) : (
              activeLeads.map((lead, idx) => (
                <Card
                  key={lead.id}
                  className={`p-3 cursor-pointer active:scale-[0.98] transition-all ${
                    lead.urgency === "emergency" ? "border-red-200 bg-red-50/30" :
                    lead.urgency === "high" ? "border-orange-200" : ""
                  }`}
                  onClick={() => onSelectLead(lead.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {(lead.urgency === "emergency" || lead.urgency === "high") && (
                          <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        )}
                        <p className="font-semibold text-sm truncate">{lead.first_name} {lead.last_name}</p>
                        <Badge className={`text-xs shrink-0 ${URGENCY_COLORS[lead.urgency]}`}>{lead.urgency}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{lead.address}</p>
                      {lead.estimated_value && (
                        <p className="text-xs text-green-700 font-medium">${lead.estimated_value.toLocaleString()}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={e => { e.stopPropagation(); openInMaps(lead); }}
                    >
                      <Navigation className="w-3.5 h-3.5" />
                    </Button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}