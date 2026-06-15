import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlertTriangle, Info, XCircle, X } from "lucide-react";

interface Banner {
  id: string;
  message: string;
  severity: "info" | "warning" | "critical";
  audience: string;
}

const severityStyles: Record<string, string> = {
  info: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
  critical: "bg-destructive/10 border-destructive/30 text-destructive",
};

const SystemBanners = () => {
  const { roles } = useAuth();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("blennix.dismissed_banners") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    if (roles.length === 0) return;
    const fetchBanners = async () => {
      const { data } = await supabase
        .from("system_banners")
        .select("id, message, severity, audience")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (!data) return;
      const userRoles = roles.map((r) => r.role);
      const filtered = data.filter((b: any) => {
        if (b.audience === "all") return true;
        if (b.audience === "owners") return userRoles.includes("owner");
        if (b.audience === "managers") return userRoles.includes("branch_manager");
        if (b.audience === "employees") return userRoles.includes("employee");
        return false;
      });
      setBanners(filtered as Banner[]);
    };
    fetchBanners();
  }, [roles]);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem("blennix.dismissed_banners", JSON.stringify(next));
  };

  const visible = banners.filter((b) => !dismissed.includes(b.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((b) => {
        const Icon = b.severity === "critical" ? XCircle : b.severity === "warning" ? AlertTriangle : Info;
        return (
          <div key={b.id} className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${severityStyles[b.severity]}`}>
            <Icon className="h-5 w-5 mt-0.5 shrink-0" />
            <p className="flex-1 text-sm font-medium">{b.message}</p>
            <button onClick={() => dismiss(b.id)} className="opacity-60 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default SystemBanners;