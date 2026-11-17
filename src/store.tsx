import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Project, Role } from './types';
import { buildDemoProject } from './lib/demo';
import { analyze, isBot, type Analysis } from './lib/analyze';
import { LLM_MODEL, newLlmState, pendingChunks, proposeAll, sendViaApi, toChunkIn, type RunProgress } from './lib/llm';
import * as cloud from './lib/cloud';

const KEY = 'baton.v1';

interface Persisted { projects: Project[]; currentId: string | null; role: Role }

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      // keep the work, but every fresh load starts on the landing page, not inside the last handover
      if (Array.isArray(p.projects)) return { ...p, projects: p.projects.filter((x) => !x.cloud), currentId: null };
    }
  } catch { /* storage unavailable */ }
  return { projects: [buildDemoProject()], currentId: null, role: 'reviewer' };
}

export interface LlmRun { projectId: string; progress: RunProgress }
export type SaveState = { state: 'saved' | 'saving' | 'unsaved' | 'error'; error?: string };

interface CloudOpen { project: Project; role: Role }

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
  /** shared handovers (Supabase) */
  cloudEnabled: boolean;
  session: Session | null;
  userName: string;
  cloudList: cloud.CloudItem[];
  isCloud: boolean;
  busy: string;
  cloudError: string;
  save: SaveState;
  openCloud: (id: string) => Promise<void>;
  createShared: (p: Project) => Promise<void>;
  joinInvite: (token: string) => Promise<void>;
  deleteShared: (id: string) => Promise<void>;
  reloadCloud: () => Promise<void>;
  refreshList: () => Promise<void>;
  clearCloudError: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load);
  const [llmRun, setLlmRun] = useState<LlmRun | null>(null);
  const abort = useRef<AbortController | null>(null);

  // shared handovers
  const [session, setSession] = useState<Session | null>(null);
  const [cloudList, setCloudList] = useState<cloud.CloudItem[]>([]);
  const [shared, setShared] = useState<CloudOpen | null>(null);
  const [busy, setBusy] = useState('');
  const [cloudError, setCloudError] = useState('');
  const [save, setSave] = useState<SaveState>({ state: 'saved' });
  const lastSaved = useRef<Project | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore quota/private mode */ }
  }, [state]);

  const isCloud = !!shared && shared.project.id === state.currentId;
  const project = isCloud ? shared!.project : state.projects.find((p) => p.id === state.currentId) ?? null;
  const role: Role = isCloud ? shared!.role : state.role;
  const analysis = useMemo(() => (project ? analyze(project) : null), [project]);
  const actorName = project ? ({ reviewer: project.people.reviewer, leaver: project.people.leaver, successor: project.people.successor }[role]) : 'User';

  /** update a project by id (an LLM run may finish after the user has opened another project) */
  const patch = useCallback((id: string, fn: (p: Project) => Project) => {
    setShared((s) => (s && s.project.id === id ? { ...s, project: fn(s.project) } : s));
    setState((s) => (s.projects.some((p) => p.id === id) ? { ...s, projects: s.projects.map((p) => (p.id === id ? fn(p) : p)) } : s));
  }, []);

  /* ------------------------------------------------ accounts */

  const refreshList = useCallback(async () => {
    if (!cloud.cloudEnabled) return;
    try { setCloudList(await cloud.listProjects()); } catch (e) { setCloudError((e as Error).message); }
  }, []);

  useEffect(() => {
    const db = cloud.supabase();
    if (!db) return;
    db.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = db.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setShared(null); setCloudList([]); lastSaved.current = null; }
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  const userId = session?.user.id;
  useEffect(() => { if (userId) refreshList(); }, [userId, refreshList]);

  const openCloud = async (id: string) => {
    setBusy('Opening handover…'); setCloudError('');
    try {
      const { project: p, role: r } = await cloud.loadProject(id);
      lastSaved.current = p;
      setSave({ state: 'saved' });
      setShared({ project: p, role: r });
      setState((s) => ({ ...s, currentId: p.id }));
    } catch (e) { setCloudError((e as Error).message); }
    setBusy('');
  };

  /** save what changed, one save at a time; a failed save is retried with the next change or on reload */
  const flush = useCallback(async () => {
    if (saving.current || !shared || !lastSaved.current || shared.project === lastSaved.current) return;
    if (shared.project.id !== lastSaved.current.id) return;
    saving.current = true;
    const target = shared.project;
    setSave({ state: 'saving' });
    try {
      await cloud.saveProject(lastSaved.current, target, shared.role);
      lastSaved.current = target;
      setSave({ state: 'saved' });
    } catch (e) {
      setSave({ state: 'error', error: (e as Error).message });
    } finally {
      saving.current = false;
    }
  }, [shared]);

  useEffect(() => {
    if (!shared || shared.project === lastSaved.current) return;
    setSave((s) => (s.state === 'error' || s.state === 'saving' ? s : { state: 'unsaved' }));
    const t = setTimeout(flush, 700);
    return () => clearTimeout(t);
  }, [shared, flush, save.state]);

  // warn before closing the tab with unsaved shared changes
  useEffect(() => {
    if (!(isCloud && save.state !== 'saved')) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [isCloud, save.state]);

  // others may have changed the handover: pick that up when the tab comes back, if nothing is unsaved here
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !shared || saving.current || shared.project !== lastSaved.current || abort.current) return;
      cloud.loadProject(shared.project.id).then(({ project: p, role: r }) => {
        if (JSON.stringify(p) === JSON.stringify(lastSaved.current)) return;
        lastSaved.current = p;
        setShared((s) => (s && s.project.id === p.id ? { project: p, role: r } : s));
      }).catch(() => { /* offline: keep what is on screen */ });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [shared]);

  const createShared = async (p: Project) => {
    setBusy('Creating shared handover…'); setCloudError('');
    try {
      const id = await cloud.createProject(p);
      await refreshList();
      setBusy('');
      await openCloud(id);
    } catch (e) { setCloudError((e as Error).message); setBusy(''); }
  };

  const joinInvite = async (token: string) => {
    setBusy('Joining…'); setCloudError('');
    try {
      const id = await cloud.acceptInvite(token, cloud.displayName(session));
      await refreshList();
      setBusy('');
      await openCloud(id);
    } catch (e) { setCloudError((e as Error).message); setBusy(''); }
  };

  const deleteShared = async (id: string) => {
    setCloudError('');
    try { await cloud.deleteProject(id); await refreshList(); } catch (e) { setCloudError((e as Error).message); }
  };

  /* ------------------------------------------------ LLM proposer */

  const llmPending = useMemo(
    () => (project?.llm?.enabled && role !== 'successor' ? pendingChunks(project.chunks, project.sources, project.llm.cache, isBot).length : 0),
    [project, role],
  );

  const runLlm = () => {
    if (!project?.llm?.enabled || abort.current || role === 'successor') return; // one run at a time
    if (isCloud && save.state !== 'saved') return; // the server reads saved text; the run starts once saved
    const p = project;
    const todo = pendingChunks(p.chunks, p.sources, p.llm!.cache, isBot).map(toChunkIn);
    patch(p.id, (x) => ({ ...x, llm: { ...x.llm!, lastError: undefined } }));
    if (!todo.length) return;
    const ctl = new AbortController();
    abort.current = ctl;
    setLlmRun({ projectId: p.id, progress: { done: 0, total: todo.length } });
    const ws = (p.workstreams.length ? p.workstreams : [{ id: 'general', name: 'General', keywords: [] }]).map((w) => ({ id: w.id, name: w.name, keywords: w.keywords }));
    // shared handovers send chunk ids only; the server reads the (team-visible) text itself
    const send = isCloud ? cloud.cloudSender(p.id) : sendViaApi;
    proposeAll(todo, ws, send, {
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
  // In a shared handover the server reads the text from the database, so wait until it is saved.
  const savedForLlm = !isCloud || save.state === 'saved';
  useEffect(() => {
    if (project?.llm?.enabled && llmPending > 0 && !project.llm.lastError && !abort.current && savedForLlm) runLlm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, llmPending, project?.llm?.enabled, project?.llm?.lastError, savedForLlm]);

  const store: Store = {
    projects: state.projects,
    project,
    analysis,
    role,
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
    // in a shared handover your role comes from your membership; the switcher is only for this-browser handovers
    setRole: (r) => { if (!isCloud) setState((s) => ({ ...s, role: r })); },
    open: (id) => {
      if (id === null && isCloud && save.state !== 'saved') flush();
      setState((s) => ({ ...s, currentId: id }));
    },
    update: (fn, auditAction) => {
      const apply = (p: Project) => {
        const next = fn(p);
        if (next === p) return p; // a no-op (e.g. a repeated click) leaves no audit entry
        return auditAction ? { ...next, audit: [{ ts: new Date().toISOString(), actor: actorName, action: auditAction }, ...next.audit].slice(0, 300) } : next;
      };
      if (isCloud) { setShared((s) => (s ? { ...s, project: apply(s.project) } : s)); return; }
      setState((s) => ({ ...s, projects: s.projects.map((p) => (p.id === s.currentId ? apply(p) : p)) }));
    },
    addProject: (p) => setState((s) => ({ ...s, projects: [p, ...s.projects], currentId: p.id })),
    removeProject: (id) => setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id), currentId: s.currentId === id ? null : s.currentId })),
    resetDemo: () =>
      setState((s) => ({ ...s, projects: [buildDemoProject(), ...s.projects.filter((p) => !p.isDemo)], currentId: 'demo', role: 'reviewer' })),
    cloudEnabled: cloud.cloudEnabled,
    session,
    userName: cloud.displayName(session),
    cloudList,
    isCloud,
    busy,
    cloudError,
    save,
    openCloud,
    createShared,
    joinInvite,
    deleteShared,
    reloadCloud: async () => { if (shared) await openCloud(shared.project.id); },
    refreshList,
    clearCloudError: () => setCloudError(''),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
