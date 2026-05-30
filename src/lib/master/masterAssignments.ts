import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type AssignmentGroupable = {
  id?: string;
  assignment_id?: string;
  classroom_id: string;
  classroom_name?: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  section_id: string | null;
  created_by?: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  teacher_email?: string | null;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
  recipient_count?: number | string | null;
  completed_count?: number | string | null;
  incomplete_count?: number | string | null;
  excused_count?: number | string | null;
};

export type MasterAssignment = {
  id: string;
  classroom_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  section_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  archived_at: string | null;
  classroom_name?: string | null;
  teacher_name?: string | null;
  teacher_email?: string | null;
  recipient_count?: number;
  completed_count?: number;
  incomplete_count?: number;
  excused_count?: number;
};

export type MasterAssignmentRecipient = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  status: 'assigned' | 'excused';
  completion_percent: number | string | null;
  accuracy_percent: number | string | null;
  questions_attempted: number | string | null;
  questions_correct: number | string | null;
  last_activity_at: string | null;
};

export type MasterAssignmentGroup<T extends AssignmentGroupable> = {
  id: string;
  assignments: T[];
  title: string;
  description: string | null;
  classroomId: string;
  classroomName: string | null;
  teacherName: string | null;
  teacherEmail: string | null;
  dueDate: string | null;
  createdAtStart: string;
  createdAtEnd: string;
  updatedAtLatest: string | null;
  archivedAtLatest: string | null;
  isArchived: boolean;
  sectionIds: (string | null)[];
  recipientCount: number;
  completedCount: number;
  incompleteCount: number;
  excusedCount: number;
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toMinuteBucket = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  date.setSeconds(0, 0);
  return date.toISOString();
};


const latestDate = (current: string | null, next: string | null) => {
  if (!next) return current;
  if (!current) return next;
  return new Date(next).getTime() > new Date(current).getTime() ? next : current;
};

export const groupMasterAssignmentRows = <T extends AssignmentGroupable>(rows: T[]): MasterAssignmentGroup<T>[] => {
  const groups = new Map<string, T[]>();

  rows.forEach((row) => {
    const creatorId = row.created_by ?? row.teacher_id ?? 'unknown-creator';
    const key = [
      row.title.trim().toLowerCase(),
      (row.description ?? '').trim().toLowerCase(),
      row.classroom_id,
      row.due_date ?? 'no-due-date',
      creatorId,
      toMinuteBucket(row.created_at),
    ].join('|');

    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries())
    .map(([key, assignments]) => {
      const sortedAssignments = [...assignments].sort((a, b) => (a.section_id ?? '').localeCompare(b.section_id ?? ''));
      const createdTimes = sortedAssignments.map((assignment) => assignment.created_at).sort();
      const updatedAtLatest = sortedAssignments.reduce<string | null>((latest, assignment) => latestDate(latest, assignment.updated_at), null);
      const archivedAtLatest = sortedAssignments.reduce<string | null>((latest, assignment) => latestDate(latest, assignment.archived_at), null);
      const first = sortedAssignments[0];

      return {
        id: key,
        assignments: sortedAssignments,
        title: first.title,
        description: first.description,
        classroomId: first.classroom_id,
        classroomName: first.classroom_name ?? null,
        teacherName: first.teacher_name ?? null,
        teacherEmail: first.teacher_email ?? null,
        dueDate: first.due_date,
        createdAtStart: createdTimes[0],
        createdAtEnd: createdTimes[createdTimes.length - 1],
        updatedAtLatest,
        archivedAtLatest,
        isArchived: sortedAssignments.every((assignment) => Boolean(assignment.archived_at)),
        sectionIds: sortedAssignments.map((assignment) => assignment.section_id),
        recipientCount: sortedAssignments.reduce((total, assignment) => total + toNumber(assignment.recipient_count), 0),
        completedCount: sortedAssignments.reduce((total, assignment) => total + toNumber(assignment.completed_count), 0),
        incompleteCount: sortedAssignments.reduce((total, assignment) => total + toNumber(assignment.incomplete_count), 0),
        excusedCount: sortedAssignments.reduce((total, assignment) => total + toNumber(assignment.excused_count), 0),
      };
    })
    .sort((a, b) => new Date(b.createdAtStart).getTime() - new Date(a.createdAtStart).getTime());
};

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
