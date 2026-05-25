import { NextRequest, NextResponse } from 'next/server';
import { SECTIONS } from '@/lib/course/algebra1';
import { getMasterAssignmentRouteContext, jsonError, normalizeDate } from './_utils';

const VALID = new Set(SECTIONS.map((s) => s.id));
const SEL = 'id, classroom_id, title, description, due_date, section_id, created_by, created_at, updated_at, archived_at';
type AssignmentRow = { id: string; classroom_id: string; title: string; description: string | null; due_date: string | null; section_id: string | null; created_by: string; created_at: string; updated_at: string | null; archived_at: string | null; classrooms?: { name?: string | null; profiles?: { full_name?: string | null; email?: string | null }[] | null }[] | null };
type RecipientStatusRow = { assignment_id: string; status: string | null };

export async function GET(req: NextRequest) { try {
  const { adminClient } = await getMasterAssignmentRouteContext(req);
  const { data, error } = await adminClient.from('assignments').select(`${SEL}, classrooms(name, teacher_id, profiles!classrooms_teacher_id_fkey(full_name,email))`).order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message || 'Failed to load assignments.' }, { status: 500 });
  const assignments = (data ?? []) as unknown as AssignmentRow[];
  const ids = assignments.map((a) => a.id);
  const recipients: RecipientStatusRow[] = ids.length ? (((await adminClient.from('assignment_recipients').select('assignment_id,status').in('assignment_id', ids)).data ?? []) as RecipientStatusRow[]) : [];
  const by = new Map<string, AssignmentRow & { classroom_name: string | null; teacher_name: string | null; teacher_email: string | null; recipient_count: number; completed_count: number; incomplete_count: number; excused_count: number }>();
  assignments.forEach((a) => { const classroom = a.classrooms?.[0]; const teacher = classroom?.profiles?.[0]; by.set(a.id, { ...a, classroom_name: classroom?.name ?? null, teacher_name: teacher?.full_name ?? null, teacher_email: teacher?.email ?? null, recipient_count: 0, completed_count: 0, incomplete_count: 0, excused_count: 0 }); });
  recipients.forEach((r) => { const x = by.get(r.assignment_id); if (!x) return; x.recipient_count += 1; if (r.status === 'completed') x.completed_count += 1; else if (r.status === 'excused') x.excused_count += 1; else x.incomplete_count += 1; });
  return NextResponse.json({ assignments: [...by.values()] });
} catch (e) { return jsonError(e); } }

export async function POST(req: NextRequest) { try {
  const { adminClient, user } = await getMasterAssignmentRouteContext(req);
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  const classroomId = String(b?.classroom_id || '').trim(); const title = String(b?.title || '').trim(); const description = String(b?.description || '').trim() || null; const dueDate = normalizeDate(b?.due_date); const sectionId = String(b?.section_id || '').trim(); const target = b?.target === 'students' ? 'students' : 'class'; const recipientUserIds = Array.isArray(b?.recipient_user_ids) ? [...new Set(b.recipient_user_ids.map(String).filter(Boolean))] : [];
  if (!classroomId) return NextResponse.json({ error: 'Please select a classroom.' }, { status: 400 }); if (!title) return NextResponse.json({ error: 'Assignment title is required.' }, { status: 400 }); if (!sectionId || !VALID.has(sectionId)) return NextResponse.json({ error: 'Please select a valid Algebra 1 section.' }, { status: 400 }); if (target === 'students' && recipientUserIds.length===0) return NextResponse.json({ error: 'Please select at least one student.' }, { status: 400 });
  const { data: roster } = await adminClient.from('classroom_members').select('user_id').eq('classroom_id', classroomId); const set = new Set(((roster ?? []) as { user_id: string }[]).map((r) => r.user_id)); const recipients = target === 'class' ? [...set] : recipientUserIds; if (recipients.some((id) => !set.has(id))) return NextResponse.json({ error: 'Selected students must belong to this classroom.' }, { status: 400 }); if (!recipients.length) return NextResponse.json({ error: 'This classroom has no students to assign.' }, { status: 400 });
  const { data: assignment, error } = await adminClient.from('assignments').insert({ classroom_id: classroomId, title, description, due_date: dueDate, section_id: sectionId, created_by: user.id }).select(SEL).single(); if (error || !assignment) return NextResponse.json({ error: error?.message || 'Failed to create assignment.' }, { status: 500 });
  const created = assignment as AssignmentRow;
  const { error: recErr } = await adminClient.from('assignment_recipients').insert(recipients.map((uid) => ({ assignment_id: created.id, classroom_id: classroomId, user_id: uid, assigned_by: user.id, status: 'assigned' })));
  if (recErr) { await adminClient.from('assignments').delete().eq('id', created.id); return NextResponse.json({ error: recErr.message || 'Failed to save recipients.' }, { status: 500 }); }
  return NextResponse.json({ assignment: { ...created, recipient_count: recipients.length } }, { status: 201 });
} catch (e) { return jsonError(e); } }
