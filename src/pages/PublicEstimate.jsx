import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  TreePine, Send, Upload, X, Loader2, CheckCircle2,
  Star, Shield, User, AlertCircle
} from "lucide-react";

const MAX_PHOTOS = 10;
const MAX_FILE_MB = 10;
const MAX_MESSAGES = 20;

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

function LeadCaptureForm({ assessmentText, photoUrls, onLeadCreated, company, structuredAssessment }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.phone.trim()) e.phone = "Phone is required";
    if (form.phone && !/^[\d\s\-\+\(\)\.]{7,}$/.test(form.phone)) e.phone = "Enter a valid phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setSubmitting(true);

    const [first_name, ...rest] = form.name.trim().split(" ");
    const last_name = rest.join(" ") || "";

    // Create lead via ingestLead function
    const leadRes = await base44.functions.invoke("ingestLead", {
      first_name, last_name,
      phone: form.phone,
      email: form.email,
      address: form.address,
      description: assessmentText?.slice(0, 2000) || "Online AI estimate request",
      source: "website",
      urgency: "normal",
    });

    const leadId = leadRes.data?.lead_id;

    // Find or create customer
    let customerId = null;
    try {
      const existing = await base44.entities.Customer.filter({ email: form.email });
      if (existing.length > 0) {
        customerId = existing[0].id;
      } else {
        const cust = await base44.entities.Customer.create({
          first_name, last_name,
          email: form.email,
          phone: form.phone,
          address: form.address,
          notes: "Created from public estimate form",
        });
        customerId = cust.id;
      }
    } catch (_) { /* proceed without customer link */ }

    // Create AIAnalysisRecord with structured data if available
    if (leadId || customerId) {
      try {
        await base44.entities.AIAnalysisRecord.create({
          lead_id: leadId || "",
          customer_id: customerId || "",
          image_urls: photoUrls || [],
          original_customer_notes: assessmentText?.slice(0, 3000) || "",
          human_review_status: "pending",
          ...(structuredAssessment || {}),
        });
        await base44.entities.ActivityLog.create({
          related_type: "Lead",
          related_id: leadId || "",
          actor: "customer",
          action: "AI assessment completed via public estimate",
          notes: `${form.name} · ${form.phone}`,
        });
      } catch (_) { /* non-blocking */ }
    }

    // Create notification
    try {
      await base44.entities.Notification.create({
        type: "new_lead",
        title: `New estimate request from ${form.name}`,
        message: `Phone: ${form.phone}${form.address ? ` · ${form.address}` : ""}`,
        read: false,
      });
    } catch (_) { /* non-blocking */ }

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
      <div>
        <Input
          required
          placeholder="Your full name *"
          value={form.name}
          onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors(p => ({ ...p, name: "" })); }}
          className={cn("bg-white border-gray-300", errors.name && "border-red-400")}
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>
      <div>
        <Input
          required
          type="tel"
          placeholder="Phone number *"
          value={form.phone}
          onChange={(e) => { setForm({ ...form, phone: e.target.value }); setErrors(p => ({ ...p, phone: "" })); }}
          className={cn("bg-white border-gray-300", errors.phone && "border-red-400")}
        />
        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
      </div>
      <div>
        <Input
          type="email"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors(p => ({ ...p, email: "" })); }}
          className={cn("bg-white border-gray-300", errors.email && "border-red-400")}
        />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
      </div>
      <Input
        placeholder="Property address"
        value={form.address}
        onChange={(e) => setForm({ ...form, address: e.target.value })}
        className="bg-white border-gray-300"
      />
      {/* Honeypot — hidden from real users */}
      <input type="text" name="website_url" className="hidden" tabIndex={-1} autoComplete="off" />
      <Button type="submit" disabled={submitting} className="w-full bg-green-700 hover:bg-green-800 text-white h-11 text-base font-semibold gap-2">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {submitting ? "Sending..." : "Get My Free Quote →"}
      </Button>
      <p className="text-[11px] text-gray-400 text-center">No spam. We'll only contact you about your tree service.</p>
    </form>
  );
}

export default function PublicEstimate() {
  const [messages, setMessages] = useState([]);
  const [quoteText, setQuoteText] = useState("");
  const [structuredAssessment, setStructuredAssessment] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [leadCreated, setLeadCreated] = useState(false);
  const [company, setCompany] = useState(null);
  const [allPhotoUrls, setAllPhotoUrls] = useState([]);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // Rate limiting: track message timestamps
  const msgTimestamps = useRef([]);

  useEffect(() => {
    const loadSettings = async () => {
      const arr = await base44.entities.CompanySettings.list();
      if (arr[0]) {
        setCompany(arr[0]);
        const serviceArea = arr[0].service_area_description || "your area";
        const initialMsg = `Hello, I need help assessing my tree(s) and getting a free estimate. We're located in ${serviceArea}.`;
        sendToAI(initialMsg, [], []);
      } else {
        sendToAI("Hello, I need help assessing my tree(s) and getting a free estimate.", [], []);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const sendToAI = async (userText, currentMessages, imageUrls) => {
    setSending(true);
    const response = await base44.functions.invoke("publicTreeChat", {
      messages: currentMessages,
      image_urls: imageUrls,
    });
    const reply = response.data?.reply || "I'm sorry, I had trouble processing that. Please try again.";
    // Store latest structured assessment if returned
    if (response.data?.structured_assessment) {
      setStructuredAssessment(response.data.structured_assessment);
    }
    const aiMessage = { role: "assistant", content: reply };
    const updated = [...currentMessages, aiMessage];
    setMessages(updated);
    setQuoteText(updated.filter(m => m.content).map(m => `${m.role === 'user' ? 'Customer' : 'AI Arborist'}: ${m.content}`).join('\n\n'));
    setSending(false);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadError("");

    const maxPhotos = company?.max_upload_photos || MAX_PHOTOS;
    const maxMb = company?.max_photo_size_mb || MAX_FILE_MB;

    if (uploadedFiles.length + files.length > maxPhotos) {
      setUploadError(`Maximum ${maxPhotos} photos allowed.`);
      e.target.value = "";
      return;
    }

    const invalid = files.find(f => !f.type.startsWith("image/"));
    if (invalid) { setUploadError("Only image files are allowed (JPG, PNG, etc.)"); e.target.value = ""; return; }

    const tooBig = files.find(f => f.size > maxMb * 1024 * 1024);
    if (tooBig) { setUploadError(`Each photo must be under ${maxMb}MB.`); e.target.value = ""; return; }

    setUploading(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    setUploadedFiles((prev) => [...prev, ...urls]);
    setAllPhotoUrls((prev) => [...prev, ...urls]);
    setUploading(false);
    e.target.value = "";
  };

  const removeFile = (i) => setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i));

  const sendMessage = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || sending) return;

    // Max messages guard
    const userMsgs = messages.filter(m => m.role === "user").length;
    if (userMsgs >= MAX_MESSAGES) {
      setInput("");
      return;
    }

    // Client-side rate limiting: max 3 messages in 10 seconds
    const now = Date.now();
    msgTimestamps.current = msgTimestamps.current.filter(t => now - t < 10000);
    if (msgTimestamps.current.length >= 3) {
      setUploadError("Please wait a moment before sending another message.");
      return;
    }
    msgTimestamps.current.push(now);
    setUploadError("");

    // Basic spam detection
    const spam = /\b(buy now|click here|free money|winner|prize|casino|viagra|xxx)\b/i.test(input);
    if (spam) { setInput(""); return; }

    const text = input.trim().slice(0, 2000);
    const files = [...uploadedFiles];
    setInput("");
    setUploadedFiles([]);

    const userMessage = { role: "user", content: text || "Please analyze these tree photos.", ...(files.length > 0 && { file_urls: files }) };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    await sendToAI(text, updatedMessages, files);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const displayMessages = messages.filter(
    (m, i) => !(i === 0 && m.role === "user" && m.content?.includes("Hello, I need help assessing"))
  );

  const aiResponseCount = messages.filter((m) => m.role === "assistant").length;
  const showCapturePrompt = aiResponseCount >= 2 && !leadCreated;
  const companyName = company?.company_name || "Professional Tree Service";
  const disclaimer = company?.public_estimate_disclaimer || "This is a preliminary AI estimate. A certified arborist will provide your final quote on-site.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-green-900 to-stone-900 flex flex-col">
      <header className="pt-8 pb-4 px-4 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
            {company?.logo_url
              ? <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain rounded-xl" />
              : <TreePine className="w-5 h-5 text-green-300" />
            }
          </div>
          <span className="text-white font-bold text-xl tracking-tight">{companyName}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight max-w-xl mx-auto">
          Get a Free Tree Service Estimate
        </h1>
        <p className="text-green-200 mt-2 text-base max-w-md mx-auto">
          Upload photos of your tree and our AI arborist will give you a detailed assessment and cost estimate — instantly, 24/7.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-green-300">
          <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Licensed & Insured</span>
          <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-green-400 text-green-400" /> 5★ Rating</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Free On-Site Visit</span>
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> No Obligation</span>
        </div>
      </header>

      <main className="flex-1 px-4 pb-8 max-w-2xl mx-auto w-full flex flex-col gap-4">
        <div className="bg-gray-50 rounded-3xl overflow-hidden shadow-2xl flex flex-col" style={{ minHeight: 480 }}>
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

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4" style={{ maxHeight: 400 }}>
            {displayMessages.length === 0 && sending && (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center">
                  <TreePine className="w-6 h-6 text-green-700" />
                </div>
                <p className="text-sm font-medium text-gray-700">Connecting to AI Arborist...</p>
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
            {displayMessages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
            {sending && <TypingIndicator />}
          </div>

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

          {uploadError && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {uploadError}
            </div>
          )}

          <div className="px-4 py-3 border-t border-gray-200 bg-white flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || uploadedFiles.length >= (company?.max_upload_photos || MAX_PHOTOS)}
              className="shrink-0 h-10 w-10 border-gray-300"
              title="Upload tree photos"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-gray-500" />}
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 2000))}
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

        {showCapturePrompt && (
          <div className="bg-white rounded-3xl shadow-2xl p-6 border border-green-100">
            <LeadCaptureForm
              assessmentText={quoteText}
              photoUrls={allPhotoUrls}
              onLeadCreated={() => setLeadCreated(true)}
              company={company}
              structuredAssessment={structuredAssessment}
            />
          </div>
        )}

        {displayMessages.length === 0 && (
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: Upload, label: "Upload Photos", desc: "Snap pics of your tree" },
              { icon: TreePine, label: "AI Analysis", desc: "Instant expert assessment" },
              { icon: CheckCircle2, label: "Get Estimate", desc: "Detailed cost breakdown" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-white/10 backdrop-blur rounded-2xl p-4 text-white">
                <Icon className="w-6 h-6 mx-auto mb-2 text-green-300" />
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-green-300 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="pb-6 text-center text-green-400/60 text-xs space-y-1 px-4">
        <p>© {new Date().getFullYear()} {companyName} · Licensed & Insured</p>
        <p className="max-w-md mx-auto">{disclaimer}</p>
        <p className="mt-2 text-green-400/40 flex items-center justify-center gap-1">
          <TreePine className="w-3 h-3" /> Powered by TreePro AI
        </p>
      </footer>
    </div>
  );
}