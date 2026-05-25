import { NextRequest, NextResponse } from 'next/server';
import { getMasterAssignmentRouteContext, jsonError, MasterAssignmentApiError } from '../../_utils';

type AssignmentRecipientRow = {
  assignment_id: string;
  classroom_id: string;
  user_id: string;
  status: string;
  assigned_at: string;
  completed_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

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

    const { data: recipientRows, error: recipientsError } = await adminClient
      .from('assignment_recipients')
      .select('assignment_id,classroom_id,user_id,status,assigned_at,completed_at')
      .eq('assignment_id', assignmentId)
      .eq('classroom_id', assignment.classroom_id)
      .order('user_id', { ascending: true });

    if (recipientsError) {
      throw new MasterAssignmentApiError(recipientsError.message || 'Failed to load recipients.', 500);
    }

    const recipients = (recipientRows ?? []) as AssignmentRecipientRow[];
    const recipientUserIds = recipients.map((recipient) => recipient.user_id);

    const { data: profileRows, error: profilesError } = recipientUserIds.length
      ? await adminClient
          .from('profiles')
          .select('id,full_name,email')
          .in('id', recipientUserIds)
      : { data: [], error: null };

    if (profilesError) {
      throw new MasterAssignmentApiError(profilesError.message || 'Failed to load recipient profiles.', 500);
    }

    const profilesById = new Map((profileRows as ProfileRow[]).map((profile) => [profile.id, profile]));

    const payload = recipients.map((recipient) => {
      const profile = profilesById.get(recipient.user_id);
      return {
        user_id: recipient.user_id,
        status: recipient.status,
        assigned_at: recipient.assigned_at,
        completed_at: recipient.completed_at,
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
