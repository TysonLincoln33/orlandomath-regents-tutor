import { CHAPTERS, SECTIONS, type Chapter, type Section } from "@/lib/course/algebra1";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type StudentProgressRow = {
  user_id: string;
  course_id: string;
  chapter_id: string;
  section_id: string;
  questions_attempted: number | string | null;
  questions_correct: number | string | null;
  accuracy_percent: number | string | null;
  completion_percent: number | string | null;
  last_active_at: string | null;
  updated_at?: string | null;
};

export type SectionMastery =
  | "not_started"
  | "developing"
  | "mastered";

export type SectionDashboardProgress = Section & {
  questionsAttempted: number;
  questionsCorrect: number;
  accuracyPercent: number;
  completionPercent: number;
  lastActiveAt: string | null;
  mastery: SectionMastery;
};

export type ChapterDashboardProgress = Chapter & {
  completionPercent: number;
  accuracyPercent: number;
  sectionsCompleted: number;
  sectionsMastered: number;
  totalSections: number;
  sections: SectionDashboardProgress[];
};

export type CourseDashboardProgress = {
  courseId: string;
  overallCompletionPercent: number;
  overallAccuracyPercent: number;
  sectionsCompleted: number;
  sectionsMastered: number;
  totalSections: number;
  chapters: ChapterDashboardProgress[];
  weakestSections: SectionDashboardProgress[];
  strongestSections: SectionDashboardProgress[];
  recentSections: SectionDashboardProgress[];
};

function toNumber(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return clampPercent(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

function deriveMastery(section: {
  questionsAttempted: number;
  completionPercent: number;
  accuracyPercent: number;
}): SectionMastery {

  if (section.questionsAttempted === 0) return "not_started";

  if (
    section.completionPercent >= 100 &&
    section.accuracyPercent >= 80
  ) {
    return "mastered";
  }

  return "developing";
}

function compareIsoDesc(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.localeCompare(a);
}

export function buildEmptyCourseDashboardProgress(
  courseId: string = "algebra1"
): CourseDashboardProgress {

  const emptySections: SectionDashboardProgress[] = SECTIONS.map((section) => ({
    ...section,
    questionsAttempted: 0,
    questionsCorrect: 0,
    accuracyPercent: 0,
    completionPercent: 0,
    lastActiveAt: null,
    mastery: "not_started",
  }));

  const chapters: ChapterDashboardProgress[] = CHAPTERS.map((chapter) => {

    const sections = emptySections.filter(
      (section) => section.chapterId === chapter.id
    );

    return {
      ...chapter,
      completionPercent: 0,
      accuracyPercent: 0,
      sectionsCompleted: 0,
      sectionsMastered: 0,
      totalSections: sections.length,
      sections,
    };
  });

  return {
    courseId,
    overallCompletionPercent: 0,
    overallAccuracyPercent: 0,
    sectionsCompleted: 0,
    sectionsMastered: 0,
    totalSections: SECTIONS.length,
    chapters,
    weakestSections: [...emptySections],
    strongestSections: [...emptySections],
    recentSections: [],
  };
}

export function buildCourseDashboardProgress(
  rows: StudentProgressRow[],
  courseId: string = "algebra1"
): CourseDashboardProgress {

  const rowBySectionId = new Map<string, StudentProgressRow>();

  for (const row of rows) {
    rowBySectionId.set(row.section_id, row);
  }

  const sections: SectionDashboardProgress[] = SECTIONS.map((section) => {

    const row = rowBySectionId.get(section.id);

    const questionsAttempted = toNumber(row?.questions_attempted);
    const questionsCorrect = toNumber(row?.questions_correct);
    const accuracyPercent = clampPercent(toNumber(row?.accuracy_percent));
    const completionPercent = clampPercent(toNumber(row?.completion_percent));
    const lastActiveAt = row?.last_active_at ?? null;

    return {
      ...section,
      questionsAttempted,
      questionsCorrect,
      accuracyPercent,
      completionPercent,
      lastActiveAt,
      mastery: deriveMastery({
        questionsAttempted,
        completionPercent,
        accuracyPercent,
      }),
    };
  });

  const totalAttempted = sections.reduce(
    (sum, s) => sum + s.questionsAttempted,
    0
  );

  const totalCorrect = sections.reduce(
    (sum, s) => sum + s.questionsCorrect,
    0
  );

  const chapters: ChapterDashboardProgress[] = CHAPTERS.map((chapter) => {

    const chapterSections = sections.filter(
      (section) => section.chapterId === chapter.id
    );

    const chapterAttempted = chapterSections.reduce(
      (sum, s) => sum + s.questionsAttempted,
      0
    );

    const chapterCorrect = chapterSections.reduce(
      (sum, s) => sum + s.questionsCorrect,
      0
    );

    return {
      ...chapter,
      completionPercent: average(
        chapterSections.map((s) => s.completionPercent)
      ),

      accuracyPercent:
        chapterAttempted > 0
          ? clampPercent((chapterCorrect / chapterAttempted) * 100)
          : 0,

      sectionsCompleted: chapterSections.filter(
        (s) => s.completionPercent >= 100
      ).length,

      sectionsMastered: chapterSections.filter(
        (s) => s.mastery === "mastered"
      ).length,

      totalSections: chapterSections.length,
      sections: chapterSections,
    };
  });

  const weakestSections = [...sections].sort((a, b) => {

    if (a.completionPercent !== b.completionPercent) {
      return a.completionPercent - b.completionPercent;
    }

    if (a.accuracyPercent !== b.accuracyPercent) {
      return a.accuracyPercent - b.accuracyPercent;
    }

    return a.id.localeCompare(b.id);
  });

  const strongestSections = [...sections].sort((a, b) => {

    if (a.completionPercent !== b.completionPercent) {
      return b.completionPercent - a.completionPercent;
    }

    if (a.accuracyPercent !== b.accuracyPercent) {
      return b.accuracyPercent - a.accuracyPercent;
    }

    return a.id.localeCompare(b.id);
  });

  const recentSections = [...sections]
    .filter((section) => section.lastActiveAt)
    .sort((a, b) => compareIsoDesc(a.lastActiveAt, b.lastActiveAt));

  return {
    courseId,

    overallCompletionPercent: average(
      sections.map((s) => s.completionPercent)
    ),

    overallAccuracyPercent:
      totalAttempted > 0
        ? clampPercent((totalCorrect / totalAttempted) * 100)
        : 0,

    sectionsCompleted: sections.filter(
      (s) => s.completionPercent >= 100
    ).length,

    sectionsMastered: sections.filter(
      (s) => s.mastery === "mastered"
    ).length,

    totalSections: sections.length,
    chapters,
    weakestSections,
    strongestSections,
    recentSections,
  };
}

export async function fetchCourseDashboardProgress(
  courseId: string = "algebra1"
): Promise<CourseDashboardProgress> {

  const supabase: any = getSupabaseBrowserClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("[fetchCourseDashboardProgress] user lookup failed:", userError);
    throw userError;
  }

  if (!user) {
    return buildEmptyCourseDashboardProgress(courseId);
  }

  const { data, error } = await supabase
    .from("student_progress")
    .select(`
      user_id,
      course_id,
      chapter_id,
      section_id,
      questions_attempted,
      questions_correct,
      accuracy_percent,
      completion_percent,
      last_active_at,
      updated_at
    `)
    .eq("user_id", user.id)
    .eq("course_id", courseId);

  if (error) {
    console.error("[fetchCourseDashboardProgress] select failed:", error);
    throw error;
  }

  return buildCourseDashboardProgress(
    (data ?? []) as StudentProgressRow[],
    courseId
  );
}