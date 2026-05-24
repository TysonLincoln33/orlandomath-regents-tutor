'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SECTIONS } from '@/lib/course/algebra1';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  getMasterAlgebra1Assignments,
  getMasterAlgebra1Overview,
  getMasterAlgebra1UserProgress,
  type MasterAlgebra1AssignmentRow,
  type MasterOverviewUserRow,
  type MasterRecentAttempt,
} from '@/lib/master/getMasterAlgebra1Dashboard';

type Profile = { id: string; role: string | null; approval_status: string | null };

const formatDateTime = (value: string | null) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const formatCalendarDate = (value: string | null) => {
  if (!value) return 'No due date';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No due date';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const displayName = (u: { full_name?: string | null; email?: string | null; teacher_name?: string | null; teacher_email?: string | null }) =>
  u.full_name?.trim() || u.teacher_name?.trim() || u.email?.split('@')[0] || u.teacher_email?.split('@')[0] || 'Unknown User';

const getSectionLabel = (sectionId: string | null) => {
  if (!sectionId) return 'No section';
  const section = SECTIONS.find((item) => item.id === sectionId);
  if (!section) return sectionId;
  return `Chapter ${section.chapterNumber}, Section ${section.sectionNumber}: ${section.title} (${sectionId})`;
};

export default function MasterPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<MasterOverviewUserRow[]>([]);
  const [summary, setSummary] = useState({ totalUsersWithActivity: 0, activeNow: 0, avgCompletionPercent: 0, avgAccuracyPercent: 0, totalAttempts: 0, totalCorrect: 0 });
  const [recentAttempts, setRecentAttempts] = useState<MasterRecentAttempt[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedAttempts, setSelectedAttempts] = useState<MasterRecentAttempt[]>([]);
  const [selectedUser, setSelectedUser] = useState<MasterOverviewUserRow | null>(null);

  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignments, setAssignments] = useState<MasterAlgebra1AssignmentRow[]>([]);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setAssignmentsLoading(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw new Error('Please sign in again to view the Master Dashboard.');
        const { data: p, error: pErr } = await supabase.from('profiles').select('id,role,approval_status').eq('id', authData.user.id).maybeSingle();
        if (pErr || !p) throw new Error('Could not load your profile.');
        const nextProfile = p as Profile;
        if (nextProfile.role !== 'master' || nextProfile.approval_status !== 'approved') throw new Error('Master access required.');

        const data = await getMasterAlgebra1Overview();
        setUsers(data.users);
        setSummary(data.summary);
        setRecentAttempts(data.recentAttempts);

        try {
          const assignmentRows = await getMasterAlgebra1Assignments();
          setAssignments(assignmentRows);
          setAssignmentError(null);
        } catch (assignmentLoadError) {
          setAssignments([]);
          setAssignmentError(assignmentLoadError instanceof Error ? assignmentLoadError.message : 'Assignments panel failed to load.');
        } finally {
          setAssignmentsLoading(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard.');
        setAssignmentsLoading(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const userById = useMemo(() => new Map(users.map((u) => [u.user_id, u])), [users]);

  const onSelectUser = async (userId: string) => {
    setSelectedUserId(userId);
    setSelectedUser(userById.get(userId) ?? null);
    try {
      const data = await getMasterAlgebra1UserProgress(userId);
      setSelectedUser(data.user ?? userById.get(userId) ?? null);
      setSelectedAttempts(data.recentAttempts);
    } catch {
      setSelectedAttempts([]);
    }
  };

  const filteredAssignments = useMemo(
    () =>
      assignments.filter((assignment) => {
        if (teacherFilter !== 'all' && assignment.teacher_id !== teacherFilter) return false;
        if (statusFilter === 'active' && Boolean(assignment.archived_at)) return false;
        if (statusFilter === 'archived' && !assignment.archived_at) return false;
        const query = assignmentSearch.trim().toLowerCase();
        if (!query) return true;
        return [assignment.title, assignment.classroom_name ?? '', assignment.teacher_name ?? '', assignment.teacher_email ?? '', assignment.section_id ?? '']
          .join(' ')
          .toLowerCase()
          .includes(query);
      }),
    [assignments, teacherFilter, statusFilter, assignmentSearch],
  );

  const assignmentTeacherOptions = useMemo(() => {
    const teachers = new Map<string, string>();
    assignments.forEach((assignment) => {
      teachers.set(assignment.teacher_id, `${displayName(assignment)} (${assignment.teacher_email ?? 'No email'})`);
    });
    return Array.from(teachers.entries());
  }, [assignments]);

  const assignmentSummary = useMemo(
    () =>
      assignments.reduce(
        (acc, assignment) => {
          const recipients = Number(assignment.recipient_count ?? 0);
          const completed = Number(assignment.completed_count ?? 0);
          const incomplete = Number(assignment.incomplete_count ?? 0);
          const excused = Number(assignment.excused_count ?? 0);
          acc.totalAssignments += 1;
          if (assignment.archived_at) acc.archivedAssignments += 1;
          else acc.activeAssignments += 1;
          acc.totalRecipients += recipients;
          acc.completedRecipients += completed;
          acc.incompleteRecipients += incomplete;
          acc.excusedRecipients += excused;
          return acc;
        },
        {
          totalAssignments: 0,
          activeAssignments: 0,
          archivedAssignments: 0,
          totalRecipients: 0,
          completedRecipients: 0,
          incompleteRecipients: 0,
          excusedRecipients: 0,
        },
      ),
    [assignments],
  );

  if (loading) {
    return <main className="min-h-screen bg-slate-950 p-8 text-white"><div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/10 p-8">Loading Master Dashboard...</div></main>;
  }

  if (error) {
    return <main className="min-h-screen bg-slate-950 p-8 text-white"><div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/10 p-8"><h1 className="text-3xl font-black">Master Dashboard</h1><p className="mt-3 text-white/80">{error}</p><div className="mt-5"><Link href="/dashboard" className="rounded-lg bg-indigo-500 px-4 py-2">Go to Dashboard</Link></div></div></main>;
  }

  const panelAttempts = selectedUserId ? selectedAttempts : recentAttempts;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-4 text-3xl font-black">Master Dashboard (Algebra 1)</h1>
        <p className="mb-6 text-sm text-white/70">Read-only global Regents Algebra 1 overview.</p>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-xl font-bold">All Users</h2>
            {users.length === 0 ? <p className="text-white/70">No Algebra 1 users found yet.</p> : <ul className="space-y-3">{users.map((u) => <li key={u.user_id} className="rounded-xl border border-white/10 p-3"><p className="font-semibold">{displayName(u)}</p><p className="text-xs text-white/70">{u.email ?? 'No email'}</p><p className="text-xs text-white/60">Last activity: {formatDateTime(u.last_activity_at)}</p><button onClick={() => void onSelectUser(u.user_id)} className="mt-2 rounded-md bg-indigo-500 px-3 py-1 text-sm">View Progress</button></li>)}</ul>}
          </aside>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-3 sm:grid-cols-3">{[
              ['Total users', summary.totalUsersWithActivity], ['Active now', summary.activeNow], ['Avg completion', `${summary.avgCompletionPercent}%`], ['Avg accuracy', `${summary.avgAccuracyPercent}%`], ['Total attempts', summary.totalAttempts], ['Total correct', summary.totalCorrect],
            ].map(([k, v]) => <div key={String(k)} className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-xs text-white/60">{k}</p><p className="text-xl font-bold">{v}</p></div>)}</div>

            <div className="mt-6">
              <h2 className="text-xl font-bold">{selectedUser ? `${displayName(selectedUser)} Progress` : 'Recent Attempts'}</h2>
              {selectedUser && <p className="mb-3 text-sm text-white/70">{selectedUser.email ?? 'No email'} · Completion {Math.round(Number(selectedUser.completion_percent ?? 0))}% · Accuracy {Math.round(Number(selectedUser.accuracy_percent ?? 0))}% · Attempts {Number(selectedUser.attempts_count ?? 0)} · Correct {Number(selectedUser.correct_count ?? 0)}</p>}
              {panelAttempts.length === 0 ? <p className="text-white/70">No recent attempts available yet.</p> : <ul className="space-y-2">{panelAttempts.map((a, i) => <li key={`${a.user_id}-${a.question_id}-${a.attempted_at ?? i}`} className="rounded-lg border border-white/10 p-3"><p className="font-medium">{displayName(a)} · {a.section_title}</p><p className="text-sm text-white/70">Question: {a.question_id ?? 'Unknown'} · {formatDateTime(a.attempted_at)}</p><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${a.correct ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>{a.correct ? 'Correct' : 'Incorrect'}</span></li>)}</ul>}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-2xl border-2 border-indigo-400/40 bg-white/5 p-5" aria-label="Master Assignment Oversight">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-indigo-200">Assignments · Master Assignment Oversight</h2>
              <p className="text-sm text-white/70">Read-only assignment oversight for Regents Algebra 1 across all classrooms.</p>
            </div>
          </div>

          {assignmentsLoading ? <p className="text-sm text-white/70">Loading assignments…</p> : null}
          {assignmentError ? <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">Could not load assignments right now. {assignmentError}</div> : null}

          {!assignmentsLoading && !assignmentError ? (
            <>
              <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">{[
                ['Total assignments', assignmentSummary.totalAssignments], ['Active assignments', assignmentSummary.activeAssignments], ['Archived assignments', assignmentSummary.archivedAssignments], ['Total recipients', assignmentSummary.totalRecipients], ['Completed recipients', assignmentSummary.completedRecipients], ['Incomplete recipients', assignmentSummary.incompleteRecipients], ['Excused recipients', assignmentSummary.excusedRecipients],
              ].map(([k, v]) => <div key={String(k)} className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-xs text-white/60">{k}</p><p className="text-xl font-bold">{v}</p></div>)}</div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <input value={assignmentSearch} onChange={(event) => setAssignmentSearch(event.target.value)} placeholder="Search title, classroom, teacher, or section" className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/50" />
                <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white">
                  <option value="all">All teachers</option>
                  {assignmentTeacherOptions.map(([teacherId, label]) => <option key={teacherId} value={teacherId}>{label}</option>)}
                </select>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'archived')} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white">
                  <option value="all">Active + archived</option>
                  <option value="active">Active only</option>
                  <option value="archived">Archived only</option>
                </select>
              </div>

              <div className="mt-4 overflow-x-auto">
                {filteredAssignments.length === 0 ? <p className="text-white/70">No assignments yet.</p> : <table className="min-w-full border-collapse text-sm"><thead><tr className="border-b border-white/10 text-left text-white/70"><th className="px-2 py-2">Teacher</th><th className="px-2 py-2">Classroom</th><th className="px-2 py-2">Assignment</th><th className="px-2 py-2">Section</th><th className="px-2 py-2">Due date</th><th className="px-2 py-2">Created</th><th className="px-2 py-2">Updated</th><th className="px-2 py-2">Archived</th><th className="px-2 py-2">Recipients</th></tr></thead><tbody>{filteredAssignments.map((assignment) => <tr key={assignment.assignment_id} className="border-b border-white/5 align-top"><td className="px-2 py-2"><p>{displayName(assignment)}</p><p className="text-xs text-white/60">{assignment.teacher_email ?? 'No email'}</p></td><td className="px-2 py-2">{assignment.classroom_name ?? assignment.classroom_id}</td><td className="px-2 py-2"><p className="font-semibold">{assignment.title}</p><p className="text-xs text-white/60">{assignment.description || 'No description'}</p></td><td className="px-2 py-2">{getSectionLabel(assignment.section_id)}</td><td className="px-2 py-2">{formatCalendarDate(assignment.due_date)}</td><td className="px-2 py-2">{formatDateTime(assignment.created_at)}</td><td className="px-2 py-2">{formatDateTime(assignment.updated_at)}</td><td className="px-2 py-2">{assignment.archived_at ? 'Archived' : 'Active'}</td><td className="px-2 py-2">{Number(assignment.recipient_count ?? 0)} total · {Number(assignment.completed_count ?? 0)} complete · {Number(assignment.incomplete_count ?? 0)} incomplete · {Number(assignment.excused_count ?? 0)} excused</td></tr>)}</tbody></table>}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
