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
type ProgressMode = 'global' | 'user' | 'assignment';

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
const sectionLabel = (sectionId: string | null) => {
  const section = SECTIONS.find((s) => s.id === sectionId);
  if (!section) return sectionId ?? 'N/A';
  return `Ch ${section.chapterNumber}.${section.sectionNumber} · ${section.title}`;
};
const displayName = (u: { full_name?: string | null; email?: string | null; teacher_name?: string | null; teacher_email?: string | null }) =>
  u.full_name?.trim() || u.teacher_name?.trim() || u.email?.split('@')[0] || u.teacher_email?.split('@')[0] || 'Unknown User';

export default function MasterPage() {
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [users, setUsers] = useState<MasterOverviewUserRow[]>([]);
  const [summary, setSummary] = useState({ totalUsersWithActivity: 0, activeNow: 0, avgCompletionPercent: 0, avgAccuracyPercent: 0, totalAttempts: 0, totalCorrect: 0 });
  const [recentAttempts, setRecentAttempts] = useState<MasterRecentAttempt[]>([]);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<MasterOverviewUserRow | null>(null);
  const [selectedUserAttempts, setSelectedUserAttempts] = useState<MasterRecentAttempt[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');

  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<MasterAlgebra1AssignmentRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setPageError(null);
      setAssignmentsLoading(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw new Error('Please sign in again to view the Master Dashboard.');
        const { data: p, error: pErr } = await supabase.from('profiles').select('id,role,approval_status').eq('id', authData.user.id).maybeSingle();
        if (pErr || !p) throw new Error('Could not load your profile.');
        const nextProfile = p as Profile;
        if (nextProfile.role !== 'master' || nextProfile.approval_status !== 'approved') throw new Error('Master access required.');

        const [overview, assignmentRows] = await Promise.all([getMasterAlgebra1Overview(), getMasterAlgebra1Assignments()]);
        setUsers(overview.users);
        setSummary(overview.summary);
        setRecentAttempts(overview.recentAttempts);
        setAssignments(assignmentRows);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load master dashboard.';
        setPageError(msg);
        setAssignmentsError(msg);
      } finally {
        setAssignmentsLoading(false);
        setLoading(false);
      }
    })();
  }, []);

  const userById = useMemo(() => new Map(users.map((u) => [u.user_id, u])), [users]);
  const selectedAssignment = useMemo(() => assignments.find((a) => a.assignment_id === selectedAssignmentId) ?? null, [assignments, selectedAssignmentId]);
  const assignmentRecipientAttempts = useMemo(() => {
    if (!selectedAssignment) return recentAttempts;
    return recentAttempts.filter((attempt) => attempt.section_id && selectedAssignment.section_id && attempt.section_id === selectedAssignment.section_id);
  }, [recentAttempts, selectedAssignment]);

  const progressMode: ProgressMode = selectedUserId ? (selectedAssignment ? 'assignment' : 'user') : 'global';

  const onSelectUser = async (userId: string) => {
    setSelectedUserId(userId);
    setSelectedUser(userById.get(userId) ?? null);
    try {
      const data = await getMasterAlgebra1UserProgress(userId);
      setSelectedUser(data.user ?? userById.get(userId) ?? null);
      setSelectedUserAttempts(data.recentAttempts);
    } catch {
      setSelectedUserAttempts([]);
    }
  };

  if (loading) return <main className="min-h-screen bg-slate-950 p-8 text-white">Loading Master Dashboard...</main>;
  if (pageError) return <main className="min-h-screen bg-slate-950 p-8 text-white"><h1 className="text-2xl font-bold">Master Dashboard</h1><p className="mt-3">{pageError}</p><Link href="/dashboard" className="mt-4 inline-block rounded bg-indigo-500 px-4 py-2">Go to Dashboard</Link></main>;

  const progressAttempts = progressMode === 'global' ? recentAttempts : progressMode === 'user' ? selectedUserAttempts : assignmentRecipientAttempts;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-[1500px]">
        <h1 className="mb-4 text-3xl font-black">Master Dashboard (Global Regents Algebra 1)</h1>
        <div className="grid gap-6 xl:grid-cols-[320px_1fr_420px]">
          <aside className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-xl font-bold">All Users / Students</h2>
            <div className="space-y-2">
              {users.map((u) => (
                <button key={u.user_id} className={`w-full rounded-xl border p-3 text-left ${selectedUserId === u.user_id ? 'border-indigo-400 bg-indigo-500/15' : 'border-white/10 bg-black/20'}`} onClick={() => void onSelectUser(u.user_id)}>
                  <p className="font-semibold">{displayName(u)}</p><p className="text-xs text-white/70">{u.email ?? 'No email'}</p><p className="text-xs text-white/60">Last activity: {formatDateTime(u.last_activity_at)}</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-xl font-bold">Assignments</h2>
            {assignmentsError ? <p className="mt-3 rounded bg-rose-500/15 p-2 text-sm">Assignments panel error: {assignmentsError}</p> : null}
            {assignmentsLoading ? <p className="mt-3 text-sm text-white/70">Loading assignments…</p> : null}
            <select value={selectedAssignmentId} onChange={(e) => setSelectedAssignmentId(e.target.value)} className="mt-3 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm">
              <option value="">All assignments</option>
              {assignments.map((a) => <option key={a.assignment_id} value={a.assignment_id}>{a.title} · {a.classroom_name ?? 'Classroom'} · {displayName(a)}</option>)}
            </select>
            <div className="mt-4 space-y-3">
              {(selectedAssignment ? [selectedAssignment] : assignments).map((a) => (
                <article key={a.assignment_id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-xs text-white/70">{sectionLabel(a.section_id)} · {a.classroom_name ?? a.classroom_id}</p>
                  <p className="text-xs text-white/70">Teacher: {displayName(a)} ({a.teacher_email ?? 'No email'})</p>
                  <p className="text-xs text-white/70">Due: {formatCalendarDate(a.due_date)} · Created: {formatDateTime(a.created_at)} · Updated: {formatDateTime(a.updated_at)}</p>
                  <p className="mt-1 text-xs">{a.archived_at ? 'Archived' : 'Active'} · {Number(a.recipient_count ?? 0)} recipients · {Number(a.completed_count ?? 0)} complete · {Number(a.incomplete_count ?? 0)} incomplete · {Number(a.excused_count ?? 0)} excused</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-xl font-bold">Progress</h2>
            <p className="text-sm text-white/70">Mode: {progressMode === 'global' ? 'Global class-style progress' : progressMode === 'user' ? 'Selected user overall progress' : 'Assignment-specific progress'}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border border-white/10 p-2">Users: {summary.totalUsersWithActivity}</div>
              <div className="rounded border border-white/10 p-2">Active now: {summary.activeNow}</div>
              <div className="rounded border border-white/10 p-2">Avg completion: {summary.avgCompletionPercent}%</div>
              <div className="rounded border border-white/10 p-2">Avg accuracy: {summary.avgAccuracyPercent}%</div>
            </div>
            {selectedUser ? <p className="mt-3 text-sm">{displayName(selectedUser)} · {selectedUser.email ?? 'No email'} · Completion {Math.round(Number(selectedUser.completion_percent ?? 0))}% · Accuracy {Math.round(Number(selectedUser.accuracy_percent ?? 0))}%</p> : null}
            <h3 className="mt-4 text-lg font-semibold">Recent Activity</h3>
            <div className="mt-2 space-y-2">
              {progressAttempts.slice(0, 60).map((a, i) => (
                <article key={`${a.user_id}-${a.question_id}-${a.attempted_at ?? i}`} className="rounded border border-white/10 p-2 text-sm">
                  <p className="font-medium">{displayName(a)} · {a.section_title}</p>
                  <p className="text-white/70">Question {a.question_id ?? 'N/A'} · {formatDateTime(a.attempted_at)}</p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${a.correct ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>{a.correct ? 'Correct' : 'Incorrect'}</span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
