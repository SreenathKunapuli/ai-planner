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
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-medium text-ink text-center mb-1">Set a new password</h1>
        <p className="text-dim text-sm text-center mb-6">Then you'll be signed right in.</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password" required minLength={6} value={password} placeholder="New password"
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
          <input
            type="password" required minLength={6} value={confirm} placeholder="Confirm password"
            onChange={(e) => setConfirm(e.target.value)}
            className="field"
          />
          <button
            type="submit" disabled={busy}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {busy ? "..." : "Update password"}
          </button>
        </form>
        {err && <p className="text-red-500 text-sm mt-3 text-center">{err}</p>}
      </div>
    </div>
  );
}
