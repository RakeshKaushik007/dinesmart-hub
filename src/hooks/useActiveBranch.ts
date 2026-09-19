import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePosSession } from "@/hooks/usePosSession";

export interface ActiveBranch {
  /** Branch that new records must be saved to, or null when it cannot be decided. */
  branchId: string | null;
  branchName: string | null;
  /** Still being worked out. Callers should not save yet. */
  loading: boolean;
  /**
   * The user can reach more than one branch but has not chosen one in this
   * tab. Saving now would create a record with no branch, which then
   * disappears from every screen, so callers must stop and send the user to
   * /pos/start to pick one.
   */
  needsChoice: boolean;
}

type Fallback = { userId: string; id: string | null; name: string | null; count: number };

/**
 * The branch that new records belong to.
 *
 * 1. The branch chosen at the start of the shift (/pos/start). This is the
 *    only reliable answer for an owner with several branches.
 * 2. Otherwise, the user's only branch, if they can reach exactly one. This
 *    keeps single-branch users working in a tab where no shift was started.
 * 3. Otherwise null. It never guesses between several branches.
 *
 * Replaces `roles.find((r) => r.branch_id)?.branch_id`, which is null for
 * owners (their role row has no branch) and arbitrary for anyone with more
 * than one role row.
 */
export const useActiveBranch = (): ActiveBranch => {
  const { user } = useAuth();
  const { session, ready } = usePosSession();
  const [fallback, setFallback] = useState<Fallback | null>(null);

  const sessionBranchId = session?.branch_id ?? null;
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!ready || sessionBranchId || !userId) return;
    let cancelled = false;
    (async () => {
      // RLS already limits this to branches the user may access, so two rows
      // are enough to tell "exactly one" apart from "several".
      const { data } = await supabase
        .from("branches")
        .select("id, name")
        .eq("is_active", true)
        .limit(2);
      if (cancelled) return;
      const rows = data ?? [];
      setFallback({
        userId,
        id: rows.length === 1 ? rows[0].id : null,
        name: rows.length === 1 ? rows[0].name : null,
        count: rows.length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, sessionBranchId, userId]);

  if (sessionBranchId) {
    return {
      branchId: sessionBranchId,
      branchName: session?.branch_name ?? null,
      loading: false,
      needsChoice: false,
    };
  }
  if (!userId) {
    return { branchId: null, branchName: null, loading: !ready, needsChoice: false };
  }
  // A result worked out for a previous user is ignored until it is refreshed.
  const current = fallback && fallback.userId === userId ? fallback : null;
  if (!ready || !current) {
    return { branchId: null, branchName: null, loading: true, needsChoice: false };
  }
  if (current.id) {
    return { branchId: current.id, branchName: current.name, loading: false, needsChoice: false };
  }
  return { branchId: null, branchName: null, loading: false, needsChoice: current.count > 1 };
};
