import { NextRequest, NextResponse } from 'next/server';
import { getMasterAssignmentRouteContext, jsonError } from '../../_utils';
export async function GET(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) { try {
  const { assignmentId } = await params; const { adminClient } = await getMasterAssignmentRouteContext(req);
  const { data: assignment } = await adminClient.from('assignments').select('id,classroom_id,title,description,due_date,section_id,created_at,updated_at,archived_at,created_by').eq('id', assignmentId).single();
  const { data, error } = await adminClient.rpc('get_teacher_assignment_recipients', { p_classroom_id: (assignment as { classroom_id: string }).classroom_id, p_assignment_id: assignmentId });
  if (error) return NextResponse.json({ error: error.message || 'Failed to load recipients.' }, { status: 500 });
  return NextResponse.json({ assignment, recipients: data ?? [] });
} catch (e) { return jsonError(e); } }
