import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User, AuthError } from "@supabase/supabase-js";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  /** Send a password-recovery email. Supabase will deliver a magic link
   *  pointing at `/reset-password` where the user can set a new password. */
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  /** Set a new password for the currently authenticated user. Used both
   *  by the reset-password recovery flow and by Settings → Change Password. */
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setAuthTokenGetter(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });

    return () => {
      setAuthTokenGetter(null);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    // Supabase needs an absolute URL for the recovery link's redirect.
    // The URL we compute here MUST also exist in the Supabase project's
    // "Redirect URLs" allowlist (Authentication → URL Configuration);
    // otherwise Supabase silently falls back to the project's "Site URL"
    // and the email link will appear broken.
    //
    // We prefer an explicit `VITE_PUBLIC_SITE_URL` (e.g. the production
    // domain) over `window.location.origin`, because the latter resolves
    // to whatever URL the SPA happens to be loaded from — in Replit dev
    // that's a port-forwarded preview URL that can drift between sessions
    // and be impractical to keep allowlisted.
    const explicitOrigin = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
    const origin = (explicitOrigin || window.location.origin).replace(/\/+$/, "");

    // Normalize BASE_URL defensively: vite usually delivers a slash-terminated
    // value (e.g. "/" or "/arsredovisningar/") but env drift could break the
    // assumption. Strip any trailing slash and join with a single "/".
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
    const redirectTo = `${origin}${base}/reset-password`;

    // Surface the redirect URL once per call so the user can see exactly
    // what Supabase needs to allow. Console-only — never shown in UI.
    // eslint-disable-next-line no-console
    console.info(
      "[auth] password recovery redirect_to =",
      redirectTo,
      "(must be allowlisted in Supabase → Authentication → URL Configuration)"
    );

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
