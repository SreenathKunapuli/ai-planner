import { useState } from "react";
import { useAuth } from "./AuthContext";

export default function Login() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState("signin"); // signin | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState(null); // {text, isError}
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "reset") {
      const { error } = await resetPassword(email);
      setMsg(
        error
          ? { text: error.message, isError: true }
          : { text: "If that email has an account, a reset link is on its way.", isError: false }
      );
      setBusy(false);
      return;
    }
    const fn = mode === "signin" ? signInWithEmail : signUpWithEmail;
    const { data, error } = await fn(email, password);
    if (error) setMsg({ text: error.message, isError: true });
    else if (mode === "signup" && !data.session)
      setMsg({ text: "Check your email to confirm your account.", isError: false });
    setBusy(false);
  };

  const switchMode = (m) => {
    setMode(m);
    setMsg(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-xl">
        <div className="flex items-center justify-center gap-2.5 mb-1">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <h1 className="text-2xl font-semibold text-white text-center">AI Planner</h1>
        </div>
        <p className="text-slate-400 text-sm text-center mt-1 mb-6">
          {mode === "reset"
            ? "We'll email you a link to reset your password"
            : "Let AI turn your tasks into a schedule"}
        </p>

        {mode !== "reset" && (
          <>
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 rounded-lg bg-white text-slate-800 font-medium py-2.5 hover:bg-slate-100 transition"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C41 35.4 44 30.2 44 24c0-1.3-.1-2.6-.4-3.9z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-slate-800" />
              <span className="text-xs text-slate-500">or use email</span>
              <div className="h-px flex-1 bg-slate-800" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email" required value={email} placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          {mode !== "reset" && (
            <input
              type="password" required minLength={6} value={password} placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          )}
          <button
            type="submit" disabled={busy}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 transition"
          >
            {busy ? "..."
              : mode === "signin" ? "Sign in"
              : mode === "signup" ? "Create account"
              : "Send reset link"}
          </button>
        </form>

        {msg && (
          <p className={`text-sm mt-3 text-center ${msg.isError ? "text-red-400" : "text-emerald-400"}`}>
            {msg.text}
          </p>
        )}

        <div className="mt-5 space-y-2 text-center">
          {mode === "signin" && (
            <button onClick={() => switchMode("reset")}
              className="block w-full text-sm text-slate-500 hover:text-white transition">
              Forgot password?
            </button>
          )}
          <button
            onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
            className="block w-full text-sm text-slate-400 hover:text-white transition"
          >
            {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
