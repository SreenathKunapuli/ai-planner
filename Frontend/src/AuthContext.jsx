import { createContext, useContext, useEffect, useState } from "react";
import supabase from "./supabase-client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [recovery, setRecovery] = useState(false); // arrived via password-reset link

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    recovery,
    clearRecovery: () => setRecovery(false),
    signInWithGoogle: () =>
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      }),
    signInWithEmail: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),
    signUpWithEmail: (email, password) =>
      supabase.auth.signUp({ email, password }),
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
