import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { canAccessAdminRoute, getEmailDomain, isMasterRole } from "@/lib/auth/roles";
import type { AdminOrgDashboard } from "@/lib/admin/orgDashboard";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  requested_role: string | null;
  approval_status: string | null;
  email_domain: string | null;
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
  due_date: string | null;
  created_at: string;
  archived_at: string | null;
};

type AssignmentRecipientRow = {
  assignment_id: string;
  classroom_id: string;
  user_id: string;
  status: string | null;
};

type ProgressRow = {
  user_id: string;
  completion_percent: number | string | null;
  accuracy_percent: number | string | null;
  last_active_at: string | null;
};

type AttemptRow = {
  user_id: string;
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

function latestDate(values: Array<string | null | undefined>) {
  const valid = values.filter((value): value is string => Boolean(value));

  if (valid.length === 0) return null;

  return valid.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
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
    .select("id,email,full_name,role,requested_role,approval_status,email_domain")
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
    const domain = profile.email_domain ?? getEmailDomain(profile.email);

    if (!isMaster && !domain) {
      throw new AdminDashboardApiError(
        "Administrator account is missing an email domain.",
        403,
        "admin_missing_domain",
        {
          requested_role: profile.requested_role,
          approval_status: profile.approval_status,
          email_domain: profile.email_domain,
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
        email_domain: profile.email_domain ?? getEmailDomain(profile.email),
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
  const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const classroomMap = new Map(classrooms.map((classroom) => [classroom.id, classroom]));
  const studentIds = new Set(students.map((student) => student.id));

  const orgMemberships = memberships.filter((membership) =>
    studentIds.has(membership.user_id),
  );
  const orgRecipients = recipients.filter((recipient) => studentIds.has(recipient.user_id));

  const membershipsByClassroom = new Map<string, ClassroomMemberRow[]>();
  const membershipsByStudent = new Map<string, ClassroomMemberRow[]>();
  const classroomsByTeacher = new Map<string, ClassroomRow[]>();
  const assignmentsByClassroom = new Map<string, AssignmentRow[]>();
  const assignmentsByTeacher = new Map<string, AssignmentRow[]>();
  const recipientsByStudent = new Map<string, AssignmentRecipientRow[]>();
  const recipientsByAssignment = new Map<string, AssignmentRecipientRow[]>();
  const studentsByTeacher = new Map<string, Set<string>>();

  for (const classroom of classrooms) {
    classroomsByTeacher.set(classroom.teacher_id, [
      ...(classroomsByTeacher.get(classroom.teacher_id) ?? []),
      classroom,
    ]);
  }

  for (const membership of orgMemberships) {
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
    assignmentsByClassroom.set(assignment.classroom_id, [
      ...(assignmentsByClassroom.get(assignment.classroom_id) ?? []),
      assignment,
    ]);

    if (classroom) {
      assignmentsByTeacher.set(classroom.teacher_id, [
        ...(assignmentsByTeacher.get(classroom.teacher_id) ?? []),
        assignment,
      ]);
    }
  }

  for (const recipient of orgRecipients) {
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

  for (const row of progressRows) {
    progressByStudent.set(row.user_id, [...(progressByStudent.get(row.user_id) ?? []), row]);
  }

  for (const row of attemptRows) {
    attemptsByStudent.set(row.user_id, [...(attemptsByStudent.get(row.user_id) ?? []), row]);
  }

  const studentMetrics = new Map<
    string,
    {
      completion: number | null;
      accuracy: number | null;
      lastActivityAt: string | null;
    }
  >();

  for (const student of students) {
    const studentProgress = progressByStudent.get(student.id) ?? [];
    const studentAttempts = attemptsByStudent.get(student.id) ?? [];
    const attempted = studentAttempts.length;
    const correct = studentAttempts.filter((attempt) => attempt.correct === true).length;
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
    });
  }

  const averageForStudents = (ids: string[], metric: "completion" | "accuracy") =>
    averagePercent(ids.map((id) => studentMetrics.get(id)?.[metric] ?? null));

  const teachersPayload = teachers
    .map((teacher) => {
      const teacherClassrooms = classroomsByTeacher.get(teacher.id) ?? [];
      const teacherStudentIds = [...(studentsByTeacher.get(teacher.id) ?? new Set<string>())];

      return {
        id: teacher.id,
        fullName: teacher.full_name,
        email: teacher.email,
        classroomCount: teacherClassrooms.length,
        studentCount: teacherStudentIds.length,
        assignmentCount: assignmentsByTeacher.get(teacher.id)?.length ?? 0,
        averageCompletion: averageForStudents(teacherStudentIds, "completion"),
        averageAccuracy: averageForStudents(teacherStudentIds, "accuracy"),
      };
    })
    .sort((a, b) => (a.fullName ?? a.email ?? "").localeCompare(b.fullName ?? b.email ?? ""));

  const studentsPayload = students
    .map((student) => {
      const metrics = studentMetrics.get(student.id);

      return {
        id: student.id,
        fullName: student.full_name,
        email: student.email,
        classroomCount: membershipsByStudent.get(student.id)?.length ?? 0,
        assignedWorkCount: recipientsByStudent.get(student.id)?.length ?? 0,
        completionPercent: metrics?.completion ?? null,
        accuracyPercent: metrics?.accuracy ?? null,
        lastActivityAt: metrics?.lastActivityAt ?? null,
      };
    })
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
        assignmentCount: assignmentsByClassroom.get(classroom.id)?.length ?? 0,
        averageCompletion: averageForStudents(classroomStudentIds, "completion"),
        averageAccuracy: averageForStudents(classroomStudentIds, "accuracy"),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const assignmentsPayload = assignments
    .map((assignment) => {
      const classroom = classroomMap.get(assignment.classroom_id);
      const teacher = classroom ? teacherMap.get(classroom.teacher_id) : undefined;
      const assignmentRecipients = recipientsByAssignment.get(assignment.id) ?? [];
      const completedCount = assignmentRecipients.filter(
        (recipient) => recipient.status === "completed",
      ).length;
      const excusedCount = assignmentRecipients.filter(
        (recipient) => recipient.status === "excused",
      ).length;
      const incompleteCount = Math.max(
        assignmentRecipients.length - completedCount - excusedCount,
        0,
      );

      return {
        id: assignment.id,
        title: assignment.title,
        teacherId: classroom?.teacher_id ?? "",
        teacherName: teacher?.full_name ?? null,
        teacherEmail: teacher?.email ?? null,
        classroomId: assignment.classroom_id,
        classroomName: classroom?.name ?? null,
        dueDate: assignment.due_date,
        recipientCount: assignmentRecipients.length,
        completedCount,
        incompleteCount,
        excusedCount,
        averageProgress: averageForStudents(
          assignmentRecipients.map((recipient) => recipient.user_id),
          "completion",
        ),
        archivedAt: assignment.archived_at,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  const allStudentIds = students.map((student) => student.id);
  const summary = {
    organizationLabel: isMaster
      ? "Master Global Administrator View"
      : `Organization: ${domain}`,
    totalTeachers: teachersPayload.length,
    totalStudents: studentsPayload.length,
    totalClassrooms: classroomsPayload.length,
    activeAssignments: assignmentsPayload.filter((assignment) => !assignment.archivedAt).length,
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
    classrooms: classroomsPayload,
    assignments: assignmentsPayload,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { adminClient, isMaster, domain } = await getRouteContext(req);

    let teachersQuery = adminClient
      .from("profiles")
      .select("id,email,full_name,role,requested_role,approval_status,email_domain")
      .eq("role", "teacher")
      .eq("approval_status", "approved")
      .order("full_name", { ascending: true });

    let studentsQuery = adminClient
      .from("profiles")
      .select("id,email,full_name,role,requested_role,approval_status,email_domain")
      .eq("role", "student")
      .order("full_name", { ascending: true });

    if (!isMaster) {
      teachersQuery = teachersQuery.eq("email_domain", domain);
      studentsQuery = studentsQuery.eq("email_domain", domain);
    }

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

    const teachers = (teachersResponse.data ?? []) as ProfileRow[];
    const students = (studentsResponse.data ?? []) as ProfileRow[];
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
      const { data, error } = await selectIn<ClassroomRow>(
        adminClient.from("classrooms").select("id,teacher_id,name").order("name", {
          ascending: true,
        }),
        "teacher_id",
        teacherIds,
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
          .select("id,email,full_name,role,requested_role,approval_status,email_domain"),
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
            .select("id,classroom_id,title,due_date,created_at,archived_at")
            .order("created_at", { ascending: false }),
          "classroom_id",
          classroomIds,
        ),
        selectIn<ProgressRow>(
          adminClient
            .from("student_progress")
            .select("user_id,completion_percent,accuracy_percent,last_active_at")
            .eq("app_id", "regents-algebra")
            .eq("course_id", "algebra1"),
          "user_id",
          studentIds,
        ),
        selectIn<AttemptRow>(
          adminClient
            .from("question_attempts")
            .select("user_id,correct,attempted_at")
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

    const assignmentIds = assignmentsResponse.data.map((assignment) => assignment.id);
    const { data: recipients, error: recipientsError } =
      await selectIn<AssignmentRecipientRow>(
        adminClient
          .from("assignment_recipients")
          .select("assignment_id,classroom_id,user_id,status"),
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
      assignments: assignmentsResponse.data,
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
