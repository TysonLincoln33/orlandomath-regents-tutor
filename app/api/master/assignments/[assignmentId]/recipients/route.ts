import { NextRequest, NextResponse } from 'next/server';
import { getMasterAssignmentRouteContext, jsonError, MasterAssignmentApiError } from '../../_utils';

export async function GET(req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const { assignmentId } = await params;
    const { adminClient } = await getMasterAssignmentRouteContext(req);

    const { data: assignment, error: assignmentError } = await adminClient
      .from('assignments')
      .select('id,classroom_id,title,description,due_date,section_id,created_at,updated_at,archived_at,created_by')
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignmentError) {
      throw new MasterAssignmentApiError(assignmentError.message || 'Failed to load assignment.', 500);
    }

    if (!assignment) {
      throw new MasterAssignmentApiError('Assignment not found.', 404);
    }

    const { data: recipients, error: recipientsError } = await adminClient
      .from('assignment_recipients')
      .select('user_id,status,profiles!inner(full_name,email)')
      .eq('assignment_id', assignmentId)
      .eq('classroom_id', assignment.classroom_id)
      .order('user_id', { ascending: true });

    if (recipientsError) {
      throw new MasterAssignmentApiError(recipientsError.message || 'Failed to load recipients.', 500);
    }

    const payload = (recipients ?? []).map((recipient) => {
      const profile = Array.isArray(recipient.profiles) ? recipient.profiles[0] : recipient.profiles;
      return {
        user_id: recipient.user_id,
        status: recipient.status,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        completion_percent: 0,
        accuracy_percent: 0,
        questions_correct: 0,
        questions_attempted: 0,
        last_activity_at: null,
      };
    });

    return NextResponse.json({ assignment, recipients: payload });
  } catch (e) {
    return jsonError(e);
  }
}
