import { Outlet } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import AppSidebar from "./AppSidebar";
import FloatingAIAssistant from "@/components/ai/FloatingAIAssistant";
import SystemBanners from "@/components/SystemBanners";

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile hamburger */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-3 py-3 bg-background/95 backdrop-blur border-b border-border shadow-sm md:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          className="inline-flex items-center justify-center h-10 w-10 -ml-1 rounded-lg text-foreground hover:bg-muted active:bg-muted/70 transition-colors"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span className="text-sm font-bold text-foreground">Blennix POS</span>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[55] bg-background/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, shown on md+ */}
      <div className={`
        fixed left-0 top-0 z-[60] h-screen transition-transform duration-200
        md:translate-x-0
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <AppSidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <main className="pt-14 md:pt-0 md:ml-64 min-h-screen">
        <div className="px-3 py-4 sm:p-6">
          <SystemBanners />
          <Outlet />
        </div>
      </main>

      <FloatingAIAssistant />
    </div>
  );
};

export default AppLayout;
