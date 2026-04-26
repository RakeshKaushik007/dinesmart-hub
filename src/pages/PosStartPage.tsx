import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, MapPin, Store, ChefHat, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { consumePinPendingMarker, usePosSession } from "@/hooks/usePosSession";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface BranchOption {
  id: string;
  name: string;
  address: string | null;
  restaurant_id: string | null;
  restaurant_name: string | null;
}

const PosStartPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/billing";
  const { user, loading, roles, isAtLeast, signOut } = useAuth();
  const { startSession } = usePosSession();
  const { toast } = useToast();

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const verifiedViaPin = useMemo(() => (user ? consumePinPendingMarker(user.id) : false), [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingBranches(true);

      // Branches the user is scoped to — based on user_roles.branch_id when set.
      const scopedBranchIds = roles
        .map((r) => r.branch_id)
        .filter((b): b is string => !!b);

      let query = supabase
        .from("branches")
        .select("id, name, address, restaurant_id, restaurants(name)")
        .eq("is_active", true)
        .order("name");

      // Owners and below without explicit branch scope still need to pick from
      // their restaurant's branches; admins/super_admins see all active.
      if (!isAtLeast("admin") && scopedBranchIds.length > 0) {
        query = query.in("id", scopedBranchIds);
      }

      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        toast({ title: "Could not load branches", description: error.message, variant: "destructive" });
        setBranches([]);
      } else {
        const mapped: BranchOption[] = (data ?? []).map((b: any) => ({
          id: b.id,
          name: b.name,
          address: b.address ?? null,
          restaurant_id: b.restaurant_id ?? null,
          restaurant_name: b.restaurants?.name ?? null,
        }));
        setBranches(mapped);
        if (mapped.length === 1) setSelectedId(mapped[0].id);
      }
      setLoadingBranches(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, roles, isAtLeast, toast, navigate]);

  const handleStart = () => {
    if (!user) return;
    const branch = branches.find((b) => b.id === selectedId);
    if (!branch) {
      toast({ title: "Pick a branch", description: "Select the branch you're working from", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    startSession({
      verified_via: verifiedViaPin ? "pin" : "email",
      branch_id: branch.id,
      branch_name: branch.name,
      restaurant_id: branch.restaurant_id,
      restaurant_name: branch.restaurant_name,
    });
    navigate(next, { replace: true });
  };

  const handleCancel = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  if (loading || loadingBranches) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center">
            <ChefHat className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Start your POS shift</h1>
            <p className="text-sm text-muted-foreground">
              Pick the branch you're operating from. POS pages stay locked until this is set.
            </p>
          </div>
        </div>

        {branches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
            <Store className="h-8 w-8 mx-auto text-muted-foreground" />
            <h2 className="font-semibold text-foreground">No branches available</h2>
            <p className="text-sm text-muted-foreground">
              Your account isn't assigned to an active branch yet. Ask your manager to assign one.
            </p>
            <Button variant="outline" onClick={handleCancel}>Sign out</Button>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3 mb-6 max-h-[50vh] overflow-y-auto pr-1">
              {branches.map((b) => {
                const active = selectedId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      active
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Store className={`h-4 w-4 mt-0.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{b.name}</div>
                        {b.restaurant_name && (
                          <div className="text-xs text-muted-foreground truncate">{b.restaurant_name}</div>
                        )}
                        {b.address && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{b.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={handleCancel} disabled={submitting}>
                Sign out
              </Button>
              <Button onClick={handleStart} disabled={!selectedId || submitting}>
                {submitting ? "Starting..." : "Enter POS"}
                {!submitting && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PosStartPage;