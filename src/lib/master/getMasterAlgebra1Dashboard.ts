import { SECTIONS } from '@/lib/course/algebra1';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type MasterOverviewUserRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  completion_percent: number | string | null;
  accuracy_percent: number | string | null;
  attempts_count: number | string | null;
  correct_count: number | string | null;
  last_activity_at: string | null;
};

type MasterOverviewSummaryRow = {
  total_users_with_activity: number | string | null;
  active_now: number | string | null;
  avg_completion_percent: number | string | null;
  avg_accuracy_percent: number | string | null;
  total_attempts: number | string | null;
  total_correct: number | string | null;
};

type MasterRecentAttemptRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  section_id: string | null;
  question_id: string | null;
  correct: boolean | null;
  attempted_at: string | null;
};

export type MasterRecentAttempt = MasterRecentAttemptRow & { section_title: string };
export type MasterOverviewData = { summary: { totalUsersWithActivity: number; activeNow: number; avgCompletionPercent: number; avgAccuracyPercent: number; totalAttempts: number; totalCorrect: number; }; users: MasterOverviewUserRow[]; recentAttempts: MasterRecentAttempt[]; };
export type MasterUserProgressData = { user: MasterOverviewUserRow | null; recentAttempts: MasterRecentAttempt[]; };

const toNumber = (v: number | string | null | undefined) => (Number.isFinite(Number(v ?? 0)) ? Number(v ?? 0) : 0);
const clampPercent = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const sectionTitle = (sectionId: string | null) => SECTIONS.find((s) => s.id === sectionId)?.title ?? sectionId ?? 'Unknown section';
const decorateAttempt = (row: MasterRecentAttemptRow): MasterRecentAttempt => ({ ...row, section_title: sectionTitle(row.section_id) });

export async function getMasterAlgebra1Overview(): Promise<MasterOverviewData> {
  const supabase = getSupabaseBrowserClient() as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> };
  const [overview, attempts] = await Promise.all([supabase.rpc('get_master_algebra1_overview'), supabase.rpc('get_master_algebra1_recent_attempts')]);
  if (overview.error) throw new Error(overview.error.message || 'Failed to load overview.');
  if (attempts.error) throw new Error(attempts.error.message || 'Failed to load recent attempts.');

  const payload = ((overview.data as { summary?: MasterOverviewSummaryRow[]; users?: MasterOverviewUserRow[] } | null) ?? {});
  const summary = payload.summary?.[0];
  return { summary: { totalUsersWithActivity: toNumber(summary?.total_users_with_activity), activeNow: toNumber(summary?.active_now), avgCompletionPercent: clampPercent(toNumber(summary?.avg_completion_percent)), avgAccuracyPercent: clampPercent(toNumber(summary?.avg_accuracy_percent)), totalAttempts: toNumber(summary?.total_attempts), totalCorrect: toNumber(summary?.total_correct) }, users: payload.users ?? [], recentAttempts: ((attempts.data as MasterRecentAttemptRow[] | null) ?? []).map(decorateAttempt) };
}

export async function getMasterAlgebra1UserProgress(userId: string): Promise<MasterUserProgressData> {
  const supabase = getSupabaseBrowserClient() as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }> };
  const { data, error } = await supabase.rpc('get_master_algebra1_user_progress', { p_user_id: userId });
  if (error) throw new Error(error.message || 'Failed to load selected user progress.');
  const payload = ((data as { user?: MasterOverviewUserRow[]; recent_attempts?: MasterRecentAttemptRow[] } | null) ?? {});
  return { user: payload.user?.[0] ?? null, recentAttempts: (payload.recent_attempts ?? []).map(decorateAttempt) };
}
