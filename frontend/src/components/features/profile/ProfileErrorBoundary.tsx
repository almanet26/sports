import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: string | null }

export default class ProfileErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center rounded-[32px] border border-rose-400/20 bg-rose-400/5 p-8 text-center">
          <div>
            <p className="text-lg font-semibold text-rose-300">Something went wrong loading your profile</p>
            <p className="mt-2 text-sm text-slate-400">{this.state.error}</p>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-6 rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
