import { useEffect, useState } from 'react';
import { useStore } from '../store';
import * as cloud from '../lib/cloud';
import { fmtDate } from '../lib/text';
import type { Role } from '../types';

const ROLE_LABEL: Record<Role, string> = { reviewer: 'Reviewer', leaver: 'Leaver', successor: 'Successor' };

/** Sign in / create account. Email confirmation is off, so a new account is signed in straight away. */
export function AuthForm({ title, note }: { title?: string; note?: string }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [f, setF] = useState({ email: '', password: '', name: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) { setErr('Enter a valid email address.'); return; }
    if (f.password.length < 8) { setErr('Use a password of at least 8 characters.'); return; }
    if (mode === 'up' && !f.name.trim()) { setErr('Enter your name; your team sees it.'); return; }
    setBusy(true);
    try {
      if (mode === 'in') await cloud.signIn(f.email.trim(), f.password);
      else await cloud.signUp(f.email.trim(), f.password, f.name.trim());
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  };
  return (
    <form className="form auth" onSubmit={submit} noValidate>
      {title && <h3>{title}</h3>}
      {note && <p className="muted small">{note}</p>}
      <div className="seg-ctl" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Sign in</button>
        <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>Create account</button>
      </div>
      {mode === 'up' && <label>Your name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>}
      <label>Email<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
      <label>Password<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
      {err && <div className="alert bad" role="alert">{err}</div>}
      <div><button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button></div>
    </form>
  );
}

/** Home page card: account + the shared handovers you belong to. */
export function SharedHandovers({ onNew }: { onNew: () => void }) {
  const { cloudEnabled, session, userName, cloudList, openCloud, deleteShared, busy, cloudError, clearCloudError, createShared } = useStore();
  if (!cloudEnabled) return null;
  if (!session) {
    return (
      <section className="card shared">
        <div className="grid2">
          <div>
            <h3>Shared handovers</h3>
            <p className="muted">Sign in to work on one handover as a team: the reviewer, the person leaving and the successor each get their own account and only see what their role allows.
              Leads-only sources are filtered by the database itself, so they never reach the successor's browser.</p>
            <p className="muted small">The demo above needs no account.</p>
          </div>
          <AuthForm />
        </div>
      </section>
    );
  }
  return (
    <section className="card shared">
      <div className="card-head">
        <h3>Shared handovers</h3>
        <div className="row gap wrap">
          <span className="muted small">Signed in as <b>{userName}</b> ({session.user.email})</span>
          <button className="btn ghost sm" onClick={() => cloud.signOut()}>Sign out</button>
        </div>
      </div>
      {cloudError && <div className="alert bad" role="alert">{cloudError} <button className="link" onClick={clearCloudError}>Dismiss</button></div>}
      {busy && <div className="muted small" role="status">{busy}</div>}
      {cloudList.length === 0 ? (
        <p className="muted">No shared handovers yet. Start one, or copy the demo into your account to try roles and invites.</p>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <tbody>
              {cloudList.map((p) => (
                <tr key={p.id}>
                  <td><button className="link" disabled={!!busy} onClick={() => openCloud(p.id)}>{p.name}</button></td>
                  <td><span className="pill p-grey">{ROLE_LABEL[p.role]}</span></td>
                  <td className="muted mono">{fmtDate(p.createdAt)}</td>
                  <td>{p.role === 'reviewer' && <button className="btn ghost sm" onClick={() => { if (confirm(`Delete "${p.name}" for everyone? This cannot be undone.`)) deleteShared(p.id); }}>Delete</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row gap wrap">
        <button className="btn primary sm" disabled={!!busy} onClick={onNew}>New shared handover</button>
        <button className="btn sm" disabled={!!busy} onClick={async () => { const { buildDemoProject } = await import('../lib/demo'); await createShared({ ...buildDemoProject(), name: 'Spark Fest tech team (demo copy)', isDemo: false }); }}>Copy the demo into my account</button>
      </div>
    </section>
  );
}

/** Shown for /join/<token>: sign in (or create an account), then join with the invite's role. */
export function JoinScreen({ token, done }: { token: string; done: () => void }) {
  const { session, joinInvite, busy, cloudError, cloudEnabled } = useStore();
  if (!cloudEnabled) return <div className="card"><p>Accounts are not set up on this deployment.</p></div>;
  return (
    <section className="card join">
      <h2>Join a handover</h2>
      {!session ? (
        <AuthForm note="You were invited to a Baton handover. Sign in or create an account to join; your role comes with the invite." />
      ) : (
        <>
          <p>Signed in as <b>{session.user.email}</b>. Join with the role this invite gives you.</p>
          {cloudError && <div className="alert bad" role="alert">{cloudError}</div>}
          <div className="row gap">
            <button className="btn primary" disabled={!!busy} onClick={async () => { await joinInvite(token); done(); }}>{busy || 'Join handover'}</button>
            <button className="btn ghost" onClick={done}>Not now</button>
          </div>
        </>
      )}
    </section>
  );
}

/** Reviewer's team panel in a shared handover: members and invite links per role. */
export function TeamPanel() {
  const { project, isCloud, role } = useStore();
  const [members, setMembers] = useState<cloud.Member[] | null>(null);
  const [links, setLinks] = useState<Partial<Record<Role, string>>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<Role | ''>('');
  const pid = isCloud ? project?.id : undefined;
  useEffect(() => {
    if (!pid) return;
    let live = true;
    cloud.listMembers(pid).then((m) => { if (live) setMembers(m); }, (e) => { if (live) setErr((e as Error).message); });
    return () => { live = false; };
  }, [pid]);
  if (!project || !isCloud) return null;
  const invite = async (r: Role) => {
    if (busy) return;
    setBusy(r); setErr('');
    try {
      const token = await cloud.createInvite(project.id, r);
      const url = `${window.location.origin}/join/${token}`;
      setLinks((l) => ({ ...l, [r]: url }));
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard blocked: the link is shown to copy by hand */ }
    } catch (e) { setErr((e as Error).message); }
    setBusy('');
  };
  return (
    <div className="card team">
      <h3>Team</h3>
      {err && <div className="alert bad" role="alert">{err}</div>}
      <ul className="members">
        {(members ?? []).map((m) => <li key={m.userId}><b>{m.name || 'Member'}</b> <span className="pill p-grey">{ROLE_LABEL[m.role]}</span> <span className="muted small">joined {fmtDate(m.joinedAt)}</span></li>)}
        {members === null && !err && <li className="muted small">Loading…</li>}
      </ul>
      {role === 'reviewer' ? (
        <>
          <p className="muted small">Invite people with a one-time link (valid 14 days). The successor only ever receives team-visible content.</p>
          <div className="row gap wrap">
            {(['leaver', 'successor', 'reviewer'] as Role[]).map((r) => (
              <button key={r} className="btn sm" disabled={!!busy} onClick={() => invite(r)}>{busy === r ? 'Creating…' : `Invite ${ROLE_LABEL[r].toLowerCase()}`}</button>
            ))}
          </div>
          {(Object.entries(links) as [Role, string][]).map(([r, url]) => (
            <div key={r} className="invite-link small"><span className="muted">{ROLE_LABEL[r]} link (copied):</span> <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label={`${ROLE_LABEL[r]} invite link`} /></div>
          ))}
        </>
      ) : <p className="muted small">Only the reviewer can invite people.</p>}
    </div>
  );
}
