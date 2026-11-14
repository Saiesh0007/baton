import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { motion } from 'motion/react';
import { DrawerProvider } from './ui';
import { CountUp, PageIn, reducedMotion } from './motion';
import PassOverlay, { PassCtx, type PassInfo } from './components/PassOverlay';
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

const spring = reducedMotion() ? { duration: 0 } : { type: 'spring' as const, stiffness: 520, damping: 42 };

const ROLE_HOME: Record<Role, string> = { reviewer: 'overview', leaver: 'interview', successor: 'handover' };

function Shell() {
  const { project, analysis, role, setRole, open } = useStore();
  const [page, setPage] = useState('overview');
  const [pass, setPass] = useState<PassInfo | null>(null);

  useEffect(() => {
    const allowed = PAGES.find((p) => p.id === page)?.roles.includes(role);
    if (!allowed) setPage(ROLE_HOME[role]);
  }, [role, page]);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  if (!project || !analysis) return <><Header dark /><main><Home /></main><Footer /></>;

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
    <PassCtx.Provider value={setPass}>
      <Header>
        <div className="proj">
          <div className="proj-name" title={project.description}>{project.name}</div>
          <button className="link small" onClick={() => open(null)}>All handovers</button>
        </div>
        <div className="roles" role="group" aria-label="View as">
          <span className="muted small">View as</span>
          {(['reviewer', 'leaver', 'successor'] as Role[]).map((r) => (
            <button key={r} className={role === r ? 'on' : ''} aria-pressed={role === r} onClick={() => { setRole(r); setPage(r === 'reviewer' && project.published ? page : ROLE_HOME[r]); }}>
              {role === r && <motion.span layoutId="role-pill" className="role-pill" transition={spring} />}
              <b>{r[0].toUpperCase() + r.slice(1)}</b>
              <span>{project.people[r]}</span>
            </button>
          ))}
        </div>
      </Header>
      <nav className="steps wrap">
        {PAGES.filter((p) => p.roles.includes(role)).map((p) => (
          <button key={p.id} className={page === p.id ? 'on' : ''} aria-current={page === p.id ? 'page' : undefined} onClick={() => setPage(p.id)}>
            {page === p.id && <motion.span layoutId="step-line" className="step-line" transition={spring} />}
            {p.step && <span className="sn">{p.step}</span>}
            {p.label}
            {badge[p.id] && <span className="badge">{badge[p.id]}</span>}
          </button>
        ))}
        <div className="spacer" />
        {page !== 'overview' && <div className="readiness-chip" title="Share of required template fields backed by evidence">Readiness <b><CountUp value={analysis.readiness} suffix="%" /></b></div>}
      </nav>
      <main className="wrap">
        <PageIn id={page}><Page go={go} /></PageIn>
      </main>
      <Footer />
      {pass && <PassOverlay {...pass} onSwitch={() => go('handover')} onDone={() => setPass(null)} />}
    </PassCtx.Provider>
  );
}

function Header({ children, dark }: { children?: React.ReactNode; dark?: boolean }) {
  const { open } = useStore();
  return (
    <header className={`top ${dark ? 'dark' : ''}`}>
      <div className="wrap top-in">
        <button className="logo" onClick={() => open(null)} aria-label="Baton home">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2" y="9.5" width="20" height="5" rx="2.5" transform="rotate(-35 12 12)" fill="currentColor" /><rect x="9.6" y="9.5" width="4.8" height="5" transform="rotate(-35 12 12)" fill="var(--paper)" opacity=".55" /></svg>
          Baton
        </button>
        {children}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="wrap foot muted small">
      Baton · Team Spectrum · CodePuneThinkers Round 2. Demo data is synthetic, and everything you add stays in this browser.
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
