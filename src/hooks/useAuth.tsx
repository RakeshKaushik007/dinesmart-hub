import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "super_admin" | "admin" | "owner" | "branch_manager" | "employee";

interface UserRole {
  role: AppRole;
  branch_id: string | null;
  custom_role_name: string | null;
  permissions: string[];
  parent_user_id: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: UserRole[];
  profile: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  isAtLeast: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
}

const ROLE_HIERARCHY: AppRole[] = ["super_admin", "admin", "owner", "branch_manager", "employee"];

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  roles: [],
  profile: null,
  hasRole: () => false,
  hasAnyRole: () => false,
  isAtLeast: () => false,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);

  const fetchUserData = useCallback(async (userId: string) => {
    // Remember who this user is, so the app still knows their role when the
    // network is unavailable. Without this, an offline device loads the app but
    // reports "Access Pending", because it cannot look the role up.
    const CACHE_KEY = "blennix.auth_cache.v1";

    const readCache = () => {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && parsed.userId === userId ? parsed : null;
      } catch {
        return null;
      }
    };

    try {
      const [rolesRes, profileRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role, branch_id, custom_role_name, permissions, parent_user_id, is_active")
          .eq("user_id", userId),
        supabase.from("profiles").select("full_name, email, avatar_url").eq("user_id", userId).single(),
      ]);

      const mappedRoles = Array.isArray(rolesRes.data)
        ? rolesRes.data.map((r: any) => ({
            role: r.role as AppRole,
            branch_id: r.branch_id,
            custom_role_name: r.custom_role_name ?? null,
            permissions: r.permissions ?? [],
            parent_user_id: r.parent_user_id ?? null,
            is_active: r.is_active ?? true,
          }))
        : null;

      if (mappedRoles) setRoles(mappedRoles);
      if (profileRes.data) setProfile(profileRes.data);

      if (mappedRoles || profileRes.data) {
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ userId, roles: mappedRoles, profile: profileRes.data ?? null }),
          );
        } catch {
          /* storage unavailable - the app simply will not work offline */
        }
        return;
      }
    } catch {
      /* no network: fall through to what we knew last time */
    }

    const cached = readCache();
    if (cached) {
      if (Array.isArray(cached.roles)) setRoles(cached.roles);
      if (cached.profile) setProfile(cached.profile);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          if (!isMounted) return;
          fetchUserData(session.user.id).finally(() => {
            if (isMounted) setLoading(false);
          });
        }, 0);
      } else {
        setRoles([]);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const hasRole = useCallback((role: AppRole) => roles.some((r) => r.role === role), [roles]);
  const hasAnyRole = useCallback((rs: AppRole[]) => roles.some((r) => rs.includes(r.role)), [roles]);
  const isAtLeast = useCallback(
    (role: AppRole) => {
      const targetIdx = ROLE_HIERARCHY.indexOf(role);
      return roles.some((r) => ROLE_HIERARCHY.indexOf(r.role) <= targetIdx);
    },
    [roles]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    try {
      window.sessionStorage.removeItem("blennix.pos_session.v1");
      window.sessionStorage.removeItem("blennix.pos_session.v1.pending");
      window.localStorage.removeItem("blennix.pos_session.v1");
      window.localStorage.removeItem("blennix.auth_cache.v1");
    } catch {
      // ignore — session storage may be unavailable
    }
    setUser(null);
    setSession(null);
    setRoles([]);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, roles, profile, hasRole, hasAnyRole, isAtLeast, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
