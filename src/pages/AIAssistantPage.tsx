import { useState, useRef, useEffect } from "react";
import { Bot, Send, Gauge, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const STORAGE_KEY = "blennix-ai-quota";
const WEEKLY_LIMIT = 50;

const loadQuota = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { used: 0, weekStart: new Date().toISOString() };
    const parsed = JSON.parse(raw) as { used: number; weekStart: string };
    const ageDays = (Date.now() - new Date(parsed.weekStart).getTime()) / 86_400_000;
    if (ageDays >= 7) return { used: 0, weekStart: new Date().toISOString() };
    return parsed;
  } catch {
    return { used: 0, weekStart: new Date().toISOString() };
  }
};

const AIAssistantPage = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I can answer questions about your live inventory — stock levels, low items, expiries, costs. What would you like to know?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState(loadQuota);
  const scrollRef = useRef<HTMLDivElement>(null);

  const resetDate = new Date(new Date(quota.weekStart).getTime() + 7 * 86_400_000).toISOString();
  const quotaPercent = (quota.used / WEEKLY_LIMIT) * 100;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (quota.used >= WEEKLY_LIMIT) {
      toast.error("Weekly quota reached. Resets soon.");
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { messages: history },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Request failed");

      const reply: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply || "(no response)",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, reply]);

      const next = { ...quota, used: quota.used + 1 };
      setQuota(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to reach AI";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Assistant</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Ask questions about your inventory</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 w-full sm:w-72">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-card-foreground">Weekly Query Quota</span>
          </div>
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden mb-1.5">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, quotaPercent)}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{quota.used} / {WEEKLY_LIMIT} queries used</span>
            <span>Resets {new Date(resetDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] sm:max-w-[70%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-[10px] mt-1.5 opacity-60 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-3 bg-secondary text-secondary-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking…</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              disabled={loading}
              placeholder="Ask about inventory, stock levels, costs..."
              className="flex-1 rounded-lg border border-input bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="rounded-lg bg-primary p-2.5 text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            Powered by Lovable AI · grounded on your live inventory · {Math.max(0, WEEKLY_LIMIT - quota.used)} queries remaining
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;
