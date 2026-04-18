import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "master" | "municipal" | "operacional" | "visualizacao";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  municipioId: string | null;
  nomeCompleto: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  canWrite: () => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [municipioId, setMunicipioId] = useState<string | null>(null);
  const [nomeCompleto, setNomeCompleto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: rolesData }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("profiles").select("municipio_id, nome_completo").eq("id", uid).maybeSingle(),
    ]);
    setRoles((rolesData?.map((r) => r.role as AppRole)) ?? []);
    setMunicipioId(profile?.municipio_id ?? null);
    setNomeCompleto(profile?.nome_completo ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => void loadProfile(sess.user.id), 0);
      } else {
        setRoles([]);
        setMunicipioId(null);
        setNomeCompleto(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) void loadProfile(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    roles,
    municipioId,
    nomeCompleto,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    hasRole: (r) => roles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    canWrite: () => roles.some((r) => ["master", "municipal", "operacional"].includes(r)),
    refresh: async () => {
      if (user) await loadProfile(user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
