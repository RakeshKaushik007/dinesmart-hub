import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, MapPin, Store, ChefHat, ArrowRight, Search } from "lucide-react";
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
  const [query, setQuery] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState("");

  const searchListboxId = "pos-branch-listbox";
  const searchHelpId = "pos-branch-search-help";
  const liveRegionId = "pos-branch-live";

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) =>
      [b.name, b.address ?? "", b.restaurant_name ?? ""].some((s) => s.toLowerCase().includes(q)),
    );
  }, [branches, query]);

  // Reset focus when filter changes; auto-select if only one result.
  useEffect(() => {
    setFocusIndex(0);
    if (filtered.length === 1) setSelectedId(filtered[0].id);
  }, [filtered]);

  // Autofocus search on mount (desktop) — mobile keyboards shouldn't pop unprompted.
  useEffect(() => {
    if (loadingBranches) return;
    if (window.matchMedia("(min-width: 640px)").matches) {
      searchRef.current?.focus();
    }
  }, [loadingBranches]);

  // Announce filter results so screen readers and voice control stay in sync.
  useEffect(() => {
    if (loadingBranches) return;
    if (!query.trim()) {
      setAnnouncement(`${branches.length} branches available.`);
      return;
    }
    if (filtered.length === 0) {
      setAnnouncement(`No branches match ${query}.`);
    } else {
      setAnnouncement(`${filtered.length} of ${branches.length} branches match ${query}.`);
    }
  }, [filtered, branches.length, query, loadingBranches]);

  // Mobile focus trap — keep Tab cycling inside the picker so users with
  // switch / keyboard control on small screens can't fall into the address bar.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", handler);
    return () => node.removeEventListener("keydown", handler);
  }, [loadingBranches, branches.length]);

  const selectedBranch = branches.find((b) => b.id === selectedId) ?? null;

  // Speak the selection so AT users hear the change without scanning.
  useEffect(() => {
    if (selectedBranch) {
      setAnnouncement(
        `Selected ${selectedBranch.name}${selectedBranch.restaurant_name ? `, ${selectedBranch.restaurant_name}` : ""}. Press Enter to start your shift.`,
      );
    }
  }, [selectedBranch]);

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

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(focusIndex + 1, filtered.length - 1);
      setFocusIndex(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(focusIndex - 1, 0);
      setFocusIndex(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[focusIndex] ?? filtered[0];
      if (target) {
        setSelectedId(target.id);
        // Allow state update, then proceed if user pressed Enter again — start now.
        setTimeout(() => handleStart(), 0);
      }
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      setQuery("");
    }
  };

  const onCardKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number, b: BranchOption) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(idx + 1, filtered.length - 1);
      setFocusIndex(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (idx === 0) {
        searchRef.current?.focus();
      } else {
        setFocusIndex(idx - 1);
        itemRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedId(b.id);
      if (e.key === "Enter") setTimeout(() => handleStart(), 0);
    }
  };

  const handleCancel = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  if (loading || loadingBranches) {
    return (
      <div role="status" aria-live="polite" className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="sr-only">Loading branches…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-start-title"
        aria-describedby="pos-start-desc"
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-lg"
      >
        {/* Polite live region — used for filter counts and selection announcements. */}
        <div id={liveRegionId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center">
            <ChefHat className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
          </div>
          <div>
            <h1 id="pos-start-title" className="text-xl font-bold text-foreground">Start your POS shift</h1>
            <p id="pos-start-desc" className="text-sm text-muted-foreground">
              Pick the branch you're operating from. POS pages stay locked until this is set.
            </p>
          </div>
        </div>

        {branches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
            <Store className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden="true" />
            <h2 className="font-semibold text-foreground">No branches available</h2>
            <p className="text-sm text-muted-foreground">
              Your account isn't assigned to an active branch yet. Ask your manager to assign one.
            </p>
            <Button variant="outline" onClick={handleCancel}>Sign out</Button>
          </div>
        ) : (
          <>
            <div className="relative mb-4">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                ref={searchRef}
                type="search"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={`Search ${branches.length} branch${branches.length === 1 ? "" : "es"} by name, restaurant or address`}
                className="w-full rounded-lg border border-input bg-secondary pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Search branches"
                aria-describedby={searchHelpId}
                aria-controls={searchListboxId}
                aria-autocomplete="list"
                aria-activedescendant={filtered[focusIndex] ? `pos-branch-${filtered[focusIndex].id}` : undefined}
                role="combobox"
                aria-expanded={filtered.length > 0}
              />
              <span id={searchHelpId} className="sr-only">
                Type to filter branches. Use up and down arrow keys to move between matches, Enter to start your shift, or Escape to clear the search.
              </span>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 mb-6 text-center text-sm text-muted-foreground">
                No branches match "{query}".
              </div>
            ) : (
              <div
                id={searchListboxId}
                className="grid sm:grid-cols-2 gap-3 mb-6 max-h-[50vh] overflow-y-auto pr-1"
                role="listbox"
                aria-label={`${filtered.length} branch${filtered.length === 1 ? "" : "es"}${query ? ` matching ${query}` : " available"}`}
                aria-activedescendant={filtered[focusIndex] ? `pos-branch-${filtered[focusIndex].id}` : undefined}
              >
                {filtered.map((b, idx) => {
                const active = selectedId === b.id;
                const labelParts = [
                  `${b.name}${b.restaurant_name ? `, ${b.restaurant_name}` : ""}`,
                  b.address ?? "",
                  active ? "selected" : "",
                ].filter(Boolean);
                return (
                  <button
                    key={b.id}
                    id={`pos-branch-${b.id}`}
                    ref={(el) => (itemRefs.current[idx] = el)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    aria-label={labelParts.join(". ")}
                    onClick={() => setSelectedId(b.id)}
                    onDoubleClick={() => { setSelectedId(b.id); handleStart(); }}
                    onKeyDown={(e) => onCardKeyDown(e, idx, b)}
                    className={`text-left rounded-xl border p-4 transition-colors ${
                      active
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/40"
                    } focus:outline-none focus:ring-2 focus:ring-ring`}
                  >
                    <div className="flex items-start gap-2">
                      <Store aria-hidden="true" className={`h-4 w-4 mt-0.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{b.name}</div>
                        {b.restaurant_name && (
                          <div className="text-xs text-muted-foreground truncate">{b.restaurant_name}</div>
                        )}
                        {b.address && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin aria-hidden="true" className="h-3 w-3" />
                            <span className="truncate">{b.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mb-3 hidden sm:block">
              Tip: type to filter · ↑/↓ to move · Enter to start · double-tap a card on mobile
            </p>
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={handleCancel} disabled={submitting}>
                Sign out
              </Button>
              <Button
                onClick={handleStart}
                disabled={!selectedId || submitting}
                aria-label={selectedBranch ? `Start POS shift at ${selectedBranch.name}` : "Select a branch to continue"}
              >
                {submitting ? "Starting..." : "Enter POS"}
                {!submitting && <ArrowRight aria-hidden="true" className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PosStartPage;