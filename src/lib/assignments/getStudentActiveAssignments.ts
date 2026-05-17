import { SECTIONS } from "@/lib/course/algebra1";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type StudentAssignmentStatus =
  | "assigned"
  | "completed"
  | "excused"
  | "archived";

export type StudentActiveAssignmentRow = {
  assignment_id: string;
  classroom_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  section_id: string | null;
  status: StudentAssignmentStatus;
  assigned_at: string;
  completion_percent: number | string | null;
  is_complete: boolean | null;
};

export type StudentActiveAssignment = {
  assignmentId: string;
  classroomId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  sectionId: string | null;
  sectionLabel: string;
  status: StudentAssignmentStatus;
  assignedAt: string;
  completionPercent: number;
  isComplete: boolean;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toNumber(value: number | string | null | undefined): number {
  const nextValue = Number(value ?? 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

export function getAssignmentSectionLabel(sectionId: string | null): string {
  const section = SECTIONS.find((item) => item.id === sectionId);

  if (!section) return sectionId ?? "No section";

  return `Chapter ${section.chapterNumber}, Section ${section.sectionNumber}: ${section.title}`;
}

function mapStudentActiveAssignment(
  row: StudentActiveAssignmentRow,
): StudentActiveAssignment {
  const completionPercent = clampPercent(toNumber(row.completion_percent));

  return {
    assignmentId: row.assignment_id,
    classroomId: row.classroom_id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    sectionId: row.section_id,
    sectionLabel: getAssignmentSectionLabel(row.section_id),
    status: row.status,
    assignedAt: row.assigned_at,
    completionPercent,
    isComplete: Boolean(row.is_complete) || completionPercent >= 100,
  };
}

export async function getStudentActiveAssignments(): Promise<
  StudentActiveAssignment[]
> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    rpc: (
      functionName: string,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  const { data, error } = await supabase.rpc("get_student_active_assignments");

  if (error) {
    throw new Error(error.message || "Failed to load active assignments.");
  }

  return ((Array.isArray(data) ? data : []) as StudentActiveAssignmentRow[]).map(
    mapStudentActiveAssignment,
  );
}
