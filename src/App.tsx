import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { DrawerProvider } from './ui';
import type { Role } from './types';
import Home from './pages/Home';
import Overview from './pages/Overview';
import Sources from './pages/Sources';
import Ledger from './pages/Ledger';
import Interview from './pages/Interview';
import Review from './pages/Review';
import Handover from './pages/Handover';

const PAGES: { id: string; label: string; step?: string; roles: Role[] }[] = [
  { id: 'overview', label: 'Overview', roles: ['reviewer', 'leaver'] },
  { id: 'sources', label: 'Sources', step: '1', roles: ['reviewer'] },
  { id: 'ledger', label: 'Claim ledger', step: '2', roles: ['reviewer', 'leaver'] },
  { id: 'interview', label: 'Exit interview', step: '3', roles: ['reviewer', 'leaver'] },
  { id: 'review', label: 'Review', step: '4', roles: ['reviewer'] },
  { id: 'handover', label: 'Handover', step: '5', roles: ['reviewer', 'successor'] },
];

const ROLE_HOME: Record<Role, string> = { reviewer: 'overview', leaver: 'interview', successor: 'handover' };

function Shell() {
  const { project, analysis, role, setRole, open } = useStore();
  const [page, setPage] = useState('overview');

  useEffect(() => {
    const allowed = PAGES.find((p) => p.id === page)?.roles.includes(role);
    if (!allowed) setPage(ROLE_HOME[role]);
  }, [role, page]);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  if (!project || !analysis) return <><Header /><main className="wrap"><Home /></main><Footer /></>;

  const openQs = analysis.questions.filter((q) => !project.answers[q.id]).length;
  const pending = analysis.claims.filter((c) => !c.superseded && c.review === 'pending').length;
  const badge: Record<string, string | undefined> = {
    interview: openQs ? String(openQs) : undefined,
    review: pending ? String(pending) : undefined,
    handover: project.published ? `v${project.published.version}` : undefined,
  };
  const go = (p: string) => {
    const target = PAGES.find((x) => x.id === p);
    if (target && !target.roles.includes(role)) setRole(target.roles[0]);
    setPage(p);
  };
  const Page = { overview: Overview, sources: Sources, ledger: Ledger, interview: Interview, review: Review, handover: Handover }[page] ?? Overview;

  return (
    <>
      <Header>
        <div className="proj">
          <button className="link small" onClick={() => open(null)}>← All handovers</button>
          <div className="proj-name" title={project.description}>{project.name}</div>
        </div>
        <div className="roles" role="group" aria-label="View as">
          <span className="muted small">View as</span>
          {(['reviewer', 'leaver', 'successor'] as Role[]).map((r) => (
            <button key={r} className={role === r ? 'on' : ''} onClick={() => { setRole(r); setPage(r === 'reviewer' && project.published ? page : ROLE_HOME[r]); }}>
              <b>{r[0].toUpperCase() + r.slice(1)}</b>
              <span>{project.people[r]}</span>
            </button>
          ))}
        </div>
      </Header>
      <nav className="steps wrap">
        {PAGES.filter((p) => p.roles.includes(role)).map((p) => (
          <button key={p.id} className={page === p.id ? 'on' : ''} onClick={() => setPage(p.id)}>
            {p.step && <span className="sn">{p.step}</span>}
            {p.label}
            {badge[p.id] && <span className="badge">{badge[p.id]}</span>}
          </button>
        ))}
        <div className="spacer" />
        <div className="readiness-chip" title="Handover readiness">Readiness <b>{analysis.readiness}%</b></div>
      </nav>
      <main className="wrap">
        <Page go={go} />
      </main>
      <Footer />
    </>
  );
}

function Header({ children }: { children?: React.ReactNode }) {
  const { open } = useStore();
  return (
    <header className="top">
      <div className="wrap top-in">
        <button className="logo" onClick={() => open(null)} aria-label="Baton home">Baton<span>.</span></button>
        {children}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="wrap foot muted small">
      Baton · Team Spectrum · CodePuneThinkers Round 2 build. All demo data is synthetic. Your data stays in this browser (localStorage); nothing is sent to a server except read-only GitHub API calls.
    </footer>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <DrawerProvider>
        <Shell />
      </DrawerProvider>
    </StoreProvider>
  );
}
