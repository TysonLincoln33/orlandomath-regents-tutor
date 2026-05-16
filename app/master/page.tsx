'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type Profile = {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  role: string | null;
  requested_role?: string | null;
  approval_status?: string | null;
};

type StudentSummary = {
  id: string;
  name: string;
  email: string;
  completion: number;
  accuracy: number;
  attempts: number;
  correct: number;
  lastActive: string | null;
  active: boolean;
};

type SummaryRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  completion: number | null;
  accuracy: number | null;
  attempts: number | null;
  correct: number | null;
  last_active: string | null;
};

type AttemptRow = {
  id?: string;
  user_id: string;
  course_id: string | null;
  chapter_id: string | null;
  section_id: string | null;
  question_id: string | null;
  selected_answer?: string | null;
  correct: boolean | null;
  attempted_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return 'No activity yet';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'No activity yet';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function safePercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function studentNameFromSummary(row?: SummaryRow | StudentSummary | null) {
  if (!row) return 'Unknown Student';

  if ('name' in row) {
    return row.name || row.email || 'Unknown Student';
  }

  return row.full_name?.trim() || row.email?.split('@')[0] || 'Unknown Student';
}

export default function MasterPage() {
  const [loading, setLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [studentSummaries, setStudentSummaries] = useState<StudentSummary[]>([]);
  const [attemptRows, setAttemptRows] = useState<AttemptRow[]>([]);

  useEffect(() => {
    let alive = true;

    async function loadMasterDashboard() {
      setLoading(true);
      setAuthMessage(null);

      try {
        const supabase = getSupabaseBrowserClient();

        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData.user) {
          if (!alive) return;
          setAuthMessage('Please sign in again to view the Master Dashboard.');
          setLoading(false);
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, email, username, full_name, role, requested_role, approval_status')
          .eq('id', userData.user.id)
          .maybeSingle();

        if (profileError || !profileData) {
          if (!alive) return;
          setAuthMessage('Could not load your profile.');
          setLoading(false);
          return;
        }

        const profile = profileData as Profile;

        if (profile.role !== 'master' || profile.approval_status !== 'approved') {
          if (!alive) return;
          setCurrentProfile(profile);
          setAuthMessage('Master access required.');
          setLoading(false);
          return;
        }

        const [summaryResult, attemptsResult] = await Promise.all([
          supabase
            .from('master_student_summary')
            .select('user_id, full_name, email, completion, accuracy, attempts, correct, last_active')
            .order('last_active', { ascending: false }),

          supabase
            .from('question_attempts')
            .select(
              'id, user_id, course_id, chapter_id, section_id, question_id, selected_answer, correct, attempted_at'
            )
            .order('attempted_at', { ascending: false })
            .limit(100),
        ]);

        if (!alive) return;

        if (summaryResult.error) {
          console.error('Master summary fetch error:', summaryResult.error);
        }

        if (attemptsResult.error) {
          console.error('Master attempts fetch error:', attemptsResult.error);
        }

        const summaries: StudentSummary[] = ((summaryResult.data ?? []) as SummaryRow[]).map(
          (row) => {
            const lastActiveTime = row.last_active
              ? new Date(row.last_active).getTime()
              : 0;

            return {
              id: row.user_id,
              name: studentNameFromSummary(row),
              email: row.email ?? '',
              completion: safePercent(Number(row.completion ?? 0)),
              accuracy: safePercent(Number(row.accuracy ?? 0)),
              attempts: Number(row.attempts ?? 0),
              correct: Number(row.correct ?? 0),
              lastActive: row.last_active,
              active:
                lastActiveTime > 0 && Date.now() - lastActiveTime < 10 * 60 * 1000,
            };
          }
        );

        setCurrentProfile(profile);
        setStudentSummaries(summaries);
        setAttemptRows((attemptsResult.data ?? []) as AttemptRow[]);
        setLoading(false);
      } catch (error) {
        console.error('Master dashboard load failed:', error);

        if (!alive) return;

        setAuthMessage('Something went wrong loading the Master Dashboard.');
        setLoading(false);
      }
    }

    loadMasterDashboard();

    return () => {
      alive = false;
    };
  }, []);

  const studentById = useMemo(() => {
    const map = new Map<string, StudentSummary>();

    for (const student of studentSummaries) {
      map.set(student.id, student);
    }

    return map;
  }, [studentSummaries]);

  const activeStudents = studentSummaries.filter((student) => student.active);

  const totalAttempts = studentSummaries.reduce(
    (sum, student) => sum + student.attempts,
    0
  );

  const totalCorrect = studentSummaries.reduce(
    (sum, student) => sum + student.correct,
    0
  );

  const avgProgress = safePercent(
    studentSummaries.reduce((sum, student) => sum + student.completion, 0) /
      Math.max(studentSummaries.length, 1)
  );

  const avgAccuracy = safePercent(
    studentSummaries.reduce((sum, student) => sum + student.accuracy, 0) /
      Math.max(studentSummaries.length, 1)
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl">
          <p className="text-xl font-bold">Loading Master Dashboard...</p>
        </div>
      </main>
    );
  }

  if (authMessage) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl">
          <h1 className="mb-3 text-3xl font-black">Master Dashboard</h1>
          <p className="mb-6 text-white/80">{authMessage}</p>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-full bg-white px-5 py-3 font-bold text-blue-700"
            >
              Login
            </Link>
            <Link
              href="/dashboard"
              className="rounded-full border border-white/30 px-5 py-3 font-bold text-white"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#2563eb,#111827_45%,#020617)] p-4 text-white md:p-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-2xl backdrop-blur">
          <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 p-8">
            <p className="mb-2 text-sm font-black uppercase tracking-[0.25em] text-white/80">
              OrlandoMath Regents Tutor
            </p>
            <h1 className="text-4xl font-black md:text-5xl">
              Master Dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-lg font-semibold text-white/90">
              Track student progress, accuracy, attempts, correct answers, and recent activity.
            </p>
            {currentProfile?.email && (
              <p className="mt-3 text-sm font-bold text-white/70">
                Signed in as {currentProfile.email}
              </p>
            )}
          </div>

          <div className="h-3 bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 via-blue-500 to-purple-600" />

          <div className="grid gap-4 p-6 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Students" value={studentSummaries.length} />
            <StatCard label="Active Now" value={activeStudents.length} />
            <StatCard label="Avg Progress" value={`${avgProgress}%`} />
            <StatCard label="Avg Accuracy" value={`${avgAccuracy}%`} />
            <StatCard label="Attempts" value={totalAttempts} />
            <StatCard label="Correct" value={totalCorrect} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <DashboardPanel title="Active Students">
              {activeStudents.length === 0 ? (
                <EmptyState text="No students active in the last 10 minutes." />
              ) : (
                <div className="grid gap-4">
                  {activeStudents.map((student) => (
                    <StudentCard key={student.id} student={student} />
                  ))}
                </div>
              )}
            </DashboardPanel>

            <DashboardPanel title="All Student Progress">
              {studentSummaries.length === 0 ? (
                <EmptyState text="No student summary rows are visible yet. Confirm the master_student_summary view exists and your master account can read student_progress and question_attempts." />
              ) : (
                <div className="grid gap-4">
                  {studentSummaries.map((student) => (
                    <StudentCard key={student.id} student={student} />
                  ))}
                </div>
              )}
            </DashboardPanel>
          </div>

          <DashboardPanel title="Recent Question Attempts">
            {attemptRows.length === 0 ? (
              <EmptyState text="No question attempts are visible yet. If this seems wrong, check the master RLS policy for question_attempts." />
            ) : (
              <div className="space-y-3">
                {attemptRows.map((attempt, index) => {
                  const student = studentById.get(attempt.user_id);

                  return (
                    <div
                      key={attempt.id ?? `${attempt.user_id}-${attempt.attempted_at}-${index}`}
                      className="rounded-2xl border border-white/10 bg-black/25 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black">{studentNameFromSummary(student)}</p>
                          <p className="text-xs text-white/60">
                            {formatDate(attempt.attempted_at)}
                          </p>
                        </div>

                        <span
                          className={
                            attempt.correct
                              ? 'rounded-full bg-green-400/20 px-3 py-1 text-sm font-black text-green-200'
                              : 'rounded-full bg-red-400/20 px-3 py-1 text-sm font-black text-red-200'
                          }
                        >
                          {attempt.correct ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>

                      <p className="text-sm text-white/75">
                        Chapter: <strong>{attempt.chapter_id ?? '—'}</strong>
                      </p>
                      <p className="text-sm text-white/75">
                        Section: <strong>{attempt.section_id ?? '—'}</strong>
                      </p>
                      <p className="text-sm text-white/75">
                        Question: <strong>{attempt.question_id ?? '—'}</strong>
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardPanel>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function DashboardPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-2xl backdrop-blur">
      <h2 className="mb-4 text-2xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/20 bg-black/20 p-5 text-white/70">
      {text}
    </div>
  );
}

function StudentCard({ student }: { student: StudentSummary }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5 shadow-lg">
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-black">{student.name}</h3>

            {student.active && (
              <span className="rounded-full bg-green-400/20 px-3 py-1 text-xs font-black uppercase tracking-wide text-green-200">
                Active
              </span>
            )}
          </div>

          <p className="text-sm text-white/60">{student.email}</p>
          <p className="mt-1 text-xs text-white/50">
            Last active: {formatDate(student.lastActive)}
          </p>
        </div>

        <div className="text-left md:text-right">
          <p className="text-sm text-white/60">Attempts / Correct</p>
          <p className="text-2xl font-black">
            {student.attempts} / {student.correct}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ProgressMeter label="Progress" value={student.completion} />
        <ProgressMeter label="Accuracy" value={student.accuracy} />
      </div>
    </div>
  );
}

function ProgressMeter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm font-bold">
        <span>{label}</span>
        <span>{value}%</span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
