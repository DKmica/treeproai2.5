import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  TreePine, CheckCircle2, XCircle, MessageSquare, Loader2,
  DollarSign, Phone, Mail, MapPin, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function CustomerPortal() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = window.location.pathname.split("/portal/")[1] || urlParams.get("token");

  const [session, setSession] = useState(null);
  const [quote, setQuote] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null); // "approved" | "rejected" | "changes"
  const [changeNotes, setChangeNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setError("Invalid or missing portal link."); setLoading(false); return; }
    loadPortal();
    base44.entities.CompanySettings.list().then(arr => { if (arr[0]) setCompany(arr[0]); });
  }, [token]);

  const loadPortal = async () => {
    try {
      const sessions = await base44.entities.CustomerPortalSession.filter({ token });
      if (!sessions.length) { setError("This link is invalid or has expired."); setLoading(false); return; }
      const s = sessions[0];
      if (s.status === "expired" || (s.expires_at && new Date(s.expires_at) < new Date())) {
        setError("This link has expired. Please contact us for a new one."); setLoading(false); return;
      }
      setSession(s);

      const quotes = await base44.entities.Quote.filter({ id: s.quote_id });
      if (quotes[0]) setQuote(quotes[0]);

      if (quotes[0]?.customer_id) {
        const custs = await base44.entities.Customer.filter({ id: quotes[0].customer_id });
        if (custs[0]) setCustomer(custs[0]);
      }

      // Mark as viewed
      if (!s.viewed_at) {
        await base44.entities.CustomerPortalSession.update(s.id, { viewed_at: new Date().toISOString() });
        if (quotes[0]) await base44.entities.Quote.update(quotes[0].id, { status: "viewed" });
      }
    } catch (e) {
      setError("Unable to load your quote. Please try again or contact us directly.");
    }
    setLoading(false);
  };

  const handleAction = async (type) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (type === "approved") {
        await base44.entities.Quote.update(quote.id, {
          status: "approved",
          approved_at: new Date().toISOString(),
        });
        await base44.entities.CustomerPortalSession.update(session.id, { status: "used", action_taken: "approved" });
        await base44.entities.Notification.create({
          type: "quote_approved",
          title: `Quote approved by ${customer?.first_name || "customer"}`,
          message: `Quote for ${quote.customer_name} has been approved via the customer portal.`,
          read: false,
        });
        await base44.entities.ActivityLog.create({
          related_type: "Quote",
          related_id: quote.id,
          actor: customer?.first_name ? `${customer.first_name} ${customer.last_name}` : "Customer",
          action: "Quote approved via customer portal",
        });
        setAction("approved");
      } else if (type === "rejected") {
        await base44.entities.Quote.update(quote.id, {
          status: "rejected",
          rejected_at: new Date().toISOString(),
        });
        await base44.entities.CustomerPortalSession.update(session.id, { status: "used", action_taken: "rejected" });
        await base44.entities.ActivityLog.create({
          related_type: "Quote",
          related_id: quote.id,
          actor: customer?.first_name ? `${customer.first_name} ${customer.last_name}` : "Customer",
          action: "Quote rejected via customer portal",
        });
        setAction("rejected");
      } else if (type === "changes") {
        await base44.entities.Quote.update(quote.id, { status: "needs_review", notes: (quote.notes ? quote.notes + "\n\n" : "") + `Customer requested changes: ${changeNotes}` });
        await base44.entities.CustomerPortalSession.update(session.id, { action_taken: `changes_requested: ${changeNotes}` });
        await base44.entities.Notification.create({
          type: "change_order",
          title: `${quote.customer_name} requested quote changes`,
          message: changeNotes,
          read: false,
        });
        setAction("changes");
      }
      setQuote(prev => ({ ...prev, status: type === "changes" ? "needs_review" : type }));
    } catch (e) {
      toast.error("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  const companyName = company?.company_name || "Your Tree Service";
  const companyPhone = company?.phone || "";
  const disclaimer = company?.public_estimate_disclaimer || "";

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Link Error</h2>
        <p className="text-muted-foreground">{error}</p>
        {companyPhone && <p className="text-sm">Call us at <a href={`tel:${companyPhone}`} className="font-medium text-primary">{companyPhone}</a></p>}
      </div>
    </div>
  );

  const lineItems = quote?.line_items || [];
  const total = quote?.total_amount || lineItems.reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {company?.logo_url
            ? <img src={company.logo_url} alt="Logo" className="h-10 object-contain" />
            : <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center"><TreePine className="w-5 h-5 text-primary-foreground" /></div>
          }
          <div>
            <h1 className="font-bold text-lg">{companyName}</h1>
            <p className="text-xs text-muted-foreground">Customer Quote Portal</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Completion messages */}
        {action === "approved" && (
          <div className="text-center py-8 space-y-3">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-700">Quote Approved!</h2>
            <p className="text-muted-foreground">Thank you! Our team has been notified and will contact you shortly to schedule your service.</p>
            {companyPhone && (
              <Button asChild variant="outline" className="gap-2">
                <a href={`tel:${companyPhone}`}><Phone className="w-4 h-4" /> Call Us: {companyPhone}</a>
              </Button>
            )}
          </div>
        )}

        {action === "rejected" && (
          <div className="text-center py-8 space-y-3">
            <h2 className="text-2xl font-bold">Quote Declined</h2>
            <p className="text-muted-foreground">We understand. If you change your mind or have questions, don't hesitate to reach out.</p>
            {companyPhone && <Button asChild variant="outline"><a href={`tel:${companyPhone}`}><Phone className="w-4 h-4 mr-2" />Contact Us</a></Button>}
          </div>
        )}

        {action === "changes" && (
          <div className="text-center py-8 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-2xl font-bold">Changes Requested</h2>
            <p className="text-muted-foreground">We received your notes and will send you an updated quote soon.</p>
          </div>
        )}

        {!action && quote && (
          <>
            <div>
              <h2 className="text-2xl font-bold">Your Quote</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Quote {quote.quote_number ? `#${quote.quote_number}` : ""} · 
                {quote.valid_until && ` Valid until ${format(new Date(quote.valid_until), "MMMM d, yyyy")}`}
              </p>
              <Badge className="mt-2">{quote.status?.replace(/_/g, " ")}</Badge>
            </div>

            {/* Customer info */}
            <Card>
              <CardContent className="pt-4 text-sm space-y-1">
                <p className="font-semibold">{quote.customer_name}</p>
                {customer?.phone && <p className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3" />{customer.phone}</p>}
                {customer?.email && <p className="text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" />{customer.email}</p>}
                {customer?.address && <p className="text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3 h-3" />{customer.address}</p>}
              </CardContent>
            </Card>

            {/* Scope */}
            {(quote.scope_of_work || quote.notes) && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Scope of Work</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {quote.scope_of_work || quote.notes}
                </CardContent>
              </Card>
            )}

            {/* Line items */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" /> Pricing Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {lineItems.map((item, i) => (
                    <div key={i} className="flex justify-between gap-4">
                      <span className="flex-1">{item.description} {item.quantity > 1 && `×${item.quantity}`}</span>
                      <span className="font-medium">${(item.total || item.unit_price * item.quantity || 0).toLocaleString()}</span>
                    </div>
                  ))}
                  {lineItems.length > 0 && <div className="border-t pt-2 flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>${total.toLocaleString()}</span>
                  </div>}
                </div>
              </CardContent>
            </Card>

            {/* Approval actions — only if not yet finalized */}
            {["sent", "viewed", "draft", "needs_review"].includes(quote.status) && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    className="flex-1 h-12 text-base gap-2 bg-green-600 hover:bg-green-700"
                    onClick={() => handleAction("approved")}
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Approve Quote
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-12 text-base gap-2"
                    onClick={() => handleAction("rejected")}
                    disabled={submitting}
                  >
                    <XCircle className="w-5 h-5 text-destructive" />
                    Decline
                  </Button>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Request changes instead:</label>
                  <Textarea
                    value={changeNotes}
                    onChange={e => setChangeNotes(e.target.value)}
                    placeholder="Describe what you'd like changed..."
                    rows={3}
                  />
                  <Button
                    variant="outline"
                    onClick={() => changeNotes.trim() && handleAction("changes")}
                    disabled={submitting || !changeNotes.trim()}
                    className="gap-1.5"
                  >
                    <MessageSquare className="w-4 h-4" /> Submit Change Request
                  </Button>
                </div>
              </div>
            )}

            {quote.status === "approved" && (
              <div className="flex items-center gap-2 p-4 bg-green-50 rounded-xl border border-green-200 text-green-700">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">This quote has been approved. Our team will be in touch to schedule your service.</p>
              </div>
            )}

            {disclaimer && (
              <p className="text-xs text-muted-foreground text-center">{disclaimer}</p>
            )}

            {companyPhone && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Questions? Call us: <a href={`tel:${companyPhone}`} className="font-medium text-primary">{companyPhone}</a></p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}