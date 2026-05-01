import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "blennix.pos_session.v1";

export interface PosSession {
  user_id: string;
  verified_via: "pin" | "email";
  branch_id: string;
  branch_name: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  started_at: string;
}

interface PosSessionContextValue {
  session: PosSession | null;
  ready: boolean;
  startSession: (s: Omit<PosSession, "started_at" | "user_id">) => void;
  endSession: () => void;
}

const PosSessionContext = createContext<PosSessionContextValue>({
  session: null,
  ready: false,
  startSession: () => {},
  endSession: () => {},
});

const readStored = (): PosSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PosSession;
  } catch {
    return null;
  }
};

export const PosSessionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [session, setSession] = useState<PosSession | null>(() => readStored());
  const [ready, setReady] = useState(false);

  // When the auth user changes (logout, switch user), discard a mismatched POS session.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setReady(true);
      return;
    }
    const stored = readStored();
    if (stored && stored.user_id !== user.id) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      setSession(null);
    } else {
      setSession(stored);
    }
    setReady(true);
  }, [user, loading]);

  const startSession = useCallback<PosSessionContextValue["startSession"]>(
    (s) => {
      if (!user) return;
      const next: PosSession = {
        ...s,
        user_id: user.id,
        started_at: new Date().toISOString(),
      };
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
    },
    [user]
  );

  const endSession = useCallback(() => {
    window.sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, ready, startSession, endSession }), [session, ready, startSession, endSession]);

  return <PosSessionContext.Provider value={value}>{children}</PosSessionContext.Provider>;
};

export const usePosSession = () => useContext(PosSessionContext);

// Helper used by login flows that complete a PIN verify and want to mark the
// caller as PIN-verified for this tab. The branch is still picked separately.
export const markPosVerifiedViaPin = (userId: string) => {
  const existing = readStored();
  if (existing && existing.user_id === userId) {
    const updated: PosSession = { ...existing, verified_via: "pin" };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return;
  }
  // Stash a partial marker so the gate page knows the user came in via PIN.
  window.sessionStorage.setItem(
    `${STORAGE_KEY}.pending`,
    JSON.stringify({ user_id: userId, verified_via: "pin", at: new Date().toISOString() })
  );
};

export const consumePinPendingMarker = (userId: string): boolean => {
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_KEY}.pending`);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { user_id: string; verified_via: string };
    window.sessionStorage.removeItem(`${STORAGE_KEY}.pending`);
    return parsed.user_id === userId && parsed.verified_via === "pin";
  } catch {
    return false;
  }
};