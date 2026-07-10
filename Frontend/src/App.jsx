import { AuthProvider, useAuth } from "./AuthContext";
import ErrorBoundary from "./ErrorBoundary";
import Login from "./Login";
import PlannerPage from "./PlannerPage";
import UpdatePassword from "./UpdatePassword";

function Shell() {
  const { session, user, recovery, signOut } = useAuth();

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    );
  }
  if (!session) return <Login />;
  if (recovery) return <UpdatePassword />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="h-6 w-6" />
            <h1 className="font-semibold text-lg">
              AI <span className="text-indigo-400">Planner</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-400 hidden sm:inline">{user.email}</span>
            <button
              onClick={signOut}
              className="rounded-lg border border-slate-700 px-3 py-1.5 hover:bg-slate-800 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <PlannerPage />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
