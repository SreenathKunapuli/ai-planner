import { useState } from "react";
import { useAuth } from "./AuthContext";

// Shown after the user lands from a password-reset email link.
export default function UpdatePassword() {
  const { updatePassword, clearRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setErr("Passwords don't match.");
    setBusy(true);
    setErr("");
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) return setErr(error.message);
    clearRecovery();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white text-center mb-1">Set a new password</h1>
        <p className="text-slate-400 text-sm text-center mb-6">Then you'll be signed right in.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password" required minLength={6} value={password} placeholder="New password"
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password" required minLength={6} value={confirm} placeholder="Confirm password"
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit" disabled={busy}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 transition"
          >
            {busy ? "..." : "Update password"}
          </button>
        </form>
        {err && <p className="text-red-400 text-sm mt-3 text-center">{err}</p>}
      </div>
    </div>
  );
}
