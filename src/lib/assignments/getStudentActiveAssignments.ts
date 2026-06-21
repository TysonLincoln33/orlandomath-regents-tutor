import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type StudentAssignmentStatus = "assigned" | "completed" | "excused" | "archived" | "unassigned";

export type StudentActiveAssignmentRow = {
  classroom_id: string;
  classroom_name: string;
  teacher_name: string | null;
  teacher_email: string | null;
  assignment_id: string | null;
  title: string | null;
  description: string | null;
  section_id: string | null;
  due_date: string | null;
  assigned_at: string | null;
  status: StudentAssignmentStatus | null;
  completion_percent: number | string | null;
};

export type StudentActiveAssignment = {
  assignmentId: string;
  title: string;
  description: string | null;
  sectionId: string | null;
  dueDate: string | null;
  assignedAt: string | null;
  status: StudentAssignmentStatus;
  completionPercent: number | null;
};

export type StudentClassAssignments = {
  classroomId: string;
  classroomName: string;
  teacherName: string | null;
  teacherEmail: string | null;
  activeAssignmentCount: number;
  assignments: StudentActiveAssignment[];
};

function toNullablePercent(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function compareAssignments(
  left: StudentActiveAssignment,
  right: StudentActiveAssignment,
): number {
  const leftDue = left.dueDate ? Date.parse(left.dueDate) : Number.POSITIVE_INFINITY;
  const rightDue = right.dueDate ? Date.parse(right.dueDate) : Number.POSITIVE_INFINITY;

  if (leftDue !== rightDue) {
    return leftDue - rightDue;
  }

  const leftAssigned = left.assignedAt ? Date.parse(left.assignedAt) : 0;
  const rightAssigned = right.assignedAt ? Date.parse(right.assignedAt) : 0;

  return rightAssigned - leftAssigned;
}

export async function getStudentActiveAssignments(): Promise<StudentClassAssignments[]> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    rpc: (
      functionName: string,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  const { data, error } = await supabase.rpc("get_student_active_assignments");

  if (error) {
    throw new Error(error.message || "Failed to load your classes.");
  }

  const grouped = new Map<string, StudentClassAssignments>();

  for (const row of (Array.isArray(data) ? data : []) as StudentActiveAssignmentRow[]) {
    const classroomId = row.classroom_id;

    if (!grouped.has(classroomId)) {
      grouped.set(classroomId, {
        classroomId,
        classroomName: row.classroom_name,
        teacherName: row.teacher_name,
        teacherEmail: row.teacher_email,
        activeAssignmentCount: 0,
        assignments: [],
      });
    }

    if (!row.assignment_id || !row.title || !row.status) {
      continue;
    }

    const group = grouped.get(classroomId);
    if (!group) continue;

    group.assignments.push({
      assignmentId: row.assignment_id,
      title: row.title,
      description: row.description,
      sectionId: row.section_id,
      dueDate: row.due_date,
      assignedAt: row.assigned_at,
      status: row.status,
      completionPercent: toNullablePercent(row.completion_percent),
    });
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      activeAssignmentCount: group.assignments.length,
      assignments: [...group.assignments].sort(compareAssignments),
    }))
    .sort((left, right) => left.classroomName.localeCompare(right.classroomName));
}
