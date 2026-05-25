import { NextRequest, NextResponse } from 'next/server';
import { getMasterAssignmentRouteContext, jsonError } from '../../../_utils';
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ assignmentId: string; userId: string }> }) { try {
  const { assignmentId, userId } = await params; const { adminClient } = await getMasterAssignmentRouteContext(req); const b = await req.json().catch(() => null); const status = String(b?.status || '').trim();
  if (status !== 'assigned' && status !== 'excused') return NextResponse.json({ error: 'Recipient status must be assigned or excused.' }, { status: 400 });
  const { data: assignment } = await adminClient.from('assignments').select('classroom_id').eq('id', assignmentId).single(); const classroomId = (assignment as { classroom_id: string }).classroom_id;
  const { data, error } = await adminClient.from('assignment_recipients').update({ status }).eq('assignment_id', assignmentId).eq('classroom_id', classroomId).eq('user_id', userId).select('*').single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Failed to update recipient status.' }, { status: 500 });
  return NextResponse.json({ recipient: data });
} catch (e) { return jsonError(e); } }
