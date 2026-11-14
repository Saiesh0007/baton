import { Component, type ErrorInfo, type ReactNode } from 'react';
import { InkMark } from '../ui';

/* Shared dark panel for the two dead ends: a wrong address and a crash. */
function Room({ mark, title, children }: { mark: ReactNode; title: string; children: ReactNode }) {
  return (
    <main className="fallback">
      <div className="fallback-in">
        <div className="fallback-mark" aria-hidden="true">{mark}</div>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function NotFound() {
  return (
    <Room mark={<span className="fb-q">?</span>} title="Nothing is filed here.">
      <p>There's no page at <code>{window.location.pathname}</code>. Baton lives on a single page, so everything starts from home.</p>
      <a className="btn primary lg" href="/">Go to Baton →</a>
    </Room>
  );
}

const STORE_KEY = 'baton.v1';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Baton crashed', error, info.componentStack); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const reset = () => { try { localStorage.removeItem(STORE_KEY); } catch { /* storage blocked */ } window.location.assign('/'); };
    return (
      <Room mark={<span className="fb-neq"><InkMark s="conflicting" /></span>} title="Something broke on this screen.">
        <p>Your data is still in this browser. Reload to try again. If it keeps happening, the saved demo data may be damaged; resetting clears it and starts the demo fresh.</p>
        <div className="row gap wrap">
          <button className="btn primary lg" onClick={() => window.location.reload()}>Reload</button>
          <button className="btn lg on-dark" onClick={reset}>Reset demo data</button>
        </div>
        <pre className="fb-err">{error.message}</pre>
      </Room>
    );
  }
}
