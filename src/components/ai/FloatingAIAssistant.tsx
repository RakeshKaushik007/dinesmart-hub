import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bot, X, Minimize2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFloatingAISetting } from "@/hooks/useFloatingAISetting";
import AIAssistantChat from "./AIAssistantChat";

/**
 * Floating chat launcher visible to owner+ accounts on every protected page,
 * unless a super admin has globally disabled it. Hidden on the dedicated
 * /ai-assistant page to avoid duplication.
 */
const FloatingAIAssistant = () => {
  const { user, loading: authLoading, isAtLeast } = useAuth();
  const { enabled, loading: settingLoading } = useFloatingAISetting();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close panel when navigating between pages.
  useEffect(() => { setOpen(false); }, [location.pathname]);

  if (authLoading || settingLoading) return null;
  if (!user) return null;
  if (!enabled) return null;
  if (!isAtLeast("owner")) return null;
  if (location.pathname.startsWith("/ai-assistant")) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[80] bg-background/40 backdrop-blur-sm sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {open && (
        <div
          role="dialog"
          aria-label="AI Assistant"
          className="fixed z-[90] flex flex-col bg-card border border-border shadow-2xl
                     inset-x-2 bottom-2 top-16 rounded-2xl
                     sm:inset-auto sm:right-6 sm:bottom-24 sm:top-auto sm:w-[380px] sm:h-[560px]"
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <div className="rounded-md bg-primary/10 p-1.5">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-card-foreground truncate">AI Assistant</p>
                <p className="text-[11px] text-muted-foreground truncate">Inventory · restock proposals</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 p-3">
            <AIAssistantChat compact />
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed z-[85] right-4 bottom-4 sm:right-6 sm:bottom-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors"
        aria-label={open ? "Minimize AI Assistant" : "Open AI Assistant"}
      >
        {open ? <Minimize2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        <span className="hidden sm:inline">{open ? "Minimize" : "Ask AI"}</span>
      </button>
    </>
  );
};

export default FloatingAIAssistant;