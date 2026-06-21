import { NextRequest, NextResponse } from "next/server";

import { CHAPTERS, SECTIONS } from "@/lib/course/algebra1";
import {
  AdminClassroomManagementApiError,
  getRouteContext,
  getValidatedStudent,
  jsonError,
  parseUniqueMembershipError,
} from "../../../classroom-management/_utils";

const VALID_CHAPTER_IDS = new Set(CHAPTERS.map((chapter) => chapter.id));
const ACTIVE_QUICK_ASSIGN_STATUSES = new Set(["assigned", "completed", "excused"]);
const RESTORABLE_QUICK_ASSIGN_STATUSES = new Set(["archived", "unassigned"]);

type RouteContext = {
  params: Promise<{ studentUserId: string }>;
};

type QuickAssignmentRow = {
  id: string;
  title: string;
  section_id: string | null;
  created_at: string;
  due_date: string | null;
  archived_at: string | null;
  assignment_recipients?: Array<{
    status: string | null;
    assigned_at: string | null;
    completed_at: string | null;
  }>;
};

type QuickAssignmentView = {
  id: string;
  title: string;
  sectionId: string | null;
  sectionTitle: string;
  chapterId: string | null;
  chapterNumber: number | null;
  sectionNumber: number | null;
  dueDate: string | null;
  createdAt: string;
  status: string;
  completionPercent: number | null;
  accuracyPercent: number | null;
  attempts: number;
};

type StudentProgressRow = {
  section_id: string;
  completion_percent: number | null;
  accuracy_percent: number | null;
  questions_attempted: number | null;
  questions_correct: number | null;
};

type AttemptAggregate = {
  section_id: string;
  attempt_count: number;
  correct_count: number;
};

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map((id) => id.trim()).filter(Boolean))];
}

function getSchoolYearTerm() {
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function makeClassCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function getOrCreateQuickClass(ctx: Awaited<ReturnType<typeof getRouteContext>>) {
  const { data: existing, error: existingError } = await ctx.adminClient
    .from("classrooms")
    .select("id,teacher_id,name,subject,term,class_code,created_at,classroom_kind")
    .eq("teacher_id", ctx.userId)
    .eq("classroom_kind", "quick_assign")
    .order("created_at", { ascending: true });

  if (existingError) {
    throw new AdminClassroomManagementApiError(
      existingError.message || "Failed to resolve Quick Class.",
      500,
    );
  }

  if ((existing ?? []).length > 1) {
    throw new AdminClassroomManagementApiError(
      "Multiple Quick Classes are configured for this administrator.",
      409,
    );
  }

  if (existing?.[0]) {
    return { classroom: existing[0], created: false };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await ctx.adminClient
      .from("classrooms")
      .insert({
        teacher_id: ctx.userId,
        name: "Quick Class",
        subject: "Algebra 1",
        term: getSchoolYearTerm(),
        class_code: makeClassCode(),
        classroom_kind: "quick_assign",
      })
      .select("id,teacher_id,name,subject,term,class_code,created_at,classroom_kind")
      .single();

    if (!error && data) {
      return { classroom: data, created: true };
    }

    if (!error.message?.toLowerCase().includes("duplicate")) {
      throw new AdminClassroomManagementApiError(
        error.message || "Failed to create Quick Class.",
        500,
      );
    }
  }

  throw new AdminClassroomManagementApiError("Failed to create a unique Quick Class code.", 500);
}

async function getQuickClass(ctx: Awaited<ReturnType<typeof getRouteContext>>) {
  const { data, error } = await ctx.adminClient
    .from("classrooms")
    .select("id,teacher_id,name,subject,term,class_code,created_at,classroom_kind")
    .eq("teacher_id", ctx.userId)
    .eq("classroom_kind", "quick_assign")
    .order("created_at", { ascending: true });

  if (error) {
    throw new AdminClassroomManagementApiError(error.message || "Failed to load Quick Class.", 500);
  }

  if ((data ?? []).length > 1) {
    throw new AdminClassroomManagementApiError(
      "Multiple Quick Classes are configured for this administrator.",
      409,
    );
  }

  return data?.[0] ?? null;
}

async function ensureMembership(
  ctx: Awaited<ReturnType<typeof getRouteContext>>,
  classroomId: string,
  studentUserId: string,
) {
  const { data: existing, error: existingError } = await ctx.adminClient
    .from("classroom_members")
    .select("id")
    .eq("classroom_id", classroomId)
    .eq("user_id", studentUserId)
    .maybeSingle();

  if (existingError) {
    throw new AdminClassroomManagementApiError(
      existingError.message || "Failed to check Quick Class membership.",
      500,
    );
  }

  if (existing) return false;

  const { error } = await ctx.adminClient.from("classroom_members").insert({
    classroom_id: classroomId,
    user_id: studentUserId,
    joined_via: "quick_assign",
  });

  if (error) {
    if (parseUniqueMembershipError(error)) return false;
    throw new AdminClassroomManagementApiError(
      error.message || "Failed to enroll student in Quick Class.",
      500,
    );
  }

  return true;
}

function buildQuickAssignChapters(assignments: QuickAssignmentView[]) {
  return CHAPTERS.map((chapter) => {
    const chapterAssignments = assignments
      .filter((assignment) => assignment.chapterId === chapter.id)
      .sort((left, right) => (left.sectionNumber ?? 0) - (right.sectionNumber ?? 0));

    if (chapterAssignments.length === 0) return null;

    const chapterCompletions = chapterAssignments.map(
      (assignment) => assignment.completionPercent ?? 0,
    );
    const chapterAttempts = chapterAssignments.reduce((sum, assignment) => sum + assignment.attempts, 0);
    const chapterWeightedCorrect = chapterAssignments.reduce((sum, assignment) => {
      if (typeof assignment.accuracyPercent !== "number" || assignment.attempts === 0) return sum;
      return sum + (assignment.accuracyPercent / 100) * assignment.attempts;
    }, 0);

    return {
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      completionPercent:
        chapterCompletions.length > 0
          ? Math.round(chapterCompletions.reduce((sum, value) => sum + value, 0) / chapterCompletions.length)
          : null,
      accuracyPercent:
        chapterAttempts > 0 ? Math.round((chapterWeightedCorrect / chapterAttempts) * 100) : null,
      attempts: chapterAttempts,
      sectionCount: chapterAssignments.length,
      sections: chapterAssignments,
    };
  }).filter((chapter): chapter is NonNullable<typeof chapter> => Boolean(chapter));
}

function buildQuickAssignMetrics(assignments: QuickAssignmentView[]) {
  const chapters = new Set(assignments.map((assignment) => assignment.chapterId).filter(Boolean));
  const sectionIds = new Set(assignments.map((assignment) => assignment.sectionId).filter(Boolean));
  const completions = assignments.map((assignment) => assignment.completionPercent ?? 0);
  const totalAttempts = assignments.reduce((sum, assignment) => sum + assignment.attempts, 0);
  const weightedCorrect = assignments.reduce((sum, assignment) => {
    if (typeof assignment.accuracyPercent !== "number" || assignment.attempts === 0) return sum;
    return sum + (assignment.accuracyPercent / 100) * assignment.attempts;
  }, 0);

  return {
    assignmentRows: assignments.length,
    chapterCount: chapters.size,
    sectionCount: sectionIds.size,
    completionPercent:
      completions.length > 0
        ? Math.round(completions.reduce((sum, value) => sum + value, 0) / completions.length)
        : null,
    accuracyPercent: totalAttempts > 0 ? Math.round((weightedCorrect / totalAttempts) * 100) : null,
    attempts: totalAttempts,
  };
}

async function loadQuickAssignData(
  ctx: Awaited<ReturnType<typeof getRouteContext>>,
  studentUserId: string,
) {
  const student = await getValidatedStudent(ctx, studentUserId, { requireActive: true });
  const quickClass = await getQuickClass(ctx);

  if (!quickClass) {
    return {
      student: { id: student.id, fullName: student.full_name, email: student.email },
      quickClass: null,
      metrics: {
        assignmentRows: 0,
        chapterCount: 0,
        sectionCount: 0,
        completionPercent: null,
        accuracyPercent: null,
        attempts: 0,
      },
      activeChapters: [],
      chapters: [],
      assignments: [],
      archivedMetrics: {
        assignmentRows: 0,
        chapterCount: 0,
        sectionCount: 0,
        completionPercent: null,
        accuracyPercent: null,
        attempts: 0,
      },
      archivedChapters: [],
      archivedAssignments: [],
    };
  }

  const { data: assignmentData, error: assignmentError } = await ctx.adminClient
    .from("assignments")
    .select("id,title,section_id,created_at,due_date,archived_at,assignment_recipients!inner(status,assigned_at,completed_at)")
    .eq("classroom_id", quickClass.id)
    .eq("created_by", ctx.userId)
    .is("archived_at", null)
    .eq("assignment_recipients.user_id", studentUserId)
    .order("created_at", { ascending: false });

  if (assignmentError) {
    throw new AdminClassroomManagementApiError(
      assignmentError.message || "Failed to load Quick Assignments.",
      500,
    );
  }

  const assignmentRows = (assignmentData ?? []) as QuickAssignmentRow[];
  const sectionIds = [...new Set(assignmentRows.map((row) => row.section_id).filter(Boolean) as string[])];

  const progressBySection = new Map<string, StudentProgressRow>();
  if (sectionIds.length > 0) {
    const { data: progressData, error: progressError } = await ctx.adminClient
      .from("student_progress")
      .select("section_id,completion_percent,accuracy_percent,questions_attempted,questions_correct")
      .eq("user_id", studentUserId)
      .eq("app_id", "regents-algebra")
      .eq("course_id", "algebra1")
      .in("section_id", sectionIds);

    if (progressError) {
      throw new AdminClassroomManagementApiError(
        progressError.message || "Failed to load Quick Assignment progress.",
        500,
      );
    }

    for (const row of (progressData ?? []) as StudentProgressRow[]) {
      progressBySection.set(row.section_id, row);
    }
  }

  const attemptBySection = new Map<string, AttemptAggregate>();
  for (const sectionId of sectionIds) {
    const { count: attemptCount, error: attemptError } = await ctx.adminClient
      .from("question_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", studentUserId)
      .eq("app_id", "regents-algebra")
      .eq("course_id", "algebra1")
      .eq("section_id", sectionId);

    if (attemptError) {
      throw new AdminClassroomManagementApiError(
        attemptError.message || "Failed to load Quick Assignment attempts.",
        500,
      );
    }

    const { count: correctCount, error: correctError } = await ctx.adminClient
      .from("question_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", studentUserId)
      .eq("app_id", "regents-algebra")
      .eq("course_id", "algebra1")
      .eq("section_id", sectionId)
      .eq("correct", true);

    if (correctError) {
      throw new AdminClassroomManagementApiError(
        correctError.message || "Failed to load Quick Assignment accuracy.",
        500,
      );
    }

    attemptBySection.set(sectionId, {
      section_id: sectionId,
      attempt_count: attemptCount ?? 0,
      correct_count: correctCount ?? 0,
    });
  }

  const allAssignments = assignmentRows.map((assignment): QuickAssignmentView => {
    const section = SECTIONS.find((item) => item.id === assignment.section_id);
    const progress = assignment.section_id ? progressBySection.get(assignment.section_id) : undefined;
    const attempts = assignment.section_id ? attemptBySection.get(assignment.section_id) : undefined;
    const attemptCount = attempts?.attempt_count ?? progress?.questions_attempted ?? 0;
    const correctCount = attempts?.correct_count ?? progress?.questions_correct ?? 0;

    return {
      id: assignment.id,
      title: assignment.title,
      sectionId: assignment.section_id,
      sectionTitle: section?.title ?? assignment.section_id ?? "Unknown section",
      chapterId: section?.chapterId ?? null,
      chapterNumber: section?.chapterNumber ?? null,
      sectionNumber: section?.sectionNumber ?? null,
      dueDate: assignment.due_date,
      createdAt: assignment.created_at,
      status: assignment.assignment_recipients?.[0]?.status ?? "assigned",
      completionPercent: progress?.completion_percent ?? 0,
      accuracyPercent:
        attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : progress?.accuracy_percent ?? null,
      attempts: attemptCount,
    };
  });

  const activeAssignments = allAssignments.filter((assignment) =>
    ACTIVE_QUICK_ASSIGN_STATUSES.has(assignment.status),
  );
  const activeSectionIds = new Set(
    activeAssignments
      .map((assignment) => assignment.sectionId)
      .filter((sectionId): sectionId is string => Boolean(sectionId)),
  );
  const archivedAssignments = allAssignments.filter(
    (assignment) =>
      assignment.status === "archived" &&
      (!assignment.sectionId || !activeSectionIds.has(assignment.sectionId)),
  );
  const activeMetrics = buildQuickAssignMetrics(activeAssignments);
  const archivedMetrics = buildQuickAssignMetrics(archivedAssignments);
  const activeChapterGroups = buildQuickAssignChapters(activeAssignments);
  const archivedChapterGroups = buildQuickAssignChapters(archivedAssignments);

  return {
    student: { id: student.id, fullName: student.full_name, email: student.email },
    quickClass: {
      id: quickClass.id,
      name: quickClass.name,
    },
    metrics: activeMetrics,
    activeChapters: activeChapterGroups,
    chapters: activeChapterGroups,
    assignments: activeAssignments,
    archivedMetrics,
    archivedChapters: archivedChapterGroups,
    archivedAssignments,
  };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await getRouteContext(req);
    if (ctx.isMaster) {
      throw new AdminClassroomManagementApiError(
        "Master Quick Assign is not supported for this MVP.",
        403,
        "admin_denied",
      );
    }

    const { studentUserId } = await params;
    return NextResponse.json(await loadQuickAssignData(ctx, studentUserId));
  } catch (error) {
    console.error("admin quick assign data route error", error);
    return jsonError(error);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const ctx = await getRouteContext(req);
    if (ctx.isMaster) {
      throw new AdminClassroomManagementApiError(
        "Master Quick Assign is not supported for this MVP.",
        403,
        "admin_denied",
      );
    }

    const { studentUserId } = await params;
    await getValidatedStudent(ctx, studentUserId, { requireActive: true });

    const body = await req.json().catch(() => null);
    const chapterIds = normalizeStringArray(body?.chapterIds);

    if (chapterIds.length === 0) {
      throw new AdminClassroomManagementApiError("Select at least one chapter.", 400);
    }

    const invalidChapterId = chapterIds.find((chapterId) => !VALID_CHAPTER_IDS.has(chapterId));
    if (invalidChapterId) {
      throw new AdminClassroomManagementApiError(`Invalid chapter selected: ${invalidChapterId}`, 400);
    }

    const sectionIds = SECTIONS.filter((section) => chapterIds.includes(section.chapterId)).map(
      (section) => section.id,
    );

    if (sectionIds.length === 0) {
      throw new AdminClassroomManagementApiError(
        "Selected chapters do not contain assignable sections.",
        400,
      );
    }

    const { classroom, created } = await getOrCreateQuickClass(ctx);
    const membershipCreated = await ensureMembership(ctx, classroom.id, studentUserId);

    const { data: existingAssignmentData, error: existingAssignmentError } = await ctx.adminClient
      .from("assignments")
      .select("id,section_id,assignment_recipients!inner(status)")
      .eq("classroom_id", classroom.id)
      .eq("created_by", ctx.userId)
      .is("archived_at", null)
      .in("section_id", sectionIds)
      .eq("assignment_recipients.user_id", studentUserId);

    if (existingAssignmentError) {
      throw new AdminClassroomManagementApiError(
        existingAssignmentError.message || "Failed to check existing Quick Assign sections.",
        500,
      );
    }

    const existingAssignments = (existingAssignmentData ?? []) as Array<{
      id: string;
      section_id: string | null;
      assignment_recipients?: Array<{ status: string | null }>;
    }>;
    const activeSectionIds = new Set(
      existingAssignments
        .filter((assignment) =>
          ACTIVE_QUICK_ASSIGN_STATUSES.has(assignment.assignment_recipients?.[0]?.status ?? ""),
        )
        .map((assignment) => assignment.section_id)
        .filter((sectionId): sectionId is string => Boolean(sectionId)),
    );
    const existingSectionIds = new Set(
      existingAssignments
        .map((assignment) => assignment.section_id)
        .filter((sectionId): sectionId is string => Boolean(sectionId)),
    );
    const restorableAssignmentIdsBySection = new Map<string, string>();
    for (const assignment of existingAssignments) {
      if (
        RESTORABLE_QUICK_ASSIGN_STATUSES.has(assignment.assignment_recipients?.[0]?.status ?? "") &&
        assignment.section_id &&
        !activeSectionIds.has(assignment.section_id) &&
        !restorableAssignmentIdsBySection.has(assignment.section_id)
      ) {
        restorableAssignmentIdsBySection.set(assignment.section_id, assignment.id);
      }
    }
    const restorableAssignmentIds = [...restorableAssignmentIdsBySection.values()];
    const missingSectionIds = sectionIds.filter((sectionId) => !existingSectionIds.has(sectionId));
    const title = "Quick Assign";

    const { error: reactivationError } = restorableAssignmentIds.length > 0
      ? await ctx.adminClient
          .from("assignment_recipients")
          .update({ status: "assigned" })
          .eq("classroom_id", classroom.id)
          .eq("user_id", studentUserId)
          .in("assignment_id", restorableAssignmentIds)
          .in("status", ["archived", "unassigned"])
      : { error: null };

    if (reactivationError) {
      throw new AdminClassroomManagementApiError(
        reactivationError.message || "Failed to reactivate Quick Assignments.",
        500,
      );
    }

    const assignmentsToInsert = missingSectionIds.map((sectionId) => ({
      classroom_id: classroom.id,
      title,
      description: null,
      due_date: null,
      section_id: sectionId,
      created_by: ctx.userId,
    }));

    const { data: insertedAssignments, error: assignmentError } = assignmentsToInsert.length > 0
      ? await ctx.adminClient
          .from("assignments")
          .insert(assignmentsToInsert)
          .select("id,classroom_id,title,description,due_date,section_id,created_by,created_at")
      : { data: [], error: null };

    if (assignmentError) {
      throw new AdminClassroomManagementApiError(
        assignmentError.message || "Failed to create Quick Assignments.",
        500,
      );
    }

    const assignments = insertedAssignments ?? [];
    const { error: recipientError } = assignments.length > 0
      ? await ctx.adminClient.from("assignment_recipients").insert(
          assignments.map((assignment) => ({
            assignment_id: assignment.id,
            classroom_id: classroom.id,
            user_id: studentUserId,
            assigned_by: ctx.userId,
            status: "assigned",
          })),
        )
      : { error: null };

    if (recipientError) {
      throw new AdminClassroomManagementApiError(
        recipientError.message || "Failed to create Quick Assignment recipients.",
        500,
      );
    }

    return NextResponse.json(
      {
        classroom: { id: classroom.id, name: classroom.name, created },
        title,
        assignmentCount: assignments.length,
        recipientCount: assignments.length + restorableAssignmentIds.length,
        reactivatedRecipientCount: restorableAssignmentIds.length,
        skippedExistingSectionCount:
          sectionIds.length - missingSectionIds.length - restorableAssignmentIds.length,
        classroomMembershipCreated: membershipCreated,
        assignments,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("admin quick assign creation route error", error);
    return jsonError(error);
  }
}
