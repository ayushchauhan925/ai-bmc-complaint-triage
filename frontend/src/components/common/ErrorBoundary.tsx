import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Short name of the area, shown in the fallback ("the AI assessment could not be shown"). */
  label?: string;
  /** Render a full-page fallback instead of an inline panel. */
  page?: boolean;
}

/**
 * Catches render errors so one broken panel can never blank the whole screen. The error is
 * logged to the console (and is what the browser tests watch for); the user gets a calm message
 * and a retry.
 */
export class ErrorBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('UI error boundary caught:', error.message, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const what = this.props.label ?? 'This section';
    if (this.props.page) {
      return (
        <div role="alert" className="mx-auto mt-20 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-500">The page hit an unexpected problem. Reloading usually fixes it.</p>
          <button className="btn-primary mt-5" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      );
    }
    return (
      <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">{what} could not be displayed.</p>
        <button className="mt-2 text-xs font-medium underline" onClick={() => this.setState({ failed: false })}>Try again</button>
      </div>
    );
  }
}
