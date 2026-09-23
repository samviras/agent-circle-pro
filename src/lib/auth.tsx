import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  displayName: string;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  user: null,
  loading: true,
  displayName: "",
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const displayName =
    (user?.user_metadata?.["display_name"] as string | undefined) ??
    (user?.user_metadata?.["full_name"] as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";

  return (
    <AuthContext.Provider value={{ session, user, loading, displayName }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
