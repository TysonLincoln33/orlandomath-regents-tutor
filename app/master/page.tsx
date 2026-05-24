'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

type ProgressMode = 'global' | 'selectedUser';

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : 'N/A');
const due = (v: string | null) => (v ? new Date(v).toLocaleDateString() : 'No due date');
const name = (u: { full_name?: string | null; teacher_name?: string | null; email?: string | null; teacher_email?: string | null }) =>
  u.full_name || u.teacher_name || u.email || u.teacher_email || 'Unknown User';

export default function MasterPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<MasterOverviewUserRow[]>([]);
  const [summary, setSummary] = useState({ totalUsersWithActivity: 0, activeNow: 0, avgCompletionPercent: 0, avgAccuracyPercent: 0, totalAttempts: 0, totalCorrect: 0 });
  const [recentAttempts, setRecentAttempts] = useState<MasterRecentAttempt[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<MasterOverviewUserRow | null>(null);
  const [selectedAttempts, setSelectedAttempts] = useState<MasterRecentAttempt[]>([]);
  const [mode, setMode] = useState<ProgressMode>('global');

  const [assignments, setAssignments] = useState<MasterAlgebra1AssignmentRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseBrowserClient();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw new Error('Please sign in again to view the Master Dashboard.');
        const { data: p, error: pErr } = await supabase.from('profiles').select('id,role,approval_status').eq('id', authData.user.id).maybeSingle();
        if (pErr || !p) throw new Error('Could not load your profile.');
        const profile = p as Profile;
        if (profile.role !== 'master' || profile.approval_status !== 'approved') throw new Error('Master access required.');

        const [overview, masterAssignments] = await Promise.all([getMasterAlgebra1Overview(), getMasterAlgebra1Assignments()]);
        setUsers(overview.users);
        setSummary(overview.summary);
        setRecentAttempts(overview.recentAttempts);
        setAssignments(masterAssignments);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSelectUser = async (userId: string) => {
    setSelectedUserId(userId);
    setMode('selectedUser');
    try {
      const data = await getMasterAlgebra1UserProgress(userId);
      setSelectedUser(data.user);
      setSelectedAttempts(data.recentAttempts);
    } catch {
      setSelectedAttempts([]);
    }
  };

  const attemptsToShow = mode === 'global' ? recentAttempts : selectedAttempts;
  const selectedUserAssignments = useMemo(() => assignments, [assignments]);

  if (loading) return <main className="min-h-screen bg-slate-950 p-6 text-white">Loading Master Dashboard…</main>;
  if (error) return <main className="min-h-screen bg-slate-950 p-6 text-white"><h1 className="text-3xl font-bold">Master Dashboard</h1><p>{error}</p><Link href="/dashboard">Go to Dashboard</Link></main>;

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-black">Master Dashboard (Global Algebra 1)</h1>
        <div className="mt-6 grid gap-4 xl:grid-cols-[300px_1fr_420px]">
          <aside className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-xl font-bold">All Users / Students</h2>
            <div className="mt-3 space-y-2">
              {users.map((u) => (
                <div key={u.user_id} className="rounded-lg border border-white/10 p-2">
                  <p className="font-semibold">{name(u)}</p>
                  <p className="text-xs text-white/70">{u.email}</p>
                  <p className="text-xs text-white/60">Last activity: {fmt(u.last_activity_at)}</p>
                  <button className="mt-2 rounded bg-indigo-500 px-2 py-1 text-xs" onClick={() => void onSelectUser(u.user_id)}>View Progress</button>
                </div>
              ))}
            </div>
          </aside>

          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-xl font-bold">Assignments</h2>
            <div className="mt-3 space-y-3">
              {selectedUserAssignments.map((a) => (
                <article key={a.assignment_id} className="rounded-lg border border-white/10 p-3">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-xs text-white/70">Section: {a.section_id || 'N/A'} • Classroom: {a.classroom_name}</p>
                  <p className="text-xs text-white/70">Teacher: {name(a)} ({a.teacher_email || 'no email'})</p>
                  <p className="text-xs text-white/60">Due {due(a.due_date)} • Created {fmt(a.created_at)} • Updated {fmt(a.updated_at)}</p>
                  <p className="text-xs text-white/60">{a.archived_at ? 'Archived' : 'Active'} • Recipients {Number(a.recipient_count)} • Completed {Number(a.completed_count)} • Incomplete {Number(a.incomplete_count)} • Excused {Number(a.excused_count)}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex gap-2"><button className="rounded bg-indigo-500 px-2 py-1 text-xs" onClick={() => setMode('global')}>Global</button><button className="rounded bg-indigo-500 px-2 py-1 text-xs" onClick={() => setMode('selectedUser')} disabled={!selectedUserId}>Selected User</button></div>
            <h2 className="mt-3 text-xl font-bold">Progress</h2>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border border-white/10 p-2">Users {summary.totalUsersWithActivity}</div><div className="rounded border border-white/10 p-2">Active {summary.activeNow}</div><div className="rounded border border-white/10 p-2">Completion {summary.avgCompletionPercent}%</div><div className="rounded border border-white/10 p-2">Accuracy {summary.avgAccuracyPercent}%</div>
            </div>
            {selectedUser ? <p className="mt-3 text-sm text-white/70">{name(selectedUser)} · {selectedUser.email}</p> : null}
            <h3 className="mt-3 font-semibold">Recent Activity</h3>
            <div className="mt-2 space-y-2">
              {attemptsToShow.map((a, i) => <div key={`${a.user_id}-${a.question_id}-${i}`} className="rounded border border-white/10 p-2 text-sm"><p>{name(a)} · {a.section_title}</p><p className="text-white/70">Q: {a.question_id} · {fmt(a.attempted_at)}</p><p className={a.correct ? 'text-emerald-300' : 'text-rose-300'}>{a.correct ? 'Correct' : 'Incorrect'}</p></div>)}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
