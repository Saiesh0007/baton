import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Project, Role } from './types';
import { buildDemoProject } from './lib/demo';
import { analyze, isBot, type Analysis } from './lib/analyze';
import { LLM_MODEL, newLlmState, pendingChunks, proposeAll, sendViaApi, toChunkIn, type RunProgress } from './lib/llm';

const KEY = 'baton.v1';

interface Persisted { projects: Project[]; currentId: string | null; role: Role }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      // keep the work, but every fresh load starts on the landing page, not inside the last handover
      if (Array.isArray(p.projects)) return { ...p, currentId: null };
    }
  } catch { /* storage unavailable */ }
  return { projects: [buildDemoProject()], currentId: null, role: 'reviewer' };
}

export interface LlmRun { projectId: string; progress: RunProgress }

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
  /** LLM proposer */
  llmRun: LlmRun | null;
  llmPending: number;
  runLlm: () => void;
  stopLlm: () => void;
  setLlmEnabled: (on: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load);
  const [llmRun, setLlmRun] = useState<LlmRun | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore quota/private mode */ }
  }, [state]);

  const project = state.projects.find((p) => p.id === state.currentId) ?? null;
  const analysis = useMemo(() => (project ? analyze(project) : null), [project]);
  const actorName = project ? ({ reviewer: project.people.reviewer, leaver: project.people.leaver, successor: project.people.successor }[state.role]) : 'User';

  /** update a project by id (an LLM run may finish after the user has opened another project) */
  const patch = (id: string, fn: (p: Project) => Project) =>
    setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? fn(p) : p)) }));

  const llmPending = useMemo(
    () => (project?.llm?.enabled ? pendingChunks(project.chunks, project.sources, project.llm.cache, isBot).length : 0),
    [project],
  );

  const runLlm = () => {
    if (!project?.llm?.enabled || abort.current) return; // one run at a time; a second click does nothing
    const p = project;
    const todo = pendingChunks(p.chunks, p.sources, p.llm!.cache, isBot).map(toChunkIn);
    patch(p.id, (x) => ({ ...x, llm: { ...x.llm!, lastError: undefined } }));
    if (!todo.length) return;
    const ctl = new AbortController();
    abort.current = ctl;
    setLlmRun({ projectId: p.id, progress: { done: 0, total: todo.length } });
    const ws = (p.workstreams.length ? p.workstreams : [{ id: 'general', name: 'General', keywords: [] }]).map((w) => ({ id: w.id, name: w.name, keywords: w.keywords }));
    proposeAll(todo, ws, sendViaApi, {
      signal: ctl.signal,
      onProgress: (progress) => setLlmRun({ projectId: p.id, progress }),
      onBatch: (part) => patch(p.id, (x) => ({ ...x, llm: { ...(x.llm ?? newLlmState()), cache: { ...(x.llm?.cache ?? {}), ...part } } })),
    }).then((res) => {
      const n = Object.keys(res.cache).length;
      patch(p.id, (x) => ({
        ...x,
        llm: { ...(x.llm ?? newLlmState()), ranAt: new Date().toISOString(), lastError: res.error === 'Stopped.' ? 'Paused.' : res.error },
        audit: n ? [{ ts: new Date().toISOString(), actor: 'Baton', action: `LLM proposer (${LLM_MODEL}) analysed ${n} events${res.skipped ? `, skipped ${res.skipped}` : ''}${res.error ? ` · ${res.error}` : ''}` }, ...x.audit].slice(0, 300) : x.audit,
      }));
    }).finally(() => { abort.current = null; setLlmRun(null); });
  };

  // Auto-run when team text is waiting (after an import, a re-sync, or opening the demo).
  // Stops after an error until the user presses retry, so a broken service never loops.
  useEffect(() => {
    if (project?.llm?.enabled && llmPending > 0 && !project.llm.lastError && !abort.current) runLlm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, llmPending, project?.llm?.enabled, project?.llm?.lastError]);

  const store: Store = {
    projects: state.projects,
    project,
    analysis,
    role: state.role,
    actorName,
    llmRun: llmRun && llmRun.projectId === project?.id ? llmRun : null,
    llmPending,
    runLlm,
    stopLlm: () => abort.current?.abort(),
    setLlmEnabled: (on) => {
      if (!project) return;
      if (!on) abort.current?.abort();
      patch(project.id, (x) => ({
        ...x,
        llm: { ...(x.llm ?? newLlmState()), enabled: on, lastError: undefined },
        audit: [{ ts: new Date().toISOString(), actor: actorName, action: on ? `Switched claim proposer to LLM (${LLM_MODEL})` : 'Switched claim proposer to rules' }, ...x.audit].slice(0, 300),
      }));
    },
    setRole: (role) => setState((s) => ({ ...s, role })),
    open: (id) => setState((s) => ({ ...s, currentId: id })),
    update: (fn, auditAction) =>
      setState((s) => ({
        ...s,
        projects: s.projects.map((p) => {
          if (p.id !== s.currentId) return p;
          const next = fn(p);
          if (next === p) return p; // a no-op (e.g. a repeated click) leaves no audit entry
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
