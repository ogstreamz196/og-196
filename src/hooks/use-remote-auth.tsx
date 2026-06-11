// Remote Supabase auth context (project dawcdietltejjxbdimkm).
// Provides session/user state from the REMOTE project — separate from the
// local site session. Read this in any component that needs to gate behaviour
// on the developer's OG Bot account (token ownership, persona reads, etc.).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { remoteSupabase } from "@/integrations/remote-supabase/client";

type RemoteAuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const RemoteAuthContext = createContext<RemoteAuthContextValue | undefined>(undefined);

export function RemoteAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    remoteSupabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoading(false);
    });
    const { data: sub } = remoteSupabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: RemoteAuthContextValue = {
    session,
    user: session?.user ?? null,
    isLoading,
    signInWithPassword: async (email, password) => {
      const { error } = await remoteSupabase.auth.signInWithPassword({ email, password });
      return { error: error ?? null };
    },
    signUpWithPassword: async (email, password) => {
      const { error } = await remoteSupabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/developer" },
      });
      return { error: error ?? null };
    },
    signInWithGoogle: async () => {
      const { error } = await remoteSupabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/developer" },
      });
      return { error: error ?? null };
    },
    signOut: async () => {
      await remoteSupabase.auth.signOut();
    },
  };

  return <RemoteAuthContext.Provider value={value}>{children}</RemoteAuthContext.Provider>;
}

export function useRemoteAuth(): RemoteAuthContextValue {
  const ctx = useContext(RemoteAuthContext);
  if (!ctx) throw new Error("useRemoteAuth must be used within RemoteAuthProvider");
  return ctx;
}
