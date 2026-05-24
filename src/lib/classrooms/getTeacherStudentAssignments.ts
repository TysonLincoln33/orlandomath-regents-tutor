import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type TeacherStudentAssignmentStatus =
  | "assigned"
  | "completed"
  | "excused"
  | "archived";

export type TeacherStudentAssignmentRow = {
  assignment_id: string;
  title: string;
  description: string | null;
  section_id: string | null;
  due_date: string | null;
  assigned_at: string;
  status: TeacherStudentAssignmentStatus;
  archived_at: string | null;
  completion_percent: number | string | null;
  is_complete: boolean | null;
};

export type TeacherStudentAssignment = {
  assignmentId: string;
  title: string;
  description: string | null;
  sectionId: string | null;
  dueDate: string | null;
  assignedAt: string;
  status: TeacherStudentAssignmentStatus;
  archivedAt: string | null;
  completionPercent: number;
  isComplete: boolean;
};

export type TeacherStudentAssignmentGroups = {
  current: TeacherStudentAssignment[];
  past: TeacherStudentAssignment[];
};

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toAssignment(row: TeacherStudentAssignmentRow): TeacherStudentAssignment {
  return {
    assignmentId: row.assignment_id,
    title: row.title,
    description: row.description,
    sectionId: row.section_id,
    dueDate: row.due_date,
    assignedAt: row.assigned_at,
    status: row.status,
    archivedAt: row.archived_at,
    completionPercent: clampPercent(toNumber(row.completion_percent)),
    isComplete: Boolean(row.is_complete),
  };
}

function isPast(assignment: TeacherStudentAssignment): boolean {
  return (
    assignment.isComplete ||
    assignment.status === "excused" ||
    assignment.status === "archived" ||
    Boolean(assignment.archivedAt)
  );
}

export async function getTeacherStudentAssignments(
  classroomId: string,
  studentUserId: string,
): Promise<TeacherStudentAssignmentGroups> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    rpc: (
      functionName: string,
      args: Record<string, string>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  const { data, error } = await supabase.rpc("get_teacher_student_assignments", {
    p_classroom_id: classroomId,
    p_student_user_id: studentUserId,
  });

  if (error) {
    throw new Error(error.message || "Failed to load student assignments.");
  }

  const assignments = (Array.isArray(data) ? data : []).map((row) =>
    toAssignment(row as TeacherStudentAssignmentRow),
  );

  return {
    current: assignments.filter((assignment) => !isPast(assignment)),
    past: assignments.filter((assignment) => isPast(assignment)),
  };
}
