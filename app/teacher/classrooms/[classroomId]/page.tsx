// app/teacher/classrooms/[classroomId]/page.tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isTeacherLikeRole } from "@/lib/auth/roles";
import { getTeacherClassroomById } from "@/lib/classrooms/getTeacherClassroomById";
import {
  getClassroomRoster,
  type ClassroomRosterMember,
} from "@/lib/classrooms/getClassroomRoster";
import { removeStudentFromClassroom } from "@/lib/classrooms/removeStudentFromClassroom";
import {
  searchStudentsForClassroom,
  type SearchStudentResult,
} from "@/lib/classrooms/searchStudentsForClassroom";
import { addStudentsToClassroom } from "@/lib/classrooms/addStudentsToClassroom";
import {
  createStudentAndAddToClassroom,
  type CreateStudentAndAddResult,
} from "@/lib/classrooms/createStudentAndAddToClassroom";
import {
  createClassroomAssignment,
  type ClassroomAssignment,
} from "@/lib/classrooms/createClassroomAssignment";
import { getClassroomAssignments } from "@/lib/classrooms/getClassroomAssignments";
import type { Classroom } from "@/types/classroom";

type PageProps = {
  params: Promise<{
    classroomId: string;
  }>;
};

export default function ClassroomDetailPage({ params }: PageProps) {
  const [classroomId, setClassroomId] = useState<string>("");
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [roster, setRoster] = useState<ClassroomRosterMember[]>([]);
  const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [rosterMessage, setRosterMessage] = useState<string | null>(null);

  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchStudentResult[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [addingStudents, setAddingStudents] = useState(false);

  const [newStudentFullName, setNewStudentFullName] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [creatingStudent, setCreatingStudent] = useState(false);

  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [assignmentDueDate, setAssignmentDueDate] = useState("");
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    params.then(({ classroomId }) => {
      if (active) {
        setClassroomId(classroomId);
      }
    });

    return () => {
      active = false;
    };
  }, [params]);

  const loadClassroom = useCallback(async () => {
    if (!classroomId) return;

    try {
      setLoading(true);
      setError(null);

      const supabase: any = getSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message || "Failed to load user.");
      }

      if (!user) {
        throw new Error("Please log in to view this classroom.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(
          profileError.message || "Failed to verify teacher access."
        );
      }

      if (!profile || !isTeacherLikeRole(profile.role)) {
        throw new Error("Teacher access required.");
      }

      const [classroomData, rosterData, assignmentData] = await Promise.all([
        getTeacherClassroomById(classroomId),
        getClassroomRoster(classroomId),
        getClassroomAssignments(classroomId),
      ]);

      if (!classroomData) {
        throw new Error(
          "Classroom not found or you do not have access to it."
        );
      }

      setClassroom(classroomData);
      setRoster(rosterData ?? []);
      setAssignments(assignmentData ?? []);
    } catch (err: any) {
      console.error(err);
      setClassroom(null);
      setRoster([]);
      setAssignments([]);
      setError(err?.message || "Failed to load classroom.");
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    void loadClassroom();
  }, [loadClassroom]);

  const joinLink = useMemo(() => {
    if (!classroom?.class_code) return "";
    if (typeof window === "undefined") return "";

    const url = new URL("/join-class", window.location.origin);
    url.searchParams.set("code", classroom.class_code);
    return url.toString();
  }, [classroom?.class_code]);

  const handleCopy = async (value: string, type: "code" | "link") => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      window.setTimeout(() => setCopied(null), 1600);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const handleRemoveStudent = async (member: ClassroomRosterMember) => {
    if (!classroomId) return;

    const displayName = member.full_name?.trim() || "this student";
    const confirmed = window.confirm(
      `Remove ${displayName} from this classroom?`
    );

    if (!confirmed) return;

    try {
      setRemovingUserId(member.user_id);
      setRosterMessage(null);

      await removeStudentFromClassroom(classroomId, member.user_id);

      setRoster((prev) => prev.filter((m) => m.id !== member.id));
      setRosterMessage(`${displayName} was removed from the classroom.`);
      setSearchResults((prev) =>
        prev.map((student) =>
          student.id === member.user_id
            ? { ...student, already_in_classroom: false }
            : student
        )
      );
      setSelectedStudentIds((prev) =>
        prev.filter((id) => id !== member.user_id)
      );
    } catch (err: any) {
      console.error(err);
      setRosterMessage(err?.message || "Failed to remove student.");
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleSearchStudents = async () => {
    if (!classroomId) return;

    const trimmed = studentSearch.trim();

    if (trimmed.length < 2) {
      setSearchResults([]);
      setSelectedStudentIds([]);
      setRosterMessage("Enter at least 2 characters to search.");
      return;
    }

    try {
      setSearchingStudents(true);
      setRosterMessage(null);

      const results = await searchStudentsForClassroom(classroomId, trimmed);
      setSearchResults(results);
      setSelectedStudentIds([]);

      if (results.length === 0) {
        setRosterMessage("No matching registered students found.");
      }
    } catch (err: any) {
      console.error(err);
      setSearchResults([]);
      setSelectedStudentIds([]);
      setRosterMessage(err?.message || "Failed to search students.");
    } finally {
      setSearchingStudents(false);
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleAddSelected = async () => {
    if (!classroomId) return;

    try {
      setAddingStudents(true);
      setRosterMessage(null);

      const idsToAdd = [...selectedStudentIds];
      const result = await addStudentsToClassroom(classroomId, idsToAdd);

      const parts: string[] = [];
      if (result.added_count > 0) {
        parts.push(
          `${result.added_count} student${result.added_count === 1 ? "" : "s"} added`
        );
      }
      if (result.already_enrolled_count > 0) {
        parts.push(`${result.already_enrolled_count} already enrolled`);
      }

      setRosterMessage(parts.join(". ") || "No students were added.");
      setSelectedStudentIds([]);

      await loadClassroom();

      setSearchResults((prev) =>
        prev.map((student) =>
          idsToAdd.includes(student.id)
            ? { ...student, already_in_classroom: true }
            : student
        )
      );
    } catch (err: any) {
      console.error(err);
      setRosterMessage(err?.message || "Failed to add selected students.");
    } finally {
      setAddingStudents(false);
    }
  };

  const handleCreateStudentAndAdd = async () => {
    if (!classroomId) return;

    try {
      setCreatingStudent(true);
      setRosterMessage(null);

      const result: CreateStudentAndAddResult =
        await createStudentAndAddToClassroom(
          classroomId,
          newStudentFullName,
          newStudentEmail
        );

      setNewStudentFullName("");
      setNewStudentEmail("");

      if (result.status === "created_and_added") {
        setRosterMessage(
          `${result.full_name || "Student"} was created, invited by email, and added to the classroom.`
        );
      } else if (result.status === "existing_user_added") {
        setRosterMessage(
          `${result.full_name || "Student"} already existed and was added to the classroom.`
        );
      } else {
        setRosterMessage(
          `${result.full_name || "Student"} is already enrolled in this classroom.`
        );
      }

      await loadClassroom();

      if (studentSearch.trim().length >= 2) {
        const refreshedResults = await searchStudentsForClassroom(
          classroomId,
          studentSearch.trim()
        );
        setSearchResults(refreshedResults);
        setSelectedStudentIds([]);
      }
    } catch (err: any) {
      console.error(err);
      setRosterMessage(err?.message || "Failed to create student.");
    } finally {
      setCreatingStudent(false);
    }
  };

  const handleCreateAssignment = async () => {
    if (!classroomId) return;

    try {
      setCreatingAssignment(true);
      setAssignmentMessage(null);

      const newAssignment = await createClassroomAssignment({
        classroomId,
        title: assignmentTitle,
        description: assignmentDescription,
        dueDate: assignmentDueDate,
      });

      setAssignments((prev) => [newAssignment, ...prev]);
      setAssignmentTitle("");
      setAssignmentDescription("");
      setAssignmentDueDate("");
      setAssignmentMessage("Assignment created.");
    } catch (err: any) {
      console.error(err);
      setAssignmentMessage(err?.message || "Failed to create assignment.");
    } finally {
      setCreatingAssignment(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Classroom Detail</h1>
          <p className="text-slate-300 mt-1">
            Review class information, roster, assignments, and progress.
          </p>
        </div>

        <Link
          href="/teacher/classrooms"
          className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
        >
          Back to My Classrooms
        </Link>
      </div>

      {loading && (
        <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
          <p className="text-sm text-gray-600">Loading classroom...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-300 text-red-800 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {!loading && !error && classroom && (
        <>
          <section className="bg-white rounded-xl shadow border border-gray-200 p-6 space-y-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
                  {classroom.subject || "Subject not set"}
                </p>
                <h2 className="mt-1 text-3xl font-bold text-gray-900">
                  {classroom.name}
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Term: {classroom.term || "Not set"}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Class Code
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-gray-900">
                      {classroom.class_code}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(classroom.class_code, "code")}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      {copied === "code" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Join Link
                  </p>
                  <div className="mt-2 space-y-2">
                    <p className="break-all text-sm text-gray-700">
                      {joinLink || "Join link will appear here."}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopy(joinLink, "link")}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      {copied === "link" ? "Copied" : "Copy Link"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="xl:col-span-1 bg-white rounded-xl shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Roster</h3>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {roster.length} student{roster.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mb-5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">
                  Add Existing Student
                </p>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-800">
                    Search Registered Students
                  </label>
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by full name or email"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSearchStudents}
                    disabled={searchingStudents}
                    className="rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {searchingStudents ? "Searching..." : "Search"}
                  </button>

                  <button
                    type="button"
                    onClick={handleAddSelected}
                    disabled={addingStudents || selectedStudentIds.length === 0}
                    className="rounded-lg border border-green-600 bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addingStudents ? "Adding..." : "Add Selected"}
                  </button>
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-3 text-sm font-semibold text-gray-900">
                    Search Results
                  </p>

                  <div className="space-y-2">
                    {searchResults.map((student) => {
                      const isSelected = selectedStudentIds.includes(student.id);

                      return (
                        <label
                          key={student.id}
                          className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                            student.already_in_classroom
                              ? "border-gray-200 bg-gray-100"
                              : isSelected
                                ? "border-blue-300 bg-blue-50"
                                : "border-gray-200 bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={student.already_in_classroom}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="mt-1"
                          />

                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {student.full_name?.trim() || "Student"}
                            </p>
                            <p className="text-xs text-gray-600 break-all">
                              {student.email || "No email available"}
                            </p>
                            <p className="mt-1 text-xs font-medium">
                              {student.already_in_classroom ? (
                                <span className="text-amber-700">
                                  Already in classroom
                                </span>
                              ) : (
                                <span className="text-green-700">
                                  Available to add
                                </span>
                              )}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">
                  Create New Student and Add to Classroom
                </p>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-800">
                    Student Full Name
                  </label>
                  <input
                    type="text"
                    value={newStudentFullName}
                    onChange={(e) => setNewStudentFullName(e.target.value)}
                    placeholder="James Orlando"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-800">
                    Student Email
                  </label>
                  <input
                    type="email"
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    placeholder="student@email.com"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateStudentAndAdd}
                  disabled={creatingStudent}
                  className="rounded-lg border border-purple-600 bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingStudent ? "Creating..." : "Create Student & Add"}
                </button>
              </div>

              {rosterMessage && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  {rosterMessage}
                </div>
              )}

              {roster.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                  No students have joined this classroom yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {roster.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {member.full_name?.trim() || "Student"}
                          </p>
                          <p className="mt-2 text-xs text-gray-500">
                            Joined{" "}
                            {new Date(member.joined_at).toLocaleDateString()}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(member)}
                          disabled={removingUserId === member.user_id}
                          className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {removingUserId === member.user_id
                            ? "Removing..."
                            : "Remove"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="xl:col-span-1 bg-white rounded-xl shadow border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Assignments
              </h3>

              <div className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-800">
                    Assignment Title
                  </label>
                  <input
                    type="text"
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    placeholder="Unit 1 Review"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-800">
                    Description
                  </label>
                  <textarea
                    value={assignmentDescription}
                    onChange={(e) => setAssignmentDescription(e.target.value)}
                    placeholder="Optional assignment directions"
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-800">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={assignmentDueDate}
                    onChange={(e) => setAssignmentDueDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateAssignment}
                  disabled={creatingAssignment}
                  className="rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingAssignment ? "Creating..." : "Create Assignment"}
                </button>
              </div>

              {assignmentMessage && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  {assignmentMessage}
                </div>
              )}

              <div className="mt-4 space-y-3">
                {assignments.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                    No assignments yet.
                  </div>
                ) : (
                  assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                    >
                      <p className="font-semibold text-gray-900">
                        {assignment.title}
                      </p>

                      {assignment.description && (
                        <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">
                          {assignment.description}
                        </p>
                      )}

                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                        <p>
                          Created{" "}
                          {new Date(assignment.created_at).toLocaleDateString()}
                        </p>
                        <p>
                          Due{" "}
                          {assignment.due_date
                            ? new Date(assignment.due_date).toLocaleDateString()
                            : "No due date"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="xl:col-span-1 bg-white rounded-xl shadow border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">Progress</h3>
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                Class progress summaries will go here in a later phase.
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}