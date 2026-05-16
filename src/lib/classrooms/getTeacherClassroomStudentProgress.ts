import { SECTIONS } from "@/lib/course/algebra1";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ClassroomRosterMember } from "@/lib/classrooms/getClassroomRoster";

type RawRecentAttempt = {
  question_id?: string | null;
  selected_answer?: string | null;
  correct?: boolean | null;
  attempted_at?: string | null;
};

export type TeacherStudentProgressRow = {
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
  recent_attempts: RawRecentAttempt[] | null;
};

export type TeacherStudentSectionProgress = {
  sectionId: string;
  chapterId: string;
  title: string;
  questionsAttempted: number;
  questionsCorrect: number;
  completionPercent: number;
  accuracyPercent: number;
  totalAttempts: number;
  totalCorrect: number;
  mostRecentActivity: string | null;
};

export type TeacherStudentRecentAttempt = {
  sectionId: string;
  sectionTitle: string;
  questionId: string | null;
  selectedAnswer: string | null;
  correct: boolean | null;
  attemptedAt: string | null;
};

export type TeacherClassroomStudentProgress = {
  student: {
    userId: string;
    fullName: string | null;
    email: string | null;
  };
  summary: {
    overallCompletion: number;
    overallAccuracy: number;
    totalAttempts: number;
    totalCorrect: number;
    mostRecentActivity: string | null;
  };
  sections: TeacherStudentSectionProgress[];
  recentAttempts: TeacherStudentRecentAttempt[];
  rows: TeacherStudentProgressRow[];
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

function buildEmptyStudentProgress(
  studentUserId: string,
  rosterMember?: ClassroomRosterMember
): TeacherClassroomStudentProgress {
  return {
    student: {
      userId: studentUserId,
      fullName: rosterMember?.full_name ?? null,
      email: rosterMember?.email ?? null,
    },
    summary: {
      overallCompletion: 0,
      overallAccuracy: 0,
      totalAttempts: 0,
      totalCorrect: 0,
      mostRecentActivity: null,
    },
    sections: SECTIONS.map((section) => ({
      sectionId: section.id,
      chapterId: section.chapterId,
      title: section.title,
      questionsAttempted: 0,
      questionsCorrect: 0,
      completionPercent: 0,
      accuracyPercent: 0,
      totalAttempts: 0,
      totalCorrect: 0,
      mostRecentActivity: null,
    })),
    recentAttempts: [],
    rows: [],
  };
}

function buildTeacherClassroomStudentProgress(
  rows: TeacherStudentProgressRow[],
  studentUserId: string,
  rosterMember?: ClassroomRosterMember
): TeacherClassroomStudentProgress {
  if (rows.length === 0) {
    return buildEmptyStudentProgress(studentUserId, rosterMember);
  }

  const firstRow = rows[0];
  const rowBySection = new Map<string, TeacherStudentProgressRow>();

  for (const row of rows) {
    if (row.section_id) {
      rowBySection.set(row.section_id, row);
    }
  }

  const sections: TeacherStudentSectionProgress[] = SECTIONS.map((section) => {
    const row = rowBySection.get(section.id);
    const totalAttempts = toNumber(row?.attempt_count);
    const totalCorrect = toNumber(row?.correct_count);

    return {
      sectionId: section.id,
      chapterId: section.chapterId,
      title: section.title,
      questionsAttempted: toNumber(row?.questions_attempted),
      questionsCorrect: toNumber(row?.questions_correct),
      completionPercent: clampPercent(toNumber(row?.completion_percent)),
      accuracyPercent: totalAttempts > 0 ? clampPercent((totalCorrect / totalAttempts) * 100) : clampPercent(toNumber(row?.accuracy_percent)),
      totalAttempts,
      totalCorrect,
      mostRecentActivity: latestIso([row?.last_attempt_at, row?.last_active_at]),
    };
  });

  const totalAttempts = rows.reduce((sum, row) => sum + toNumber(row.attempt_count), 0);
  const totalCorrect = rows.reduce((sum, row) => sum + toNumber(row.correct_count), 0);
  const recentAttempts = rows
    .flatMap((row) =>
      (row.recent_attempts ?? []).map((attempt) => ({
        sectionId: row.section_id ?? "unknown",
        sectionTitle: getSectionTitle(row.section_id),
        questionId: attempt.question_id ?? null,
        selectedAnswer: attempt.selected_answer ?? null,
        correct: attempt.correct ?? null,
        attemptedAt: attempt.attempted_at ?? null,
      }))
    )
    .filter((attempt) => attempt.attemptedAt)
    .sort((a, b) => (b.attemptedAt ?? "").localeCompare(a.attemptedAt ?? ""))
    .slice(0, 10);

  return {
    student: {
      userId: studentUserId,
      fullName: firstRow?.full_name ?? rosterMember?.full_name ?? null,
      email: firstRow?.email ?? rosterMember?.email ?? null,
    },
    summary: {
      overallCompletion: average(sections.map((section) => section.completionPercent)),
      overallAccuracy: totalAttempts > 0 ? clampPercent((totalCorrect / totalAttempts) * 100) : 0,
      totalAttempts,
      totalCorrect,
      mostRecentActivity: latestIso(rows.map((row) => row.last_attempt_at ?? row.last_active_at)),
    },
    sections,
    recentAttempts,
    rows,
  };
}

export async function getTeacherClassroomStudentProgress(
  classroomId: string,
  studentUserId: string,
  rosterMember?: ClassroomRosterMember
): Promise<TeacherClassroomStudentProgress> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    rpc: (
      functionName: string,
      args: Record<string, string>
    ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  };

  const { data, error } = await supabase.rpc("get_teacher_classroom_student_progress", {
    p_classroom_id: classroomId,
    p_student_user_id: studentUserId,
  });

  if (error) {
    throw new Error(error.message || "Failed to load student progress.");
  }

  return buildTeacherClassroomStudentProgress(
    (Array.isArray(data) ? data : []) as TeacherStudentProgressRow[],
    studentUserId,
    rosterMember
  );
}
