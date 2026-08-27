/**
 * ErrorBoundary — a minimal class boundary for UI subtrees.
 *
 * Catches render errors in a subtree (e.g. the Card Gallery) and shows a
 * styled fallback instead of unmounting the whole app. `resetKey` lets an
 * owner force a retry by re-rendering the boundary with a new key.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Skull } from "lucide-react";

type Props = {
  children: ReactNode;
  /** Renderer for the fallback. `reset` clears the error and re-renders. */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
};
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for diagnostics without leaking to the UI.
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback)
        return this.props.fallback({
          error: this.state.error ?? new Error("Unhandled error"),
          reset: this.reset,
        });
      return (
        <div
          data-testid="error-boundary-fallback"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#5c2a1e] bg-[#14100c] p-10 text-center"
        >
          <Skull className="h-8 w-8 text-[#8a3a20]" aria-hidden />
          <p className="font-mono text-sm text-[#d8a65a]">This section could not be rendered</p>
          <button
            type="button"
            onClick={this.reset}
            className="rounded-full border border-[#5c4a3e] px-4 py-1.5 text-xs uppercase tracking-wider text-[#d8a65a] hover:bg-[#d8a65a]/10"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
