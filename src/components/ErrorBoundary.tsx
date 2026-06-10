import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary so a render-time crash on any page
 * shows a readable message + reload button instead of a blank screen.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surfaces in the browser console so we can see the real cause.
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-lg w-full rounded-xl border border-border bg-card p-6 space-y-4">
            <h1 className="text-lg font-semibold text-card-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred while rendering this page.
            </p>
            <pre className="text-xs text-destructive whitespace-pre-wrap break-words bg-muted/40 p-3 rounded-lg max-h-64 overflow-auto">
              {this.state.error.message}
              {this.state.error.stack ? `\n\n${this.state.error.stack}` : ""}
            </pre>
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}