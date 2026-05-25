import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export class MasterAssignmentApiError extends Error { constructor(message: string, public status: number) { super(message); }}
export function jsonError(error: unknown, fallback = 'Unexpected server error.') { if (error instanceof MasterAssignmentApiError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: error instanceof Error ? error.message : fallback }, { status: 500 }); }
export function normalizeDate(value: unknown) { const raw = typeof value === 'string' ? value.trim() : ''; if (!raw) return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new MasterAssignmentApiError('Due date must use YYYY-MM-DD format.', 400); return raw; }

export async function getMasterAssignmentRouteContext(req: NextRequest): Promise<{ adminClient: SupabaseClient; user: User; }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !srv) throw new MasterAssignmentApiError('Missing Supabase environment variables.', 500);
  const token = req.headers.get('authorization')?.replace('Bearer ', ''); if (!token) throw new MasterAssignmentApiError('Missing authorization token.', 401);
  const userClient = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const adminClient = createClient(url, srv, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await userClient.auth.getUser(); if (userError || !user) throw new MasterAssignmentApiError(userError?.message || 'Unauthorized.', 401);
  const { data: p, error: pErr } = await adminClient.from('profiles').select('role,approval_status').eq('id', user.id).maybeSingle();
  if (pErr) throw new MasterAssignmentApiError(pErr.message || 'Failed to verify profile.', 500);
  if (!p || p.role !== 'master' || p.approval_status !== 'approved') throw new MasterAssignmentApiError('Master access required.', 403);
  return { adminClient, user };
}
