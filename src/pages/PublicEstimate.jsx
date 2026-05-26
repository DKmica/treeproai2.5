import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  TreePine, Send, Upload, X, Loader2, CheckCircle2,
  Star, Shield, Phone, Mail, MapPin, ChevronRight, User
} from "lucide-react";

const AGENT_NAME = "tree_assessment";

// ── Message bubble ──────────────────────────────────────────────────────────
function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-9 h-9 rounded-xl bg-green-700 flex items-center justify-center shrink-0 mt-0.5 shadow">
          <TreePine className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={cn("max-w-[80%]", isUser && "flex flex-col items-end")}>
        {message.content && (
          <div className={cn(
            "rounded-2xl px-4 py-3 text-sm shadow-sm",
            isUser
              ? "bg-green-700 text-white"
              : "bg-white border border-gray-200 text-gray-800"
          )}>
            {isUser ? (
              <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:my-1 [&_li]:my-0.5 [&_p]:my-1 prose-headings:text-gray-900 prose-strong:text-gray-900">
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
        {message.file_urls?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.file_urls.map((url, i) => (
              <img key={i} src={url} alt={`Upload ${i + 1}`} className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm" />
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-gray-500" />
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-green-700 flex items-center justify-center shrink-0 shadow">
        <TreePine className="w-4 h-4 text-white" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

// ── Contact capture form ─────────────────────────────────────────────────────
function LeadCaptureForm({ assessmentText, onLeadCreated }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const [first_name, ...rest] = form.name.trim().split(" ");
    const last_name = rest.join(" ") || "";
    await base44.functions.invoke("ingestLead", {
      first_name,
      last_name,
      phone: form.phone,
      email: form.email,
      address: form.address,
      description: assessmentText?.slice(0, 2000) || "Online AI estimate request",
      source: "website",
      urgency: "normal",
    });
    setDone(true);
    setSubmitting(false);
    onLeadCreated?.();
  };

  if (done) {
    return (
      <div className="text-center py-8 space-y-3">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900">You're all set!</h3>
        <p className="text-gray-600 text-sm max-w-xs mx-auto">
          Our team has your assessment and will reach out shortly to schedule your free on-site visit.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-semibold text-gray-900">Get your free on-site quote</h3>
      <p className="text-sm text-gray-500">Leave your details and we'll follow up to confirm your estimate.</p>
      <Input
        required
        placeholder="Your full name *"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="bg-white border-gray-300"
      />
      <Input
        required
        type="tel"
        placeholder="Phone number *"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        className="bg-white border-gray-300"
      />
      <Input
        type="email"
        placeholder="Email address"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="bg-white border-gray-300"
      />
      <Input
        placeholder="Property address"
        value={form.address}
        onChange={(e) => setForm({ ...form, address: e.target.value })}
        className="bg-white border-gray-300"
      />
      <Button type="submit" disabled={submitting} className="w-full bg-green-700 hover:bg-green-800 text-white h-11 text-base font-semibold gap-2">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
        {submitting ? "Sending..." : "Get My Free Quote"}
      </Button>
      <p className="text-[11px] text-gray-400 text-center">No spam. We'll only contact you about your tree service.</p>
    </form>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PublicEstimate() {
  const [step, setStep] = useState("chat"); // "chat" | "capture"
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [quoteText, setQuoteText] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [leadCreated, setLeadCreated] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const conversationRef = useRef(null);

  useEffect(() => { startConversation(); }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const startConversation = async () => {
    try {
      // Ensure guest/public session exists before using agent
      const isAuthed = await base44.auth.isAuthenticated();
      if (!isAuthed) {
        // For public pages, we need to sign in as a guest
        // Show the lead capture form directly as fallback
        setMessages([{
          role: "assistant",
          content: "Welcome to Accurate Tree and Landscaping Services! 🌳\n\nTo get your free AI-powered tree assessment, please fill out the form below and one of our certified arborists will reach out to you with a detailed estimate.",
        }]);
        setIsTyping(false);
        return;
      }

      const conv = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: "Public Estimate Session" },
      });
      setConversation(conv);
      conversationRef.current = conv;

      const unsub = base44.agents.subscribeToConversation(conv.id, (data) => {
        setMessages([...data.messages]);
        const lastMsg = data.messages[data.messages.length - 1];
        if (lastMsg?.role === "assistant" && lastMsg?.content) {
          setIsTyping(false);
          const fullText = data.messages.filter((m) => m.content)
            .map((m) => `${m.role === "user" ? "Customer" : "AI Arborist"}: ${m.content}`)
            .join("\n\n");
          setQuoteText(fullText);
        }
      });

      setIsTyping(true);
      await base44.agents.addMessage(conv, {
        role: "user",
        content: "Hello, I need help assessing my tree(s) and getting a free estimate.",
      });

      return () => unsub();
    } catch (err) {
      console.error("Agent error:", err);
      setMessages([{
        role: "assistant",
        content: "Welcome to Accurate Tree and Landscaping Services! 🌳\n\nTo get your free tree service estimate, please fill out the form below and one of our certified arborists will contact you shortly.",
      }]);
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    setUploadedFiles((prev) => [...prev, ...urls]);
    setUploading(false);
    e.target.value = "";
  };

  const removeFile = (i) => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i));

  const sendMessage = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || sending || !conversation) return;
    const text = input.trim();
    const files = [...uploadedFiles];
    setInput(""); setUploadedFiles([]); setSending(true); setIsTyping(true);
    await base44.agents.addMessage(conversation, {
      role: "user",
      content: text || "Please analyze these tree images.",
      ...(files.length > 0 && { file_urls: files }),
    });
    setSending(false);
    // After a few AI responses, prompt to get quote
    const aiMsgs = messages.filter((m) => m.role === "assistant").length;
    if (aiMsgs >= 2 && step === "chat") setStep("capture");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const displayMessages = messages.filter(
    (m, i) => !(i === 0 && m.role === "user" && m.content?.includes("Hello, I need help assessing"))
  );

  const aiResponseCount = messages.filter((m) => m.role === "assistant").length;
  // Show capture form: after 2 AI responses, OR immediately if no agent session (public/unauthenticated)
  const showCapturePrompt = (aiResponseCount >= 1 && !conversation) || (aiResponseCount >= 2 && !leadCreated);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-stone-900 flex flex-col">
      {/* ── Hero Header ──────────────────────────────────── */}
      <header className="pt-8 pb-4 px-4 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
            <TreePine className="w-5 h-5 text-green-300" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Accurate Tree and Landscaping Services</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight max-w-xl mx-auto">
          Get a Free Tree Service Estimate in Minutes
        </h1>
        <p className="text-green-200 mt-2 text-base max-w-md mx-auto">
          Upload photos of your tree and our AI arborist will give you a detailed assessment and cost estimate — instantly, 24/7.
        </p>
        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-green-300">
          <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Licensed & Insured</span>
          <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-green-400 text-green-400" /> 5★ Rating</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Free On-Site Visit</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> No Obligation</span>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="flex-1 px-4 pb-8 max-w-2xl mx-auto w-full flex flex-col gap-4">

        {/* Chat Card */}
        <div className="bg-gray-50 rounded-3xl overflow-hidden shadow-2xl flex flex-col" style={{ minHeight: 480 }}>
          {/* Chat header bar */}
          <div className="bg-green-800 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
              <TreePine className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">AI Tree Arborist</p>
              <p className="text-green-300 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" /> Online now
              </p>
            </div>
            <div className="ml-auto">
              <Badge className="bg-white/10 text-green-200 text-xs border-0">Free Assessment</Badge>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{ maxHeight: 400 }}
          >
            {displayMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center">
                  <TreePine className="w-6 h-6 text-green-700" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Connecting to AI Arborist...</p>
                  <p className="text-xs text-gray-400 mt-0.5">Ready to assess your trees</p>
                </div>
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
            {displayMessages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
            {isTyping && <TypingIndicator />}
          </div>

          {/* Image preview strip */}
          {uploadedFiles.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-100 flex gap-2 flex-wrap">
              {uploadedFiles.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="w-14 h-14 object-cover rounded-lg border border-gray-300" />
                  <button onClick={() => removeFile(i)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="px-4 py-3 border-t border-gray-200 bg-white flex items-end gap-2">
            <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="shrink-0 h-10 w-10 border-gray-300"
              title="Upload tree photos"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-gray-500" />}
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your tree or upload a photo..."
              className="flex-1 border-gray-300 bg-gray-50"
              disabled={sending}
            />
            <Button
              onClick={sendMessage}
              size="icon"
              disabled={sending || uploading || (!input.trim() && uploadedFiles.length === 0)}
              className="shrink-0 h-10 w-10 bg-green-700 hover:bg-green-800"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Lead Capture Card — appears after AI has responded twice */}
        {showCapturePrompt && (
          <div className="bg-white rounded-3xl shadow-2xl p-6 border border-green-100">
            <LeadCaptureForm assessmentText={quoteText} onLeadCreated={() => setLeadCreated(true)} />
          </div>
        )}

        {/* How it works */}
        {displayMessages.length === 0 && (
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: Upload, label: "Upload Photos", desc: "Snap pics of your tree" },
              { icon: TreePine, label: "AI Analysis", desc: "Instant expert assessment" },
              { icon: CheckCircle2, label: "Get Estimate", desc: "Detailed cost breakdown" },
            ].map(({ icon: ItemIcon, label, desc }) => (
              <div key={label} className="bg-white/10 backdrop-blur rounded-2xl p-4 text-white">
                <ItemIcon className="w-6 h-6 mx-auto mb-2 text-green-300" />
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-green-300 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="pb-6 text-center text-green-400/60 text-xs space-y-1">
        <p>© 2025 Accurate Tree and Landscaping Services · Licensed & Insured</p>
        <p>This is a preliminary AI estimate. A certified arborist will provide your final quote on-site.</p>
        <p className="mt-2 text-green-400/40 flex items-center justify-center gap-1">
          <TreePine className="w-3 h-3" /> Powered by TreePro AI
        </p>
      </footer>
    </div>
  );
}