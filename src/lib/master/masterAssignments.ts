import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type MasterAssignment = { id: string; classroom_id: string; title: string; description: string | null; due_date: string | null; section_id: string | null; created_by: string; created_at: string; updated_at: string | null; archived_at: string | null; classroom_name?: string | null; teacher_name?: string | null; teacher_email?: string | null; recipient_count?: number; completed_count?: number; incomplete_count?: number; excused_count?: number; };
export type MasterAssignmentRecipient = { user_id: string; full_name: string | null; email: string | null; status: string; completion_percent: number | string | null; accuracy_percent: number | string | null; questions_correct: number | string | null; questions_attempted: number | string | null; last_activity_at: string | null; };

type SessionClient = { auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null }; error: { message?: string } | null }> } };

async function authedFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const supabase = getSupabaseBrowserClient() as unknown as SessionClient;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message || 'Failed to verify session.');
  if (!session?.access_token) throw new Error('Please sign in again.');
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers || {}) } });
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error((payload as { error?: string } | null)?.error || 'Request failed.');
  return payload as T;
}

export const listMasterAssignments = () => authedFetch<{ assignments: MasterAssignment[] }>('/api/master/assignments');
export const createMasterAssignment = (body: Record<string, unknown>) => authedFetch<{ assignments: MasterAssignment[]; created_count: number }>('/api/master/assignments', { method: 'POST', body: JSON.stringify(body) });
export const updateMasterAssignment = (assignmentId: string, body: Record<string, unknown>) => authedFetch<{ assignment: MasterAssignment }>(`/api/master/assignments/${assignmentId}`, { method: 'PATCH', body: JSON.stringify(body) });
export const archiveMasterAssignment = (assignmentId: string) => updateMasterAssignment(assignmentId, { archived: true });
export const getMasterAssignmentRecipients = (assignmentId: string) => authedFetch<{ assignment: MasterAssignment; recipients: MasterAssignmentRecipient[] }>(`/api/master/assignments/${assignmentId}/recipients`);
export const updateMasterAssignmentRecipient = (assignmentId: string, userId: string, status: 'assigned'|'excused') => authedFetch<{ recipient: MasterAssignmentRecipient }>(`/api/master/assignments/${assignmentId}/recipients/${userId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
