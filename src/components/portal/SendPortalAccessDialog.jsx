import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, CheckCircle2, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { addDays } from "date-fns";

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function SendPortalAccessDialog({ customer, open, onOpenChange }) {
  const [pin, setPin] = useState(() => generatePin());
  const [expiryDays, setExpiryDays] = useState(90);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // { pin, link }

  const portalUrl = `${window.location.origin}/customer-portal`;

  const handleCreate = async () => {
    if (!customer?.email) {
      toast.error("Customer must have an email address.");
      return;
    }
    setSaving(true);
    try {
      // Expire any existing customer_dashboard sessions for this customer
      const existing = await base44.entities.CustomerPortalSession.filter({
        customer_id: customer.id,
        portal_type: "customer_dashboard",
        status: "active",
      });
      for (const s of existing) {
        await base44.entities.CustomerPortalSession.update(s.id, { status: "expired" });
      }

      const expiresAt = addDays(new Date(), expiryDays).toISOString();
      await base44.entities.CustomerPortalSession.create({
        customer_id: customer.id,
        portal_email: customer.email.toLowerCase().trim(),
        portal_pin: pin,
        portal_pin_expires_at: expiresAt,
        portal_type: "customer_dashboard",
        status: "active",
        token: `cdp_${customer.id}_${Date.now()}`,
      });

      await base44.entities.ActivityLog.create({
        related_type: "Customer",
        related_id: customer.id,
        actor: "admin",
        action: `Customer portal access created — expires in ${expiryDays} days`,
      });

      setCreated({ pin, link: portalUrl });
      toast.success("Portal access created!");
    } catch (e) {
      toast.error("Failed to create portal access. Please try again.");
    }
    setSaving(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleReset = () => {
    setCreated(null);
    setPin(generatePin());
  };

  const instructions = created
    ? `Hi ${customer?.first_name || "there"},\n\nYou can now access your account portal at:\n${created.link}\n\nYour access PIN is: ${created.pin}\n\nYou can view your jobs, invoices, and site photos there.\n\nQuestions? Call us anytime.`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Portal Access</DialogTitle>
        </DialogHeader>

        {!created ? (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium">{customer?.first_name} {customer?.last_name}</p>
              <p className="text-muted-foreground">{customer?.email || <span className="text-destructive">No email — required for portal login</span>}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Access PIN</label>
              <div className="flex gap-2">
                <Input
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  className="font-mono text-lg tracking-widest"
                />
                <Button variant="outline" size="icon" onClick={() => setPin(generatePin())} title="Regenerate PIN">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Customer will use this PIN with their email to log in.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Access expires in</label>
              <div className="flex gap-2">
                {[30, 90, 365].map(d => (
                  <Button
                    key={d}
                    size="sm"
                    variant={expiryDays === d ? "default" : "outline"}
                    onClick={() => setExpiryDays(d)}
                  >
                    {d === 365 ? "1 year" : `${d} days`}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={saving || !customer?.email || pin.length !== 6}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Access
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">Portal access created!</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Portal URL</label>
                <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => copyToClipboard(created.link)}>
                  <Copy className="w-3 h-3" /> Copy
                </Button>
              </div>
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <code className="text-xs flex-1 truncate">{created.link}</code>
                <Button asChild variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                  <a href={created.link} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Access PIN</label>
                <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => copyToClipboard(created.pin)}>
                  <Copy className="w-3 h-3" /> Copy
                </Button>
              </div>
              <div className="bg-muted rounded-lg px-3 py-3 text-center">
                <span className="text-2xl font-mono font-bold tracking-[0.3em]">{created.pin}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Ready-to-send message</label>
                <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => copyToClipboard(instructions)}>
                  <Copy className="w-3 h-3" /> Copy All
                </Button>
              </div>
              <textarea
                readOnly
                value={instructions}
                rows={8}
                className="w-full text-xs bg-muted rounded-lg p-3 border-0 resize-none outline-none font-mono"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Integration required: Email/SMS provider must be connected to send this automatically. Copy and send manually for now.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleReset}>Create New Access</Button>
              <Button className="flex-1" onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}