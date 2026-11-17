/**
 * POST /api/publish  { projectId, snapshot }  (reviewer only)
 * Stores a published handover version twice: the reviewer's full copy and the successor's team copy.
 * The team copy is cut here, on the server, with the visibility stored in the database (chunks take
 * their source's visibility by trigger), so leads-only text never reaches a successor.
 */
import { adminClient, callerRole, json } from './_supabase.js';
import { teamSnapshot } from '../src/lib/view.js';
import type { PublishedSnapshot } from '../src/types.js';

const INTERVIEW = 'src-interview'; // exit-interview answers: generated in the app, always team-visible

export async function POST(request: Request): Promise<Response> {
  const db = adminClient();
  if (!db) return json(503, { error: 'Accounts are not configured on this server.' });
  let body: { projectId?: unknown; snapshot?: PublishedSnapshot };
  try { body = (await request.json()) as typeof body; } catch { return json(400, { error: 'Body must be JSON.' }); }
  const who = await callerRole(request, db, body.projectId);
  if (who instanceof Response) return who;
  if (who.role !== 'reviewer') return json(403, { error: 'Only the reviewer can publish.' });
  const projectId = body.projectId as string;
  const snap = body.snapshot;
  if (!snap || !Array.isArray(snap.claims) || !Array.isArray(snap.chunks) || !Array.isArray(snap.sources) || !Number.isInteger(snap.version)) {
    return json(400, { error: 'Invalid snapshot.' });
  }

  const { data: top } = await db.from('published').select('version').eq('project_id', projectId).order('version', { ascending: false }).limit(1).maybeSingle();
  const expected = (top?.version ?? 0) + 1;
  if (snap.version !== expected) return json(409, { error: `Version ${expected - 1} was already published by someone else. Reload and publish again.`, expected });

  // authoritative visibility from the database
  const ids = [...new Set([...snap.chunks.map((c) => c.id), ...snap.claims.flatMap((c) => c.evidence.map((e) => e.chunkId))])].filter((id) => !id.startsWith(INTERVIEW));
  const teamChunks = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await db.from('chunks').select('id').eq('project_id', projectId).eq('visibility', 'team').in('id', ids.slice(i, i + 300));
    if (error) return json(500, { error: 'Could not read source visibility.' });
    data.forEach((r) => teamChunks.add(r.id));
  }
  const { data: srcs, error: se } = await db.from('sources').select('id').eq('project_id', projectId).eq('visibility', 'team');
  if (se) return json(500, { error: 'Could not read source visibility.' });
  const teamSources = new Set(srcs.map((s) => s.id));
  // anything the database does not know about is treated as restricted (fail closed)
  const team = teamSnapshot(snap, (id) => id.startsWith(INTERVIEW) || teamChunks.has(id), (id) => id === INTERVIEW || teamSources.has(id));

  const { error } = await db.from('published').insert([
    { project_id: projectId, version: snap.version, visibility: 'full', snapshot: snap },
    { project_id: projectId, version: snap.version, visibility: 'team', snapshot: team },
  ]);
  if (error) return json(error.code === '23505' ? 409 : 500, { error: error.code === '23505' ? 'This version was just published. Reload.' : 'Could not save the published version.' });
  return json(200, { version: snap.version, teamClaims: team.claims.filter((c) => !c.restricted).length, restricted: team.claims.filter((c) => c.restricted).length });
}
