/**
 * Server-only Supabase helpers for the api/ functions (files starting with "_" are not routes).
 * The secret key bypasses row-level security, so every function checks the caller's membership
 * and role itself before reading or writing anything.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Role = 'reviewer' | 'leaver' | 'successor';

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

let cached: SupabaseClient | null | undefined;
export function adminClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  cached = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return cached;
}

/** The signed-in caller and their role in a project, or an error Response. */
export async function callerRole(request: Request, db: SupabaseClient, projectId: unknown): Promise<{ userId: string; role: Role } | Response> {
  const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return json(401, { error: 'Sign in first.' });
  if (typeof projectId !== 'string' || !/^[0-9a-f-]{36}$/i.test(projectId)) return json(400, { error: 'Missing or invalid projectId.' });
  const { data: u, error: ue } = await db.auth.getUser(token);
  if (ue || !u.user) return json(401, { error: 'Your session has expired. Sign in again.' });
  const { data: m, error: me } = await db.from('members').select('role').eq('project_id', projectId).eq('user_id', u.user.id).maybeSingle();
  if (me) return json(500, { error: 'Could not check your access.' });
  if (!m) return json(403, { error: 'You are not a member of this handover.' });
  return { userId: u.user.id, role: m.role as Role };
}
