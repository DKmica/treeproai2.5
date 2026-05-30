import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Loader2, MessageSquare, Copy, CheckCircle2 } from "lucide-react";

const OBJECTIONS = [
  { key: "too_expensive", label: "Too Expensive", emoji: "💰" },
  { key: "spouse", label: "Need to Talk to Spouse", emoji: "👫" },
  { key: "cheaper_quote", label: "Got a Cheaper Quote", emoji: "📋" },
  { key: "insurance", label: "Need Insurance Approval", emoji: "📄" },
  { key: "not_ready", label: "Not Ready Yet", emoji: "⏰" },
  { key: "wants_discount", label: "Wants a Discount", emoji: "🏷️" },
];

const STATIC_RESPONSES = {
  too_expensive: [
    "I completely understand — tree work is a real investment. Let me walk you through exactly what's included so you can see the value. We're fully licensed and insured, use professional-grade equipment, and leave your property spotless. The cost of NOT doing it — property damage, liability, emergency removal — is usually far higher.",
    "I hear you. Can I ask what budget you had in mind? I can adjust the scope to fit your situation, whether that's starting with the most critical work now and phasing the rest, or removing the full-cleanup and handling just the tree.",
  ],
  spouse: [
    "Totally makes sense — it's a big decision. I can email or text both of you the quote right now so you can review it together tonight. I'll also include photos from today's assessment. Would tomorrow morning work to follow up?",
    "Of course! Here's what I'll do — I'll send you the written estimate with photos so you both have all the details. My number's on it if your spouse has any questions. These jobs do book out, so if you're leaning toward it, even a small deposit holds your spot on the schedule.",
  ],
  cheaper_quote: [
    "I appreciate you being upfront about that. Can I ask — was it a written quote or a verbal ballpark? A lot of low quotes don't include insurance, cleanup, or stump removal. When you compare apples to apples, our pricing is usually in line or better for what's included.",
    "Fair enough. Here's my honest take: if the other company is licensed, insured, and has solid reviews — it might genuinely be a better deal, and I'd encourage you to go with them. But if it's an unlicensed crew with no insurance and a handshake deal, any damage to your home comes out of your pocket. That's a real risk with tree work.",
  ],
  insurance: [
    "Absolutely, and storm damage claims are very common — happy to help. I can provide you with a detailed written estimate on company letterhead that your adjuster will accept. In fact, I can help document the storm damage right now with photos and a professional assessment.",
    "No problem at all. Get me your adjuster's info and I can work directly with them on the documentation. We do insurance jobs regularly and know exactly what they need. This keeps it simple for you.",
  ],
  not_ready: [
    "That's completely fine — I never want to pressure anyone. What would need to change for you to be ready? Is it timing, budget, or just needing more time to think? I want to make sure you have everything you need to make the right call.",
    "I understand. Just so you know, we're booking out a few weeks right now, and emergency removal prices go up significantly. Would it make sense to at least hold a spot on the schedule with a small deposit while you decide? No pressure — just want to make sure you have options.",
  ],
  wants_discount: [
    "I wish I could do more — I really do. Our pricing reflects our full insurance, professional crew, and equipment costs. What I can do is adjust the scope if that helps. For example, we could skip the stump grinding today and come back for that separately, which brings the price down.",
    "Here's what I can offer: if you sign today, I'll include the full site cleanup at no extra charge — that's normally $200-300 extra. I can't go lower on the actual removal, but I can make sure you get the best value for what you're spending.",
  ],
};

export default function SalesCloseAssist({ lead, quotes = [], onBack, user }) {
  const [selectedObjection, setSelectedObjection] = useState(null);
  const [aiResponse, setAiResponse] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const latestQuote = quotes.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];

  const getAIResponse = async (objectionKey) => {
    setLoadingAi(true);
    setAiResponse(null);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an experienced tree service salesperson coach helping a salesman close a deal in the field.

Customer: ${lead.first_name} ${lead.last_name}
Job: ${lead.description || "Tree service"}
${latestQuote ? `Quote total: $${latestQuote.total_amount?.toLocaleString()}` : ""}
Objection: ${OBJECTIONS.find(o => o.key === objectionKey)?.label || objectionKey}

Write 1 specific, professional, empathetic response the salesperson can say RIGHT NOW (not generic advice). 
Keep it conversational, honest, field-friendly, and under 80 words. Use the customer's first name (${lead.first_name}).
Sound like a trustworthy professional, not a pushy salesperson.`,
      response_json_schema: {
        type: "object",
        properties: { response: { type: "string" } }
      }
    });
    setAiResponse(result.response);
    setLoadingAi(false);
  };

  const handleSelectObjection = (key) => {
    setSelectedObjection(key);
    setAiResponse(null);
    getAIResponse(key);
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      toast.success("Copied!");
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  };

  const textResponse = (text) => {
    if (!lead.phone) { toast.error("No phone number"); return; }
    window.location.href = `sms:${lead.phone}?body=${encodeURIComponent(text)}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex items-center gap-3 p-4 border-b sticky top-0 bg-background z-10">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h2 className="font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" /> Help Me Close This
          </h2>
          <p className="text-xs text-muted-foreground">{lead.first_name} {lead.last_name}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">
        <p className="text-sm text-muted-foreground">What objection are you facing?</p>

        <div className="grid grid-cols-2 gap-2">
          {OBJECTIONS.map(obj => (
            <button
              key={obj.key}
              onClick={() => handleSelectObjection(obj.key)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${selectedObjection === obj.key ? "border-purple-400 bg-purple-50" : "border-border hover:border-purple-200"}`}
            >
              <span className="text-lg">{obj.emoji}</span>
              <p className="text-xs font-medium mt-1 leading-tight">{obj.label}</p>
            </button>
          ))}
        </div>

        {selectedObjection && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-purple-700">
              <Sparkles className="w-4 h-4" />
              AI Response for: {OBJECTIONS.find(o => o.key === selectedObjection)?.label}
            </div>

            {loadingAi ? (
              <div className="flex items-center gap-2 p-4 bg-purple-50 rounded-xl text-purple-700">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating personalized response...</span>
              </div>
            ) : aiResponse ? (
              <Card className="border-purple-200 bg-purple-50">
                <CardContent className="p-4 space-y-3">
                  <Badge className="bg-purple-100 text-purple-700 text-xs gap-1">
                    <Sparkles className="w-3 h-3" /> AI Personalized
                  </Badge>
                  <p className="text-sm leading-relaxed">{aiResponse}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-9 text-xs gap-1.5"
                      onClick={() => copyToClipboard(aiResponse, "ai")}
                    >
                      {copiedIdx === "ai" ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-9 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700"
                      onClick={() => textResponse(aiResponse)}
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Text Customer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Static scripted responses */}
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scripted Responses</p>
            {(STATIC_RESPONSES[selectedObjection] || []).map((response, idx) => (
              <Card key={idx}>
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm leading-relaxed text-muted-foreground">{response}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs gap-1"
                      onClick={() => copyToClipboard(response, idx)}
                    >
                      {copiedIdx === idx ? "Copied!" : <><Copy className="w-3 h-3" /> Copy</>}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs gap-1"
                      onClick={() => textResponse(response)}
                    >
                      <MessageSquare className="w-3 h-3" /> Text
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}