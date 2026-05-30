import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Minus, Send, Loader2, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const AGENT_NAME = "treepro_assistant";
const STORAGE_KEY = "treepro_chat_opened_before";

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  if (!message.content && !message.tool_calls?.length) return null;

  return (
    <div className={cn("flex gap-2 mb-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
      )}
      <div className={cn("max-w-[85%]", isUser && "flex flex-col items-end")}>
        {message.content && (
          <div className={cn(
            "rounded-2xl px-3 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          )}>
            {isUser ? (
              <p className="leading-relaxed">{message.content}</p>
            ) : (
              <ReactMarkdown
                className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5"
                components={{
                  a: ({ children, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
        {message.tool_calls?.some(tc => tc.status === "running" || tc.status === "in_progress") && (
          <div className="flex items-center gap-1.5 mt-1 px-2">
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Working on it...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AppChatbot({ user }) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);

  // Draggable position
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset from bottom-right
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-open for new users
  useEffect(() => {
    const hasOpened = localStorage.getItem(STORAGE_KEY);
    if (!hasOpened) {
      setTimeout(() => {
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, "1");
      }, 1500);
    }
  }, []);

  // Start or resume conversation
  useEffect(() => {
    if (!open || conversation) return;
    initConversation();
  }, [open]);

  const initConversation = async () => {
    setLoading(true);
    try {
      const convos = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      let convo;
      if (convos && convos.length > 0) {
        // Resume most recent
        convo = await base44.agents.getConversation(convos[0].id);
        setMessages(convo.messages || []);
      } else {
        // Create new with onboarding greeting
        convo = await base44.agents.createConversation({
          agent_name: AGENT_NAME,
          metadata: { name: "TreePro Assistant" },
        });
        // Send initial greeting trigger
        await base44.agents.addMessage(convo, {
          role: "user",
          content: "Hello! I just opened the app.",
        });
        convo = await base44.agents.getConversation(convo.id);
        setMessages(convo.messages || []);
      }
      setConversation(convo);
    } catch (e) {
      console.error("Chat init error:", e);
    }
    setLoading(false);
  };

  // Subscribe to real-time updates
  useEffect(() => {
    if (!conversation) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      if (!open || minimized) {
        const lastMsg = (data.messages || []).at(-1);
        if (lastMsg?.role === "assistant" && lastMsg.content) {
          setUnread(u => u + 1);
        }
      }
    });
    return unsub;
  }, [conversation?.id, open, minimized]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear unread when opened
  useEffect(() => {
    if (open && !minimized) setUnread(0);
  }, [open, minimized]);

  const sendMessage = async () => {
    if (!input.trim() || sending || !conversation) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: "user", content: text });
    } catch (e) {
      console.error("Send error:", e);
    }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Drag handlers
  const onMouseDown = (e) => {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    setPos({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  const isStreaming = messages.some(m =>
    m.tool_calls?.some(tc => tc.status === "running" || tc.status === "in_progress")
  );

  const visibleMessages = messages.filter(m => m.role === "user" || m.role === "assistant");

  return (
    <>
      {/* Floating toggle button */}
      {(!open || minimized) && (
        <div
          className="fixed z-50 cursor-grab active:cursor-grabbing select-none"
          style={{
            bottom: `${24 - pos.y}px`,
            right: `${24 - pos.x}px`,
          }}
          onMouseDown={onMouseDown}
        >
          <button
            onClick={(e) => {
              if (Math.abs(pos.x - dragStart.current.px) < 5 && Math.abs(pos.y - dragStart.current.py) < 5) {
                setOpen(true);
                setMinimized(false);
              }
            }}
            className="relative w-14 h-14 rounded-full bg-primary shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center"
          >
            <MessageCircle className="w-6 h-6 text-white" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Chat window */}
      {open && !minimized && (
        <div
          className="fixed z-50 flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          style={{
            bottom: `${24 - pos.y}px`,
            right: `${24 - pos.x}px`,
            width: "360px",
            height: "520px",
            maxHeight: "calc(100vh - 48px)",
            maxWidth: "calc(100vw - 48px)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground cursor-grab active:cursor-grabbing select-none shrink-0"
            onMouseDown={onMouseDown}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-none">TreePro Assistant</p>
              <p className="text-[11px] text-primary-foreground/70 mt-0.5">Always here to help</p>
            </div>
            <button
              onClick={() => setMinimized(true)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {visibleMessages.map((msg, i) => (
                  <MessageBubble key={i} message={msg} />
                ))}
                {isStreaming && (
                  <div className="flex gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">AI</span>
                    </div>
                    <div className="bg-muted rounded-2xl px-3 py-2">
                      <div className="flex gap-1 items-center h-5">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Quick prompts (shown when no messages yet) */}
          {!loading && visibleMessages.filter(m => m.role === "user").length === 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {[
                "Show me open leads",
                "Create a new lead",
                "What jobs are scheduled today?",
                "How do I create a quote?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything or give a command…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground max-h-24 leading-relaxed"
                style={{ minHeight: "38px" }}
                disabled={sending || loading}
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() || sending || loading || !conversation}
                className="h-9 w-9 shrink-0 rounded-xl"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              Powered by TreePro AI · Can create & update records
            </p>
          </div>
        </div>
      )}
    </>
  );
}