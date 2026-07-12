import { IconCalendarEvent } from "@tabler/icons-react";
import { AuthProvider, useAuth } from "./AuthContext";
import ErrorBoundary from "./ErrorBoundary";
import Login from "./Login";
import PlannerPage from "./PlannerPage";
import ThemeToggle from "./ThemeToggle";
import UpdatePassword from "./UpdatePassword";

function Shell() {
  const { session, user, recovery, signOut } = useAuth();

  if (session === undefined) {
    return (
      <div className="min-h-screen grid place-items-center bg-canvas text-faint">
        Loading…
      </div>
    );
  }
  if (!session) return <Login />;
  if (recovery) return <UpdatePassword />;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b-[0.5px] border-line bg-surface">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconCalendarEvent size={20} className="text-accent" />
            <h1 className="font-medium text-[15px] tracking-tight">
              AI <span className="text-accent">Planner</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-faint hidden sm:inline text-[13px]">{user.email}</span>
            <button onClick={signOut} className="btn btn-ghost">Sign out</button>
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
