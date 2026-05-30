import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle2, Loader2, Pen, Send, Phone, MessageSquare,
  DollarSign, FileText, Sparkles, Shield
} from "lucide-react";
import { convertQuoteToJob, logActivity, logAudit, createNotification, createPortalLink } from "@/lib/treeproWorkflow";

export default function SalesQuotePresentation({ quote, lead, lineItems, total, aiRecord, onBack, onApproved, user }) {
  const [screen, setScreen] = useState("view"); // view | signature | approved
  const [signing, setSigning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [customerSignature, setCustomerSignature] = useState("");
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [lastPos, setLastPos] = useState(null);
  const [depositAmount, setDepositAmount] = useState(0);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setDrawing(true);
    setLastPos(getPos(e, canvasRef.current));
  };

  const draw = (e) => {
    if (!drawing || !canvasRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();
    setLastPos(pos);
  };

  const endDraw = () => {
    setDrawing(false);
    const sig = canvasRef.current?.toDataURL("image/png");
    setCustomerSignature(sig);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setCustomerSignature("");
  };

  const handleApprove = async () => {
    if (!customerSignature) { toast.error("Please collect customer signature"); return; }
    setApproving(true);

    await base44.entities.Quote.update(quote.id, {
      status: "approved",
      approved_at: new Date().toISOString(),
    });

    await logActivity({
      relatedType: "Quote", relatedId: quote.id,
      actor: user?.full_name || "salesperson",
      action: "Quote approved on-site by customer",
      notes: `${lead.first_name} ${lead.last_name} · $${total.toLocaleString()}`,
    });

    await logAudit({
      actorName: user?.full_name || "salesperson",
      action: "quote_approved_on_site",
      entityType: "Quote", entityId: quote.id,
      newValue: { status: "approved", customer: `${lead.first_name} ${lead.last_name}`, total }
    });

    await createNotification({
      type: "quote_approved",
      title: `Quote approved: ${lead.first_name} ${lead.last_name}`,
      message: `Quote #${quote.quote_number} approved on-site · $${total.toLocaleString()}`,
      relatedType: "Quote", relatedId: quote.id,
    });

    // Convert to job
    await convertQuoteToJob(
      { ...quote, status: "approved", total_amount: total, lead_id: lead.id },
      null,
      user?.full_name || "salesperson"
    );

    await base44.entities.Lead.update(lead.id, { status: "won" }).catch(() => {});

    setApproving(false);
    setScreen("approved");
    toast.success("🎉 Deal closed! Job created!");
  };

  const handleSendByText = () => {
    if (!lead.phone) { toast.error("No phone on file"); return; }
    const msg = `Hi ${lead.first_name}! Your tree service quote is ready. Total: $${total.toLocaleString()}. I'll email it to you shortly. Questions? Just reply here!`;
    window.location.href = `sms:${lead.phone}?body=${encodeURIComponent(msg)}`;
  };

  const handleSendByEmail = () => {
    if (!lead.email) { toast.error("No email on file"); return; }
    const subject = `Tree Service Quote #${quote.quote_number} - $${total.toLocaleString()}`;
    const body = `Hi ${lead.first_name},\n\nThank you for the opportunity to provide a quote for your tree service needs.\n\nQuote #${quote.quote_number}\n\n${lineItems.map(i => `${i.description}: $${(i.total || 0).toLocaleString()}`).join("\n")}\n\nTotal: $${total.toLocaleString()}\n\nPlease don't hesitate to reach out with any questions.\n\nBest regards,\n${user?.full_name || "Your Tree Service Team"}`;
    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (screen === "approved") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-green-700">Deal Closed! 🎉</h2>
        <p className="text-muted-foreground">Quote approved and job created. The office will schedule it.</p>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 w-full">
          <p className="font-semibold text-green-800">{lead.first_name} {lead.last_name}</p>
          <p className="text-2xl font-bold text-green-700 mt-1">${total.toLocaleString()}</p>
          <p className="text-xs text-green-600 mt-1">Quote #{quote.quote_number}</p>
        </div>
        <Button className="w-full h-12" onClick={onApproved}>Back to Lead</Button>
      </div>
    );
  }

  if (screen === "signature") {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <div className="flex items-center gap-3 p-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => setScreen("view")}><ArrowLeft className="w-5 h-5" /></Button>
          <h2 className="font-bold">Customer Approval</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm">
            <p className="font-semibold">{lead.first_name} {lead.last_name}</p>
            <p className="text-muted-foreground mt-0.5">{lead.address}</p>
            <div className="border-t mt-2 pt-2 space-y-1">
              {lineItems.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>{item.description}</span>
                  <span className="font-medium">${(item.total || 0).toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-base border-t pt-1.5 mt-1">
                <span>Total</span>
                <span className="text-primary">${total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Customer Signature</p>
            <p className="text-xs text-muted-foreground mb-2">Sign in the box below to approve this estimate</p>
            <div className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={350}
                height={140}
                className="w-full touch-none cursor-crosshair"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
            </div>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground mt-1" onClick={clearCanvas}>Clear</Button>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Deposit Amount (optional)</p>
            <Input
              type="number"
              placeholder="e.g. 500"
              value={depositAmount || ""}
              onChange={e => setDepositAmount(parseFloat(e.target.value) || 0)}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">Payment collected on-site or send a payment link later</p>
          </div>

          <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground">
            <p>By signing above, customer agrees to the scope of work and pricing outlined in this estimate. Final price may vary based on site conditions discovered during the job.</p>
          </div>
        </div>
        <div className="p-4 border-t">
          <Button
            className="w-full h-12 text-base gap-2"
            disabled={approving || !customerSignature}
            onClick={handleApprove}
          >
            {approving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            Approve & Create Job
          </Button>
        </div>
      </div>
    );
  }

  // Main view — customer-facing presentation
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-white sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h2 className="font-bold text-lg">Your Estimate</h2>
          <p className="text-xs text-muted-foreground">Quote #{quote.quote_number}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">
        {/* Customer greeting */}
        <div className="text-center py-2">
          <p className="text-xl font-semibold">{lead.first_name}, here's your estimate</p>
          <p className="text-muted-foreground text-sm mt-1">{lead.address}</p>
        </div>

        {/* Photos from assessment */}
        {aiRecord?.image_urls?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {aiRecord.image_urls.slice(0, 6).map((url, i) => (
              <img key={i} src={url} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0" />
            ))}
          </div>
        )}

        {/* Scope */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Scope of Work</p>
            <div className="space-y-1.5">
              {lineItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    <span>{item.description}</span>
                  </div>
                  <span className="font-semibold">${(item.total || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-bold text-xl pt-2 border-t">
              <span>Total Investment</span>
              <span className="text-primary">${total.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Trust signals */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl p-3">
            <Shield className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-green-800 font-medium">Licensed & Insured</span>
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-blue-800 font-medium">Satisfaction Guaranteed</span>
          </div>
        </div>

        {/* Send options */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-11 gap-1.5 text-sm" onClick={handleSendByText}>
            <MessageSquare className="w-4 h-4" /> Text
          </Button>
          <Button variant="outline" className="flex-1 h-11 gap-1.5 text-sm" onClick={handleSendByEmail}>
            <Send className="w-4 h-4" /> Email
          </Button>
        </div>
      </div>

      {/* Approve CTA */}
      <div className="p-4 border-t bg-white space-y-2">
        <Button
          className="w-full h-14 text-lg gap-2 bg-green-600 hover:bg-green-700"
          onClick={() => setScreen("signature")}
        >
          <Pen className="w-5 h-5" /> Approve & Sign
        </Button>
        <p className="text-xs text-center text-muted-foreground">Customer approves on your device — no app needed</p>
      </div>
    </div>
  );
}