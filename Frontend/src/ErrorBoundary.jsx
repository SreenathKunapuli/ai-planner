import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
        <div className="text-center">
          <p className="text-ink text-lg font-medium">Something went wrong.</p>
          <p className="text-faint text-sm mt-1">Your saved plans are safe.</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary mt-4"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
