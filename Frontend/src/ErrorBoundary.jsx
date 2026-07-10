import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="text-center">
          <p className="text-slate-200 text-lg font-medium">Something went wrong.</p>
          <p className="text-slate-500 text-sm mt-1">Your saved plans are safe.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-sm font-medium transition"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
