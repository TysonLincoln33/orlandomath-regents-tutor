import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type ClassroomRow = { id: string; name: string; subject: string | null; term: string | null; class_code: string; teacher_id: string };
type MemberRow = { classroom_id: string; user_id: string; joined_at: string; joined_via: string | null };
type ProfileRow = { id: string; full_name: string | null; email: string | null };
type AssignmentRow = { classroom_id: string };
const code = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

async function getClients(req: NextRequest) { /* unchanged simplified */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL; const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) throw new Error('Missing Supabase environment variables.');
  const token = req.headers.get('authorization')?.replace('Bearer ', ''); if (!token) return { error: NextResponse.json({ error: 'Missing authorization token.' }, { status: 401 }) } as const;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await userClient.auth.getUser(); if (error || !user) return { error: NextResponse.json({ error: error?.message || 'Unauthorized.' }, { status: 401 }) } as const;
  const { data: profile } = await adminClient.from('profiles').select('role,approval_status').eq('id', user.id).maybeSingle(); if (!profile || profile.role !== 'master' || profile.approval_status !== 'approved') return { error: NextResponse.json({ error: 'Master access required.' }, { status: 403 }) } as const;
  return { adminClient, user } as const;
}

export async function GET(req: NextRequest) { try { const ctx = await getClients(req); if ('error' in ctx) return ctx.error;
  const { data: classroomsRaw, error } = await ctx.adminClient.from('classrooms').select('id,name,subject,term,class_code,teacher_id,created_at'); if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const classrooms = (classroomsRaw ?? []) as ClassroomRow[]; const ids = classrooms.map((c) => c.id); const teacherIds = [...new Set(classrooms.map((c) => c.teacher_id))];
  const { data: teachersRaw } = await ctx.adminClient.from('profiles').select('id,full_name,email').in('id', teacherIds);
  const { data: membersRaw } = await ctx.adminClient.from('classroom_members').select('classroom_id,user_id,joined_at,joined_via').in('classroom_id', ids);
  const { data: assignmentsRaw } = await ctx.adminClient.from('assignments').select('id,classroom_id').in('classroom_id', ids);
  const members = (membersRaw ?? []) as MemberRow[]; const teachers = (teachersRaw ?? []) as ProfileRow[]; const assignments = (assignmentsRaw ?? []) as AssignmentRow[];
  const studentIds = [...new Set(members.map((m) => m.user_id))]; const { data: studentProfilesRaw } = await ctx.adminClient.from('profiles').select('id,full_name,email').in('id', studentIds);
  const teacherMap = new Map(teachers.map((t) => [t.id, t])); const studentMap = new Map(((studentProfilesRaw ?? []) as ProfileRow[]).map((s) => [s.id, s]));
  const membersByClass = new Map<string, MemberRow[]>(); members.forEach((m) => membersByClass.set(m.classroom_id, [...(membersByClass.get(m.classroom_id) ?? []), m]));
  const assignmentCount = new Map<string, number>(); assignments.forEach((a) => assignmentCount.set(a.classroom_id, (assignmentCount.get(a.classroom_id) ?? 0) + 1));
  return NextResponse.json(classrooms.map((c) => { const ms = membersByClass.get(c.id) ?? []; return { ...c, teacher_name: teacherMap.get(c.teacher_id)?.full_name ?? null, teacher_email: teacherMap.get(c.teacher_id)?.email ?? null, roster_count: ms.length, assignment_count: assignmentCount.get(c.id) ?? 0, members: ms.map((m) => ({ ...m, full_name: studentMap.get(m.user_id)?.full_name ?? null, email: studentMap.get(m.user_id)?.email ?? null })) }; }));
} catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed.' }, { status: 500 }); } }

export async function POST(req: NextRequest) { try { const ctx = await getClients(req); if ('error' in ctx) return ctx.error; const body = await req.json().catch(() => null); const name = String(body?.name || '').trim(); if (!name) return NextResponse.json({ error: 'Classroom name is required.' }, { status: 400 }); const { data, error } = await ctx.adminClient.from('classrooms').insert({ teacher_id: ctx.user.id, name, subject: body?.subject || null, term: body?.term || null, class_code: code() }).select('*').single(); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ ...data, teacher_name: null, teacher_email: null, roster_count: 0, assignment_count: 0, members: [] }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed.' }, { status: 500 }); } }
