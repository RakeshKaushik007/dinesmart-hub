import { useState } from "react";
import { Bot, Send, Gauge } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const mockChat: ChatMessage[] = [
  { id: "1", role: "user", content: "How much paneer do we have in stock?", timestamp: "2026-03-14T12:00:00" },
  { id: "2", role: "assistant", content: "You currently have **12 kg** of Paneer in stock. Status: ✅ Good. It expires on **March 18, 2026**. At current usage rates (~2kg/day), this should last about 6 days.", timestamp: "2026-03-14T12:00:05" },
  { id: "3", role: "user", content: "Which items are running low?", timestamp: "2026-03-14T12:01:00" },
  { id: "4", role: "assistant", content: "Here are items below their minimum threshold:\n\n1. **Chicken Breast** — 3 kg (min: 8 kg) ⚠️\n2. **Cream** — 1.5 L (min: 3 L) ⚠️\n3. **Green Chilli** — 0.8 kg (min: 1 kg) ⚠️\n4. **Disposable Plates** — 50 pcs (min: 100 pcs) ⚠️\n\nCooking Oil is completely **out of stock** ❌", timestamp: "2026-03-14T12:01:05" },
];

const quotaInfo = {
  used: 12,
  limit: 50,
  resetDate: "2026-03-18",
};

const AIAssistantPage = () => {
  const [messages] = useState<ChatMessage[]>(mockChat);
  const [input, setInput] = useState("");

  const quotaPercent = (quotaInfo.used / quotaInfo.limit) * 100;

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

        {/* Quota Tracker */}
        <div className="rounded-xl border border-border bg-card p-4 w-full sm:w-72">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-card-foreground">Weekly Query Quota</span>
          </div>
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden mb-1.5">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${quotaPercent}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{quotaInfo.used} / {quotaInfo.limit} queries used</span>
            <span>Resets {new Date(quotaInfo.resetDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="rounded-xl border border-border bg-card flex flex-col" style={{ height: "calc(100vh - 280px)", minHeight: "400px" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about inventory, stock levels, costs..."
              className="flex-1 rounded-lg border border-input bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button className="rounded-lg bg-primary p-2.5 text-primary-foreground hover:bg-primary/90 transition-colors">
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            AI responses are based on current inventory data. {quotaInfo.limit - quotaInfo.used} queries remaining this week.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;
