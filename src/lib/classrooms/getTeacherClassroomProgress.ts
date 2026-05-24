import { SECTIONS } from "@/lib/course/algebra1";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type TeacherClassroomProgressRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  chapter_id: string | null;
  section_id: string | null;
  questions_attempted: number | string | null;
  questions_correct: number | string | null;
  accuracy_percent: number | string | null;
  completion_percent: number | string | null;
  last_active_at: string | null;
  attempt_count: number | string | null;
  correct_count: number | string | null;
  last_attempt_at: string | null;
};

export type TeacherClassroomSectionProgress = {
  sectionId: string;
  chapterId: string;
  title: string;
  studentsStarted: number;
  studentsCompleted: number;
  averageCompletion: number;
  averageAccuracy: number;
  totalAttempts: number;
  totalCorrect: number;
  mostRecentActivity: string | null;
};

export type TeacherClassroomProgressSummary = {
  rosterStudents: number;
  studentsWithProgress: number;
  averageCompletion: number;
  averageAccuracy: number;
  totalAttempts: number;
  totalCorrect: number;
  mostRecentActivity: string | null;
};

export type TeacherClassroomRecentAttempt = {
  userId: string;
  fullName: string | null;
  email: string | null;
  chapterId: string | null;
  sectionId: string | null;
  sectionTitle: string;
  questionId: string | null;
  correct: boolean | null;
  attemptedAt: string | null;
};

export type TeacherClassroomProgress = {
  summary: TeacherClassroomProgressSummary;
  sections: TeacherClassroomSectionProgress[];
  rows: TeacherClassroomProgressRow[];
  recentAttempts: TeacherClassroomRecentAttempt[];
};

function toNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return clampPercent(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function latestIso(values: Array<string | null | undefined>): string | null {
  const valid = values.filter((value): value is string => Boolean(value));
  if (valid.length === 0) return null;
  return valid.sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function getSectionTitle(sectionId: string | null | undefined) {
  return SECTIONS.find((section) => section.id === sectionId)?.title ?? sectionId ?? "Unknown section";
}

function buildTeacherClassroomProgress(
  rows: TeacherClassroomProgressRow[],
  rosterStudents: number,
  recentAttempts: TeacherClassroomRecentAttempt[]
): TeacherClassroomProgress {
  const rowsBySection = new Map<string, TeacherClassroomProgressRow[]>();
  const rowsByStudent = new Map<string, TeacherClassroomProgressRow[]>();

  for (const row of rows) {
    if (row.section_id) {
      rowsBySection.set(row.section_id, [...(rowsBySection.get(row.section_id) ?? []), row]);
    }

    rowsByStudent.set(row.user_id, [...(rowsByStudent.get(row.user_id) ?? []), row]);
  }

  const sections: TeacherClassroomSectionProgress[] = SECTIONS.map((section) => {
    const sectionRows = rowsBySection.get(section.id) ?? [];
    const startedRows = sectionRows.filter(
      (row) =>
        toNumber(row.questions_attempted) > 0 ||
        toNumber(row.attempt_count) > 0 ||
        toNumber(row.completion_percent) > 0
    );
    const attempts = sectionRows.reduce((sum, row) => sum + toNumber(row.attempt_count), 0);
    const correct = sectionRows.reduce((sum, row) => sum + toNumber(row.correct_count), 0);

    return {
      sectionId: section.id,
      chapterId: section.chapterId,
      title: section.title,
      studentsStarted: new Set(startedRows.map((row) => row.user_id)).size,
      studentsCompleted: new Set(
        sectionRows
          .filter((row) => toNumber(row.completion_percent) >= 100)
          .map((row) => row.user_id)
      ).size,
      averageCompletion: average(sectionRows.map((row) => toNumber(row.completion_percent))),
      averageAccuracy: attempts > 0 ? clampPercent((correct / attempts) * 100) : 0,
      totalAttempts: attempts,
      totalCorrect: correct,
      mostRecentActivity: latestIso(
        sectionRows.map((row) => row.last_attempt_at ?? row.last_active_at)
      ),
    };
  });

  const studentCompletionValues = [...rowsByStudent.values()].map((studentRows) => {
    const completionBySection = new Map<string, number>();

    for (const row of studentRows) {
      if (row.section_id) {
        completionBySection.set(row.section_id, toNumber(row.completion_percent));
      }
    }

    return average(SECTIONS.map((section) => completionBySection.get(section.id) ?? 0));
  });

  const totalAttempts = rows.reduce((sum, row) => sum + toNumber(row.attempt_count), 0);
  const totalCorrect = rows.reduce((sum, row) => sum + toNumber(row.correct_count), 0);

  return {
    summary: {
      rosterStudents,
      studentsWithProgress: rowsByStudent.size,
      averageCompletion: average(studentCompletionValues),
      averageAccuracy: totalAttempts > 0 ? clampPercent((totalCorrect / totalAttempts) * 100) : 0,
      totalAttempts,
      totalCorrect,
      mostRecentActivity: latestIso(rows.map((row) => row.last_attempt_at ?? row.last_active_at)),
    },
    sections,
    rows,
    recentAttempts,
  };
}

export async function getTeacherClassroomProgress(
  classroomId: string,
  rosterStudents: number
): Promise<TeacherClassroomProgress> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    rpc: (
      functionName: string,
      args: Record<string, string>
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  const [{ data, error }, recentAttemptsResponse] = await Promise.all([
    supabase.rpc("get_teacher_classroom_progress", {
    p_classroom_id: classroomId,
  }),
    supabase.rpc("get_teacher_classroom_recent_attempts", {
      p_classroom_id: classroomId,
    }),
  ]);

  if (recentAttemptsResponse.error) {
    throw new Error(recentAttemptsResponse.error.message || "Failed to load classroom recent attempts.");
  }

  const recentAttempts = ((Array.isArray(recentAttemptsResponse.data) ? recentAttemptsResponse.data : []) as Array<{
    user_id: string;
    full_name: string | null;
    email: string | null;
    chapter_id: string | null;
    section_id: string | null;
    question_id: string | null;
    correct: boolean | null;
    attempted_at: string | null;
  }>).map((attempt) => ({
    userId: attempt.user_id,
    fullName: attempt.full_name,
    email: attempt.email,
    chapterId: attempt.chapter_id,
    sectionId: attempt.section_id,
    sectionTitle: getSectionTitle(attempt.section_id),
    questionId: attempt.question_id,
    correct: attempt.correct,
    attemptedAt: attempt.attempted_at,
  }));

  if (error) {
    throw new Error(error.message || "Failed to load classroom progress.");
  }

  return buildTeacherClassroomProgress(
    (Array.isArray(data) ? data : []) as TeacherClassroomProgressRow[],
    rosterStudents,
    recentAttempts
  );
}
