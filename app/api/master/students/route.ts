import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type StudentRow = { id: string; full_name: string | null; email: string | null };
type MemberRow = { user_id: string };

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !srv) return NextResponse.json({ error: 'Missing Supabase environment variables.' }, { status: 500 });
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 });

  const userClient = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const adminClient = createClient(url, srv);
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { data: p } = await adminClient.from('profiles').select('role,approval_status').eq('id', user.id).maybeSingle();
  if (!p || p.role !== 'master' || p.approval_status !== 'approved') return NextResponse.json({ error: 'Master access required.' }, { status: 403 });

  const search = (req.nextUrl.searchParams.get('q') || '').trim();
  const classroomId = req.nextUrl.searchParams.get('classroomId') || '';
  if (search.length < 2) return NextResponse.json([]);

  const like = `%${search}%`;
  const { data: studentsRaw, error } = await adminClient.from('profiles').select('id,full_name,email').eq('role', 'student').or(`full_name.ilike.${like},email.ilike.${like}`).limit(25);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const students = (studentsRaw ?? []) as StudentRow[];
  const ids = students.map((s) => s.id);
  const { data: membersRaw } = await adminClient.from('classroom_members').select('user_id').eq('classroom_id', classroomId).in('user_id', ids);
  const set = new Set(((membersRaw ?? []) as MemberRow[]).map((m) => m.user_id));
  return NextResponse.json(students.map((s) => ({ ...s, already_in_classroom: set.has(s.id) })));
}
