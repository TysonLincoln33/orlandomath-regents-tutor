import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type MasterClassroomMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  joined_at: string;
  joined_via: string | null;
};

export type MasterClassroomRow = {
  id: string;
  name: string;
  subject: string | null;
  term: string | null;
  class_code: string;
  teacher_id: string;
  teacher_name: string | null;
  teacher_email: string | null;
  roster_count: number;
  assignment_count: number;
  members: MasterClassroomMember[];
};

export type SearchStudentResult = {
  id: string;
  full_name: string | null;
  email: string | null;
  already_in_classroom: boolean;
};

async function authedFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const supabase = getSupabaseBrowserClient() as unknown as { auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null }; error: { message?: string } | null }> } };
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message || 'Failed to verify session.');
  if (!session?.access_token) throw new Error('Please sign in again.');

  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...(init?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || 'Request failed.');
  return payload as T;
}

export const getMasterClassrooms = () => authedFetch<MasterClassroomRow[]>('/api/master/classrooms');
export const createMasterClassroom = (body: { name: string; subject?: string; term?: string }) => authedFetch<MasterClassroomRow>('/api/master/classrooms', { method: 'POST', body: JSON.stringify(body) });
export const searchMasterStudents = (classroomId: string, q: string) => authedFetch<SearchStudentResult[]>(`/api/master/students?classroomId=${encodeURIComponent(classroomId)}&q=${encodeURIComponent(q)}`);
export const addMasterStudents = (classroomId: string, studentUserIds: string[]) => authedFetch<{ added_count: number; already_enrolled_count: number }>(`/api/master/classrooms/${classroomId}/members`, { method: 'POST', body: JSON.stringify({ studentUserIds }) });
export const removeMasterStudent = (classroomId: string, userId: string) => authedFetch<{ ok: true }>(`/api/master/classrooms/${classroomId}/members/${userId}`, { method: 'DELETE' });
export const moveMasterStudent = (classroomId: string, userId: string, toClassroomId: string) => authedFetch<{ ok: true }>(`/api/master/classrooms/${classroomId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ toClassroomId }) });
export const createMasterStudent = (classroomId: string, full_name: string, email: string) => authedFetch<{ user_id: string; full_name: string | null; email: string; status: string }>(`/api/master/classrooms/${classroomId}/members`, { method: 'PUT', body: JSON.stringify({ full_name, email }) });
