import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canAccessAdminRoute, getEmailDomain, isMasterRole } from "@/lib/auth/roles";
import { SECTIONS } from "@/lib/course/algebra1";
import type { AdminOrgDashboard } from "@/lib/admin/orgDashboard";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  requested_role: string | null;
  approval_status: string | null;
  email_domain: string | null;
  is_active: boolean | null;
};

type ClassroomRow = {
  id: string;
  teacher_id: string;
  name: string;
};

type ClassroomMemberRow = {
  classroom_id: string;
  user_id: string;
};

type AssignmentRow = {
  id: string;
  classroom_id: string;
  title: string;
  description: string | null;
  section_id: string | null;
  due_date: string | null;
  created_at: string;
  archived_at: string | null;
};

type AssignmentRecipientRow = {
  assignment_id: string;
  classroom_id: string;
  user_id: string;
  status: string | null;
  assigned_at: string | null;
  completed_at: string | null;
};

type ProgressRow = {
  user_id: string;
  section_id: string | null;
  completion_percent: number | string | null;
  accuracy_percent: number | string | null;
  last_active_at: string | null;
};

type AttemptRow = {
  user_id: string;
  section_id: string | null;
  question_id: string | null;
  correct: boolean | null;
  attempted_at: string | null;
};

class AdminDashboardApiError extends Error {
  status: number;
  code:
    | "admin_pending"
    | "admin_denied"
    | "admin_missing_domain"
    | "unauthorized";
  profile?: Pick<ProfileRow, "requested_role" | "approval_status" | "email_domain">;

  constructor(
    message: string,
    status: number,
    code: AdminDashboardApiError["code"],
    profile?: AdminDashboardApiError["profile"],
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.profile = profile;
  }
}

function apiError(error: unknown) {
  if (error instanceof AdminDashboardApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        profile: error.profile,
      },
      { status: error.status },
    );
  }

  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Failed to load administrator dashboard.",
    },
    { status: 500 },
  );
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentOrNull(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function averagePercent(values: Array<number | null | undefined>) {
  const filtered = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  if (filtered.length === 0) return null;

  return percentOrNull(
    filtered.reduce((sum, value) => sum + value, 0) / filtered.length,
  );
}

function effectiveDomain(profile: Pick<ProfileRow, "email" | "email_domain"> | null | undefined) {
  return profile?.email_domain ?? getEmailDomain(profile?.email);
}

function isInEffectiveDomain(
  profile: Pick<ProfileRow, "email" | "email_domain">,
  domain: string | null,
) {
  return Boolean(domain) && effectiveDomain(profile) === domain;
}

function latestDate(values: Array<string | null | undefined>) {
  const valid = values.filter((value): value is string => Boolean(value));

  if (valid.length === 0) return null;

  return valid.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

function getSectionTitle(sectionId: string | null | undefined) {
  if (!sectionId) return "No section selected";
  const section = SECTIONS.find((item) => item.id === sectionId);
  return section
    ? `Chapter ${section.chapterNumber}, Section ${section.sectionNumber}: ${section.title}`
    : sectionId;
}

function getAssignmentGroupKey(assignment: AssignmentRow) {
  return [
    assignment.classroom_id,
    assignment.title.trim().toLowerCase(),
    (assignment.description ?? "").trim().toLowerCase(),
    assignment.due_date ?? "",
  ].join("::");
}

type InQuery<T> = {
  in: (
    column: string,
    values: string[],
  ) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>;
};

async function selectIn<T>(
  query: unknown,
  column: string,
  ids: string[],
): Promise<{ data: T[]; error: { message?: string } | null }> {
  if (ids.length === 0) {
    return { data: [], error: null };
  }

  const inQuery = query as InQuery<T>;
  const { data, error } = await inQuery.in(column, ids);

  return { data: (data ?? []) as T[], error };
}

async function getRouteContext(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const authHeader = req.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!accessToken) {
    throw new AdminDashboardApiError(
      "Missing authorization token.",
      401,
      "unauthorized",
    );
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    throw new AdminDashboardApiError(
      userError?.message || "Unauthorized.",
      401,
      "unauthorized",
    );
  }

  const { data: profileData, error: profileError } = await adminClient
    .from("profiles")
    .select("id,email,full_name,role,requested_role,approval_status,email_domain,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message || "Failed to verify administrator access.");
  }

  const profile = profileData as ProfileRow | null;

  if (!profile) {
    throw new AdminDashboardApiError(
      "Profile not found.",
      403,
      "admin_denied",
    );
  }

  if (canAccessAdminRoute(profile.role, profile.approval_status)) {
    const isMaster = isMasterRole(profile.role);
    const domain = effectiveDomain(profile);

    if (!isMaster && !domain) {
      throw new AdminDashboardApiError(
        "Administrator account is missing an email domain.",
        403,
        "admin_missing_domain",
        {
          requested_role: profile.requested_role,
          approval_status: profile.approval_status,
          email_domain: effectiveDomain(profile),
        },
      );
    }

    return { adminClient, profile, isMaster, domain };
  }

  if (
    profile.requested_role === "admin" &&
    profile.approval_status === "pending" &&
    profile.role !== "admin"
  ) {
    throw new AdminDashboardApiError(
      "Administrator approval pending.",
      403,
      "admin_pending",
      {
        requested_role: profile.requested_role,
        approval_status: profile.approval_status,
        email_domain: effectiveDomain(profile),
      },
    );
  }

  throw new AdminDashboardApiError(
    "Administrator access requires an approved administrator account.",
    403,
    "admin_denied",
  );
}

function buildDashboard({
  isMaster,
  domain,
  teachers,
  students,
  classrooms,
  memberships,
  assignments,
  recipients,
  progressRows,
  attemptRows,
}: {
  isMaster: boolean;
  domain: string | null;
  teachers: ProfileRow[];
  students: ProfileRow[];
  classrooms: ClassroomRow[];
  memberships: ClassroomMemberRow[];
  assignments: AssignmentRow[];
  recipients: AssignmentRecipientRow[];
  progressRows: ProgressRow[];
  attemptRows: AttemptRow[];
}): AdminOrgDashboard {
  const classroomMap = new Map(classrooms.map((classroom) => [classroom.id, classroom]));
  const domainStudentIds = new Set(students.map((student) => student.id));
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const classroomIds = new Set(classrooms.map((classroom) => classroom.id));

  const orgMemberships = memberships.filter(
    (membership) =>
      domainStudentIds.has(membership.user_id) && classroomIds.has(membership.classroom_id),
  );
  const orgRecipients = recipients.filter(
    (recipient) =>
      domainStudentIds.has(recipient.user_id) && assignmentIds.has(recipient.assignment_id),
  );
  const orgProgressRows = progressRows.filter((row) => domainStudentIds.has(row.user_id));
  const orgAttemptRows = attemptRows.filter((row) => domainStudentIds.has(row.user_id));

  const regentsStudentIds = new Set<string>();
  orgMemberships.forEach((membership) => regentsStudentIds.add(membership.user_id));
  orgRecipients.forEach((recipient) => regentsStudentIds.add(recipient.user_id));
  orgProgressRows.forEach((row) => regentsStudentIds.add(row.user_id));
  orgAttemptRows.forEach((row) => regentsStudentIds.add(row.user_id));

  const regentsStudents = students.filter((student) => regentsStudentIds.has(student.id));
  const studentIds = new Set(regentsStudents.map((student) => student.id));
  const filteredMemberships = orgMemberships.filter((membership) => studentIds.has(membership.user_id));
  const filteredRecipients = orgRecipients.filter((recipient) => studentIds.has(recipient.user_id));
  const filteredProgressRows = orgProgressRows.filter((row) => studentIds.has(row.user_id));
  const filteredAttemptRows = orgAttemptRows.filter((row) => studentIds.has(row.user_id));

  const regentsTeachers = teachers;
  const teacherMap = new Map(regentsTeachers.map((teacher) => [teacher.id, teacher]));
  const studentMap = new Map(regentsStudents.map((student) => [student.id, student]));

  const membershipsByClassroom = new Map<string, ClassroomMemberRow[]>();
  const membershipsByStudent = new Map<string, ClassroomMemberRow[]>();
  const classroomsByTeacher = new Map<string, ClassroomRow[]>();
  const assignmentGroupKeysByClassroom = new Map<string, Set<string>>();
  const assignmentGroupKeysByTeacher = new Map<string, Set<string>>();
  const recipientsByStudent = new Map<string, AssignmentRecipientRow[]>();
  const recipientsByAssignment = new Map<string, AssignmentRecipientRow[]>();
  const studentsByTeacher = new Map<string, Set<string>>();
  const assignmentGroups = new Map<string, AssignmentRow[]>();

  for (const classroom of classrooms) {
    classroomsByTeacher.set(classroom.teacher_id, [
      ...(classroomsByTeacher.get(classroom.teacher_id) ?? []),
      classroom,
    ]);
  }

  for (const membership of filteredMemberships) {
    membershipsByClassroom.set(membership.classroom_id, [
      ...(membershipsByClassroom.get(membership.classroom_id) ?? []),
      membership,
    ]);
    membershipsByStudent.set(membership.user_id, [
      ...(membershipsByStudent.get(membership.user_id) ?? []),
      membership,
    ]);

    const classroom = classroomMap.get(membership.classroom_id);
    if (classroom) {
      const teacherStudents = studentsByTeacher.get(classroom.teacher_id) ?? new Set<string>();
      teacherStudents.add(membership.user_id);
      studentsByTeacher.set(classroom.teacher_id, teacherStudents);
    }
  }

  for (const assignment of assignments) {
    const classroom = classroomMap.get(assignment.classroom_id);
    const groupKey = getAssignmentGroupKey(assignment);
    assignmentGroups.set(groupKey, [...(assignmentGroups.get(groupKey) ?? []), assignment]);

    const classroomGroupKeys =
      assignmentGroupKeysByClassroom.get(assignment.classroom_id) ?? new Set<string>();
    classroomGroupKeys.add(groupKey);
    assignmentGroupKeysByClassroom.set(assignment.classroom_id, classroomGroupKeys);

    if (classroom) {
      const teacherGroupKeys =
        assignmentGroupKeysByTeacher.get(classroom.teacher_id) ?? new Set<string>();
      teacherGroupKeys.add(groupKey);
      assignmentGroupKeysByTeacher.set(classroom.teacher_id, teacherGroupKeys);
    }
  }

  for (const recipient of filteredRecipients) {
    recipientsByStudent.set(recipient.user_id, [
      ...(recipientsByStudent.get(recipient.user_id) ?? []),
      recipient,
    ]);
    recipientsByAssignment.set(recipient.assignment_id, [
      ...(recipientsByAssignment.get(recipient.assignment_id) ?? []),
      recipient,
    ]);
  }

  const progressByStudent = new Map<string, ProgressRow[]>();
  const attemptsByStudent = new Map<string, AttemptRow[]>();

  for (const row of filteredProgressRows) {
    progressByStudent.set(row.user_id, [...(progressByStudent.get(row.user_id) ?? []), row]);
  }

  for (const row of filteredAttemptRows) {
    attemptsByStudent.set(row.user_id, [...(attemptsByStudent.get(row.user_id) ?? []), row]);
  }

  const studentMetrics = new Map<
    string,
    {
      completion: number | null;
      accuracy: number | null;
      lastActivityAt: string | null;
      totalAttempts: number;
      correctAttempts: number;
      incorrectAttempts: number;
    }
  >();

  for (const student of regentsStudents) {
    const studentProgress = progressByStudent.get(student.id) ?? [];
    const studentAttempts = attemptsByStudent.get(student.id) ?? [];
    const attempted = studentAttempts.length;
    const correct = studentAttempts.filter((attempt) => attempt.correct === true).length;
    const incorrect = studentAttempts.filter((attempt) => attempt.correct === false).length;
    const completion = averagePercent(
      studentProgress.map((row) => toNumber(row.completion_percent)),
    );
    const progressAccuracy = averagePercent(
      studentProgress.map((row) => toNumber(row.accuracy_percent)),
    );
    const attemptAccuracy =
      attempted > 0 ? percentOrNull((correct / attempted) * 100) : null;

    studentMetrics.set(student.id, {
      completion,
      accuracy: attemptAccuracy ?? progressAccuracy,
      lastActivityAt: latestDate([
        ...studentProgress.map((row) => row.last_active_at),
        ...studentAttempts.map((row) => row.attempted_at),
      ]),
      totalAttempts: attempted,
      correctAttempts: correct,
      incorrectAttempts: incorrect,
    });
  }

  const averageForStudents = (ids: string[], metric: "completion" | "accuracy") =>
    averagePercent(ids.map((id) => studentMetrics.get(id)?.[metric] ?? null));

  const assignmentMetricsForStudent = (studentId: string, sectionId: string | null) => {
    const sectionProgress = (progressByStudent.get(studentId) ?? []).filter(
      (row) => row.section_id === sectionId,
    );
    const sectionAttempts = (attemptsByStudent.get(studentId) ?? []).filter(
      (row) => row.section_id === sectionId,
    );
    const attempted = sectionAttempts.length;
    const correct = sectionAttempts.filter((attempt) => attempt.correct === true).length;

    return {
      completion: averagePercent(sectionProgress.map((row) => toNumber(row.completion_percent))),
      accuracy:
        attempted > 0
          ? percentOrNull((correct / attempted) * 100)
          : averagePercent(sectionProgress.map((row) => toNumber(row.accuracy_percent))),
      hasProgress: sectionProgress.length > 0,
      hasAttempts: attempted > 0,
    };
  };

  const progressPercentOrNull = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const averageAssignmentSectionProgress = (assignmentsForGroup: AssignmentRow[]) => {
    const progressValues: number[] = [];

    for (const assignment of assignmentsForGroup) {
      const assignmentRecipients = recipientsByAssignment.get(assignment.id) ?? [];
      const activeRecipients = assignmentRecipients.filter(
        (recipient) => recipient.status !== "excused" && recipient.status !== "archived",
      );

      for (const recipient of activeRecipients) {
        const matchingProgressRows = (progressByStudent.get(recipient.user_id) ?? []).filter(
          (row) => row.section_id === assignment.section_id,
        );

        for (const row of matchingProgressRows) {
          const progress = progressPercentOrNull(row.completion_percent);
          if (progress !== null) progressValues.push(progress);
        }
      }
    }

    return averagePercent(progressValues);
  };

  const getGroupedRecipientStatusCounts = (recipientsForGroup: AssignmentRecipientRow[]) => {
    const statusesByUser = new Map<string, Array<string | null>>();

    for (const recipient of recipientsForGroup) {
      statusesByUser.set(recipient.user_id, [
        ...(statusesByUser.get(recipient.user_id) ?? []),
        recipient.status,
      ]);
    }

    let completedCount = 0;
    let incompleteCount = 0;
    let excusedCount = 0;

    for (const statuses of statusesByUser.values()) {
      if (statuses.length > 0 && statuses.every((status) => status === "excused")) {
        excusedCount += 1;
      } else if (statuses.length > 0 && statuses.every((status) => status === "completed")) {
        completedCount += 1;
      } else {
        incompleteCount += 1;
      }
    }

    return {
      recipientCount: statusesByUser.size,
      completedCount,
      incompleteCount,
      excusedCount,
    };
  };

  const teachersPayload = regentsTeachers
    .map((teacher) => {
      const teacherClassrooms = classroomsByTeacher.get(teacher.id) ?? [];
      const teacherStudentIds = [...(studentsByTeacher.get(teacher.id) ?? new Set<string>())];

      return {
        id: teacher.id,
        fullName: teacher.full_name,
        email: teacher.email,
        classroomCount: teacherClassrooms.length,
        studentCount: teacherStudentIds.length,
        assignmentCount: assignmentGroupKeysByTeacher.get(teacher.id)?.size ?? 0,
        averageCompletion: averageForStudents(teacherStudentIds, "completion"),
        averageAccuracy: averageForStudents(teacherStudentIds, "accuracy"),
      };
    })
    .sort((a, b) => (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? ""));

  const studentsPayload = regentsStudents
    .map((student) => {
      const metrics = studentMetrics.get(student.id);

      return {
        id: student.id,
        fullName: student.full_name,
        email: student.email,
        emailDomain: effectiveDomain(student),
        isActive: student.is_active === true,
        classroomCount: membershipsByStudent.get(student.id)?.length ?? 0,
        assignedWorkCount: recipientsByStudent.get(student.id)?.length ?? 0,
        completionPercent: metrics?.completion ?? null,
        accuracyPercent: metrics?.accuracy ?? null,
        lastActivityAt: metrics?.lastActivityAt ?? null,
      };
    })
    .sort((a, b) => (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? ""));

  const assignmentCandidateStudents = students
    .filter((student) => student.role === "student" && student.is_active === true)
    .map((student) => ({
      id: student.id,
      fullName: student.full_name,
      email: student.email,
      emailDomain: effectiveDomain(student),
      isActive: student.is_active === true,
    }))
    .sort((a, b) => (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? ""));

  const classroomsPayload = classrooms
    .map((classroom) => {
      const classroomMemberships = membershipsByClassroom.get(classroom.id) ?? [];
      const classroomStudentIds = classroomMemberships.map((membership) => membership.user_id);
      const teacher = teacherMap.get(classroom.teacher_id);

      return {
        id: classroom.id,
        name: classroom.name,
        teacherId: classroom.teacher_id,
        teacherName: teacher?.full_name ?? null,
        teacherEmail: teacher?.email ?? null,
        studentCount: classroomStudentIds.length,
        assignmentCount: assignmentGroupKeysByClassroom.get(classroom.id)?.size ?? 0,
        averageCompletion: averageForStudents(classroomStudentIds, "completion"),
        averageAccuracy: averageForStudents(classroomStudentIds, "accuracy"),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const assignmentsPayload = [...assignmentGroups.entries()]
    .map(([groupId, groupAssignments]) => {
      const sortedAssignments = [...groupAssignments].sort((left, right) =>
        getSectionTitle(left.section_id).localeCompare(getSectionTitle(right.section_id)),
      );
      const first = sortedAssignments[0];
      const classroom = classroomMap.get(first.classroom_id);
      const teacher = classroom ? teacherMap.get(classroom.teacher_id) : undefined;
      const groupRecipients = sortedAssignments.flatMap(
        (assignment) => recipientsByAssignment.get(assignment.id) ?? [],
      );
      const groupedRecipientStatusCounts = getGroupedRecipientStatusCounts(groupRecipients);
      const sectionAssignments = sortedAssignments.map((assignment) => {
        const assignmentRecipients = recipientsByAssignment.get(assignment.id) ?? [];
        const assignmentCompletedCount = assignmentRecipients.filter(
          (recipient) => recipient.status === "completed",
        ).length;
        const assignmentExcusedCount = assignmentRecipients.filter(
          (recipient) => recipient.status === "excused",
        ).length;

        return {
          id: assignment.id,
          sectionId: assignment.section_id,
          sectionTitle: getSectionTitle(assignment.section_id),
          dueDate: assignment.due_date,
          createdAt: assignment.created_at,
          archivedAt: assignment.archived_at,
          recipientCount: assignmentRecipients.length,
          completedCount: assignmentCompletedCount,
          incompleteCount: Math.max(
            assignmentRecipients.length - assignmentCompletedCount - assignmentExcusedCount,
            0,
          ),
          excusedCount: assignmentExcusedCount,
          recipients: assignmentRecipients
            .map((recipient) => {
              const student = studentMap.get(recipient.user_id);
              const metrics = assignmentMetricsForStudent(
                recipient.user_id,
                assignment.section_id,
              );

              return {
                userId: recipient.user_id,
                fullName: student?.full_name ?? null,
                email: student?.email ?? null,
                status: recipient.status,
                assignedAt: recipient.assigned_at,
                completedAt: recipient.completed_at,
                completionPercent: metrics?.completion ?? null,
                accuracyPercent: metrics?.accuracy ?? null,
                hasProgress: metrics?.hasProgress ?? false,
                hasAttempts: metrics?.hasAttempts ?? false,
              };
            })
            .sort((a, b) => (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? "")),
        };
      });

      return {
        id: groupId,
        assignmentIds: sortedAssignments.map((assignment) => assignment.id),
        title: first.title,
        description: first.description,
        teacherId: classroom?.teacher_id ?? "",
        teacherName: teacher?.full_name ?? null,
        teacherEmail: teacher?.email ?? null,
        classroomId: first.classroom_id,
        classroomName: classroom?.name ?? null,
        dueDate: first.due_date,
        sectionIds: sortedAssignments.map((assignment) => assignment.section_id),
        sectionCount: sortedAssignments.length,
        recipientCount: groupedRecipientStatusCounts.recipientCount,
        completedCount: groupedRecipientStatusCounts.completedCount,
        incompleteCount: groupedRecipientStatusCounts.incompleteCount,
        excusedCount: groupedRecipientStatusCounts.excusedCount,
        averageProgress: averageAssignmentSectionProgress(sortedAssignments),
        archivedAt: sortedAssignments.every((assignment) => Boolean(assignment.archived_at))
          ? latestDate(sortedAssignments.map((assignment) => assignment.archived_at))
          : null,
        sectionAssignments,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const studentDetails: AdminOrgDashboard["studentDetails"] = Object.fromEntries(
    regentsStudents.map((student) => {
      const metrics = studentMetrics.get(student.id);
      const studentMemberships = membershipsByStudent.get(student.id) ?? [];
      const studentRecipients = recipientsByStudent.get(student.id) ?? [];
      const studentProgress = progressByStudent.get(student.id) ?? [];
      const studentAttempts = attemptsByStudent.get(student.id) ?? [];
      const detailClassrooms = studentMemberships
        .map((membership) => {
          const classroom = classroomMap.get(membership.classroom_id);
          if (!classroom) return null;
          const teacher = teacherMap.get(classroom.teacher_id);
          return {
            id: classroom.id,
            name: classroom.name,
            teacherName: teacher?.full_name ?? null,
            teacherEmail: teacher?.email ?? null,
          };
        })
        .filter((classroom): classroom is NonNullable<typeof classroom> => Boolean(classroom));
      const recentQuestionAttempts = [...studentAttempts]
        .sort((left, right) =>
          new Date(right.attempted_at ?? 0).getTime() - new Date(left.attempted_at ?? 0).getTime(),
        )
        .map((attempt) => ({
          questionId: attempt.question_id,
          sectionId: attempt.section_id,
          sectionTitle: getSectionTitle(attempt.section_id),
          correct: attempt.correct,
          attemptedAt: attempt.attempted_at,
        }));
      const assignmentActivity = studentRecipients.map((recipient) => {
        const assignment = assignments.find((item) => item.id === recipient.assignment_id);
        return {
          type: "assignment" as const,
          label: assignment?.title ?? "Assignment",
          detail: `${recipient.status ?? "assigned"}${assignment?.section_id ? ` · ${getSectionTitle(assignment.section_id)}` : ""}`,
          occurredAt: recipient.assigned_at,
        };
      });
      const progressActivity = studentProgress.map((progress) => ({
        type: "progress" as const,
        label: getSectionTitle(progress.section_id),
        detail: `${percentOrNull(toNumber(progress.completion_percent)) ?? 0}% complete`,
        occurredAt: progress.last_active_at,
      }));
      const recentActivity = [...assignmentActivity, ...progressActivity]
        .sort((left, right) =>
          new Date(right.occurredAt ?? 0).getTime() - new Date(left.occurredAt ?? 0).getTime(),
        );

      return [
        student.id,
        {
          studentId: student.id,
          fullName: student.full_name,
          email: student.email,
          classrooms: detailClassrooms,
          assignedWorkCount: studentRecipients.length,
          overallCompletion: metrics?.completion ?? null,
          overallAccuracy: metrics?.accuracy ?? null,
          totalQuestionAttempts: metrics?.totalAttempts ?? 0,
          correctAttempts: metrics?.correctAttempts ?? 0,
          incorrectAttempts: metrics?.incorrectAttempts ?? 0,
          recentActivity,
          recentQuestionAttempts,
        },
      ];
    }),
  );


  const recentActivity = Object.values(studentDetails)
    .flatMap((detail) => [
      ...detail.recentActivity.map((activity) => ({
        ...activity,
        studentId: detail.studentId,
        studentName: detail.fullName,
        studentEmail: detail.email,
      })),
      ...detail.recentQuestionAttempts.map((attempt) => ({
        type: "attempt" as const,
        label: attempt.sectionTitle,
        detail: `${attempt.correct ? "Correct" : "Incorrect"}${attempt.questionId ? ` · Question ${attempt.questionId}` : ""}`,
        occurredAt: attempt.attemptedAt,
        studentId: detail.studentId,
        studentName: detail.fullName,
        studentEmail: detail.email,
        correct: attempt.correct,
      })),
    ])
    .sort((left, right) =>
      new Date(right.occurredAt ?? 0).getTime() - new Date(left.occurredAt ?? 0).getTime(),
    );

  const allStudentIds = regentsStudents.map((student) => student.id);
  const summary = {
    organizationLabel: isMaster
      ? "Master Global Administrator View"
      : `Organization: ${domain}`,
    totalTeachers: teachersPayload.length,
    totalStudents: studentsPayload.length,
    totalClassrooms: classroomsPayload.length,
    activeAssignments: assignmentsPayload.filter((assignment) => !assignment.archivedAt).length,
    archivedAssignments: assignmentsPayload.filter((assignment) => Boolean(assignment.archivedAt)).length,
    totalGroupedAssignments: assignmentsPayload.length,
    averageCompletion: averageForStudents(allStudentIds, "completion"),
    averageAccuracy: averageForStudents(allStudentIds, "accuracy"),
  };

  return {
    scope: {
      type: isMaster ? "master_global" : "domain",
      domain: isMaster ? null : domain,
      label: summary.organizationLabel,
    },
    summary,
    teachers: teachersPayload,
    students: studentsPayload,
    assignmentCandidateStudents,
    classrooms: classroomsPayload,
    assignments: assignmentsPayload,
    studentDetails,
    recentActivity,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { adminClient, profile, isMaster, domain } = await getRouteContext(req);

    const teachersQuery = adminClient
      .from("profiles")
      .select("id,email,full_name,role,requested_role,approval_status,email_domain,is_active")
      .eq("role", "teacher")
      .eq("approval_status", "approved")
      .order("full_name", { ascending: true });

    const studentsQuery = adminClient
      .from("profiles")
      .select("id,email,full_name,role,requested_role,approval_status,email_domain,is_active")
      .eq("role", "student")
      .order("full_name", { ascending: true });

    const [teachersResponse, studentsResponse] = await Promise.all([
      teachersQuery,
      studentsQuery,
    ]);

    if (teachersResponse.error) {
      throw new Error(teachersResponse.error.message || "Failed to load teachers.");
    }
    if (studentsResponse.error) {
      throw new Error(studentsResponse.error.message || "Failed to load students.");
    }

    const allTeachers = (teachersResponse.data ?? []) as ProfileRow[];
    const allStudents = (studentsResponse.data ?? []) as ProfileRow[];
    const teachers = isMaster
      ? allTeachers
      : allTeachers.filter((teacher) => isInEffectiveDomain(teacher, domain));
    const students = isMaster
      ? allStudents
      : allStudents.filter((student) => isInEffectiveDomain(student, domain));
    const teacherIds = teachers.map((teacher) => teacher.id);
    const studentIds = students.map((student) => student.id);

    let classrooms: ClassroomRow[] = [];

    if (isMaster) {
      const { data, error } = await adminClient
        .from("classrooms")
        .select("id,teacher_id,name")
        .order("name", { ascending: true });

      if (error) throw new Error(error.message || "Failed to load classrooms.");
      classrooms = (data ?? []) as ClassroomRow[];
    } else {
      const visibleOwnerIds = [...new Set([...teacherIds, profile.id])];
      const { data, error } = await selectIn<ClassroomRow>(
        adminClient.from("classrooms").select("id,teacher_id,name").order("name", {
          ascending: true,
        }),
        "teacher_id",
        visibleOwnerIds,
      );

      if (error) throw new Error(error.message || "Failed to load classrooms.");
      classrooms = data;
    }

    const classroomIds = classrooms.map((classroom) => classroom.id);
    const classroomTeacherIds = [
      ...new Set(classrooms.map((classroom) => classroom.teacher_id)),
    ];
    const missingTeacherIds = classroomTeacherIds.filter(
      (teacherId) => !teacherIds.includes(teacherId),
    );

    let visibleTeachers = teachers;
    if (missingTeacherIds.length > 0) {
      const { data, error } = await selectIn<ProfileRow>(
        adminClient
          .from("profiles")
          .select("id,email,full_name,role,requested_role,approval_status,email_domain,is_active"),
        "id",
        missingTeacherIds,
      );

      if (error) throw new Error(error.message || "Failed to load classroom teachers.");
      visibleTeachers = [...teachers, ...data];
    }

    const [membershipsResponse, assignmentsResponse, progressResponse, attemptsResponse] =
      await Promise.all([
        selectIn<ClassroomMemberRow>(
          adminClient.from("classroom_members").select("classroom_id,user_id"),
          "classroom_id",
          classroomIds,
        ),
        selectIn<AssignmentRow>(
          adminClient
            .from("assignments")
            .select("id,classroom_id,title,description,section_id,due_date,created_at,archived_at")
            .order("created_at", { ascending: false }),
          "classroom_id",
          classroomIds,
        ),
        selectIn<ProgressRow>(
          adminClient
            .from("student_progress")
            .select("user_id,section_id,completion_percent,accuracy_percent,last_active_at")
            .eq("app_id", "regents-algebra")
            .eq("course_id", "algebra1"),
          "user_id",
          studentIds,
        ),
        selectIn<AttemptRow>(
          adminClient
            .from("question_attempts")
            .select("user_id,section_id,question_id,correct,attempted_at")
            .eq("app_id", "regents-algebra")
            .eq("course_id", "algebra1"),
          "user_id",
          studentIds,
        ),
      ]);

    for (const response of [
      membershipsResponse,
      assignmentsResponse,
      progressResponse,
      attemptsResponse,
    ]) {
      if (response.error) {
        throw new Error(response.error.message || "Failed to load dashboard data.");
      }
    }

    const regentsAssignments = assignmentsResponse.data.filter((assignment) =>
      /^ch[0-9]+_s[0-9]+$/.test(assignment.section_id ?? ""),
    );
    const assignmentIds = regentsAssignments.map((assignment) => assignment.id);
    const { data: recipients, error: recipientsError } =
      await selectIn<AssignmentRecipientRow>(
        adminClient
          .from("assignment_recipients")
          .select("assignment_id,classroom_id,user_id,status,assigned_at,completed_at"),
        "assignment_id",
        assignmentIds,
      );

    if (recipientsError) {
      throw new Error(recipientsError.message || "Failed to load assignment recipients.");
    }

    const payload = buildDashboard({
      isMaster,
      domain,
      teachers: visibleTeachers,
      students,
      classrooms,
      memberships: membershipsResponse.data,
      assignments: regentsAssignments,
      recipients,
      progressRows: progressResponse.data,
      attemptRows: attemptsResponse.data,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("admin org dashboard route error", error);
    return apiError(error);
  }
}
