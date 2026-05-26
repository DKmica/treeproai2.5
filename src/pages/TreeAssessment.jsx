import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TreePine, Send, Upload, X, Loader2, Plus, Bot, User, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const AGENT_NAME = "tree_assessment";

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 mb-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-0.5">
          <TreePine className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
      <div className={cn("max-w-[80%]", isUser && "flex flex-col items-end")}>
        {message.content && (
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-sm",
              isUser
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border"
            )}
          >
            {isUser ? (
              <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown
                className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1"
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
        {message.file_urls?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.file_urls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`Uploaded ${i + 1}`}
                className="w-24 h-24 object-cover rounded-lg border border-border"
              />
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
        <TreePine className="w-4 h-4 text-primary-foreground" />
      </div>
      <div className="bg-card border border-border rounded-2xl px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

export default function TreeAssessment() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [quoteText, setQuoteText] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const conversationRef = useRef(null);

  useEffect(() => {
    startConversation();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const startConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: AGENT_NAME,
      metadata: { name: "Tree Assessment Session" },
    });
    setConversation(conv);
    conversationRef.current = conv;

    const unsub = base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages([...data.messages]);
      const lastMsg = data.messages[data.messages.length - 1];
      if (lastMsg?.role === "assistant" && lastMsg?.content) {
        setIsTyping(false);
        // Build combined text for quote generation
        const fullText = data.messages
          .filter((m) => m.content)
          .map((m) => `${m.role === "user" ? "Customer" : "AI Arborist"}: ${m.content}`)
          .join("\n\n");
        setQuoteText(fullText);
      }
    });

    // Send initial greeting trigger
    setIsTyping(true);
    await base44.agents.addMessage(conv, {
      role: "user",
      content: "Hello, I need help assessing my tree(s) and getting a quote.",
    });

    return () => unsub();
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

  const removeFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || sending || !conversation) return;

    const text = input.trim();
    const files = [...uploadedFiles];

    setInput("");
    setUploadedFiles([]);
    setSending(true);
    setIsTyping(true);

    await base44.agents.addMessage(conversation, {
      role: "user",
      content: text || "Please analyze these tree images.",
      ...(files.length > 0 && { file_urls: files }),
    });

    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetConversation = () => {
    setConversation(null);
    setMessages([]);
    setInput("");
    setUploadedFiles([]);
    setIsTyping(false);
    startConversation();
  };

  const displayMessages = messages.filter(
    (m, i) => !(i === 0 && m.role === "user" && m.content === "Hello, I need help assessing my tree(s) and getting a quote.")
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[800px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TreePine className="w-6 h-6 text-primary" />
            AI Tree Assessment
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload tree photos for AI-powered analysis and instant quote estimates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
            AI Online
          </Badge>
          {quoteText && (
            <Link
              to="/quotes"
              state={{ autoOpenAssessment: true, assessmentText: quoteText }}
              className="inline-flex"
            >
              <Button size="sm" className="gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Generate Quote
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={resetConversation} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            New Session
          </Button>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* Info Banner */}
        <div className="px-4 py-2.5 bg-primary/5 border-b border-border flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>Upload multiple tree photos for the most accurate AI assessment — including angles showing height, trunk, and proximity to structures.</span>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
          <div ref={scrollRef} className="overflow-y-auto h-full px-1">
            {displayMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <TreePine className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Starting your assessment session...</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Our AI arborist will be right with you.</p>
                </div>
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {displayMessages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}

            {isTyping && <TypingIndicator />}
          </div>
        </ScrollArea>

        {/* Image Preview */}
        {uploadedFiles.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-muted/30 flex gap-2 flex-wrap">
            {uploadedFiles.map((url, i) => (
              <div key={i} className="relative group">
                <img src={url} alt={`Upload ${i + 1}`} className="w-14 h-14 object-cover rounded-lg border border-border" />
                <button
                  onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="px-4 py-3 border-t border-border flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 h-9 w-9"
            title="Upload tree photos"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          </Button>

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your tree or ask a question..."
            className="flex-1"
            disabled={sending}
          />

          <Button
            onClick={sendMessage}
            size="icon"
            disabled={sending || uploading || (!input.trim() && uploadedFiles.length === 0)}
            className="shrink-0 h-9 w-9"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}