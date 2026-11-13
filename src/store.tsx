import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Project, Role } from './types';
import { buildDemoProject } from './lib/demo';
import { analyze, type Analysis } from './lib/analyze';

const KEY = 'baton.v1';

interface Persisted { projects: Project[]; currentId: string | null; role: Role }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      if (Array.isArray(p.projects)) return p;
    }
  } catch { /* storage unavailable */ }
  return { projects: [buildDemoProject()], currentId: null, role: 'reviewer' };
}

interface Store {
  projects: Project[];
  project: Project | null;
  analysis: Analysis | null;
  role: Role;
  setRole: (r: Role) => void;
  open: (id: string | null) => void;
  update: (fn: (p: Project) => Project, auditAction?: string) => void;
  addProject: (p: Project) => void;
  removeProject: (id: string) => void;
  resetDemo: () => void;
  actorName: string;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore quota/private mode */ }
  }, [state]);

  const project = state.projects.find((p) => p.id === state.currentId) ?? null;
  const analysis = useMemo(() => (project ? analyze(project) : null), [project]);
  const actorName = project ? ({ reviewer: project.people.reviewer, leaver: project.people.leaver, successor: project.people.successor }[state.role]) : 'User';

  const store: Store = {
    projects: state.projects,
    project,
    analysis,
    role: state.role,
    actorName,
    setRole: (role) => setState((s) => ({ ...s, role })),
    open: (id) => setState((s) => ({ ...s, currentId: id })),
    update: (fn, auditAction) =>
      setState((s) => ({
        ...s,
        projects: s.projects.map((p) => {
          if (p.id !== s.currentId) return p;
          const next = fn(p);
          return auditAction ? { ...next, audit: [{ ts: new Date().toISOString(), actor: actorName, action: auditAction }, ...next.audit].slice(0, 300) } : next;
        }),
      })),
    addProject: (p) => setState((s) => ({ ...s, projects: [p, ...s.projects], currentId: p.id })),
    removeProject: (id) => setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id), currentId: s.currentId === id ? null : s.currentId })),
    resetDemo: () =>
      setState((s) => ({ ...s, projects: [buildDemoProject(), ...s.projects.filter((p) => !p.isDemo)], currentId: 'demo', role: 'reviewer' })),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
