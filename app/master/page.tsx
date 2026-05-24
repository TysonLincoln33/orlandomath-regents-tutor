'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getMasterAlgebra1Overview, getMasterAlgebra1UserProgress, type MasterOverviewUserRow, type MasterRecentAttempt } from '@/lib/master/getMasterAlgebra1Dashboard';

type Profile = { id: string; role: string | null; approval_status: string | null };

const formatDate = (value: string | null) => {
  if (!value) return 'No activity yet';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No activity yet';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const displayName = (u: { full_name: string | null; email: string | null }) => u.full_name?.trim() || u.email?.split('@')[0] || 'Unknown User';

export default function MasterPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<MasterOverviewUserRow[]>([]);
  const [summary, setSummary] = useState({ totalUsersWithActivity: 0, activeNow: 0, avgCompletionPercent: 0, avgAccuracyPercent: 0, totalAttempts: 0, totalCorrect: 0 });
  const [recentAttempts, setRecentAttempts] = useState<MasterRecentAttempt[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedAttempts, setSelectedAttempts] = useState<MasterRecentAttempt[]>([]);
  const [selectedUser, setSelectedUser] = useState<MasterOverviewUserRow | null>(null);

  useEffect(() => { (async () => {
    setLoading(true); setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error('Please sign in again to view the Master Dashboard.');
      const { data: p, error: pErr } = await supabase.from('profiles').select('id,role,approval_status').eq('id', authData.user.id).maybeSingle();
      if (pErr || !p) throw new Error('Could not load your profile.');
      const nextProfile = p as Profile;
      if (nextProfile.role !== 'master' || nextProfile.approval_status !== 'approved') throw new Error('Master access required.');
      const data = await getMasterAlgebra1Overview();
      setUsers(data.users); setSummary(data.summary); setRecentAttempts(data.recentAttempts);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load dashboard.'); }
    finally { setLoading(false); }
  })(); }, []);

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

  if (loading) return <main className="min-h-screen bg-slate-950 p-8 text-white"><div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/10 p-8">Loading Master Dashboard...</div></main>;
  if (error) return <main className="min-h-screen bg-slate-950 p-8 text-white"><div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/10 p-8"><h1 className="text-3xl font-black">Master Dashboard</h1><p className="mt-3 text-white/80">{error}</p><div className="mt-5"><Link href="/dashboard" className="rounded-lg bg-indigo-500 px-4 py-2">Go to Dashboard</Link></div></div></main>;

  const panelAttempts = selectedUserId ? selectedAttempts : recentAttempts;
  return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-7xl"><h1 className="mb-4 text-3xl font-black">Master Dashboard (Algebra 1)</h1><p className="mb-6 text-sm text-white/70">Read-only global Regents Algebra 1 overview.</p><div className="grid gap-6 lg:grid-cols-[320px_1fr]">
    <aside className="rounded-2xl border border-white/10 bg-white/5 p-4"><h2 className="mb-3 text-xl font-bold">All Users</h2>{users.length === 0 ? <p className="text-white/70">No Algebra 1 users found yet.</p> : <ul className="space-y-3">{users.map((u) => <li key={u.user_id} className="rounded-xl border border-white/10 p-3"><p className="font-semibold">{displayName(u)}</p><p className="text-xs text-white/70">{u.email ?? 'No email'}</p><p className="text-xs text-white/60">Last activity: {formatDate(u.last_activity_at)}</p><button onClick={() => void onSelectUser(u.user_id)} className="mt-2 rounded-md bg-indigo-500 px-3 py-1 text-sm">View Progress</button></li>)}</ul>}</aside>
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="grid gap-3 sm:grid-cols-3">{[
      ['Total users', summary.totalUsersWithActivity], ['Active now', summary.activeNow], ['Avg completion', `${summary.avgCompletionPercent}%`], ['Avg accuracy', `${summary.avgAccuracyPercent}%`], ['Total attempts', summary.totalAttempts], ['Total correct', summary.totalCorrect]
    ].map(([k,v]) => <div key={String(k)} className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-xs text-white/60">{k}</p><p className="text-xl font-bold">{v}</p></div>)}</div>
    <div className="mt-6"><h2 className="text-xl font-bold">{selectedUser ? `${displayName(selectedUser)} Progress` : 'Recent Attempts'}</h2>{selectedUser && <p className="mb-3 text-sm text-white/70">{selectedUser.email ?? 'No email'} · Completion {Math.round(Number(selectedUser.completion_percent ?? 0))}% · Accuracy {Math.round(Number(selectedUser.accuracy_percent ?? 0))}% · Attempts {Number(selectedUser.attempts_count ?? 0)} · Correct {Number(selectedUser.correct_count ?? 0)}</p>}
      {panelAttempts.length === 0 ? <p className="text-white/70">No recent attempts available yet.</p> : <ul className="space-y-2">{panelAttempts.map((a, i) => <li key={`${a.user_id}-${a.question_id}-${a.attempted_at ?? i}`} className="rounded-lg border border-white/10 p-3"><p className="font-medium">{displayName(a)} · {a.section_title}</p><p className="text-sm text-white/70">Question: {a.question_id ?? 'Unknown'} · {formatDate(a.attempted_at)}</p><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${a.correct ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>{a.correct ? 'Correct' : 'Incorrect'}</span></li>)}</ul>}</div></section>
  </div></div></main>;
}
