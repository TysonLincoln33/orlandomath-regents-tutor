'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CHAPTERS, SECTIONS } from '@/lib/course/algebra1';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  getMasterAlgebra1Assignments,
  getMasterAlgebra1Overview,
  getMasterAlgebra1UserProgress,
  type MasterAlgebra1AssignmentRow,
  type MasterOverviewUserRow,
  type MasterRecentAttempt,
} from '@/lib/master/getMasterAlgebra1Dashboard';
import {
  addMasterStudents,
  createMasterClassroom,
  createMasterStudent,
  getMasterClassrooms,
  moveMasterStudent,
  removeMasterStudent,
  searchMasterStudents,
  type MasterClassroomRow,
  type SearchStudentResult,
} from '@/lib/master/classroomManagement';

import { archiveMasterAssignment, createMasterAssignment, getMasterAssignmentRecipients, groupMasterAssignmentRows, listMasterAssignments, updateMasterAssignment, updateMasterAssignmentRecipient, type MasterAssignment, type MasterAssignmentRecipient } from '@/lib/master/masterAssignments';

type Profile = { id: string; role: string | null; approval_status: string | null };

const formatDateTime = (value: string | null, emptyLabel = 'N/A') => !value ? emptyLabel : (Number.isNaN(new Date(value).getTime()) ? emptyLabel : new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }));
const formatCalendarDate = (value: string | null) => !value ? 'No due date' : (Number.isNaN(new Date(value).getTime()) ? 'No due date' : new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }));
const displayName = (u: { full_name?: string | null; email?: string | null; teacher_name?: string | null; teacher_email?: string | null }) => u.full_name?.trim() || u.teacher_name?.trim() || u.email?.split('@')[0] || u.teacher_email?.split('@')[0] || 'Unknown User';
const getSectionLabel = (sectionId: string | null) => { if (!sectionId) return 'No section'; const section = SECTIONS.find((i) => i.id === sectionId); return section ? `Chapter ${section.chapterNumber}, Section ${section.sectionNumber}: ${section.title} (${sectionId})` : sectionId; };
const getShortSectionLabel = (sectionId: string | null) => { if (!sectionId) return 'No section'; const section = SECTIONS.find((i) => i.id === sectionId); return section ? `Ch ${section.chapterNumber} · Sec ${section.sectionNumber}` : sectionId; };
const formatDateTimeRange = (start: string, end: string) => start === end ? formatDateTime(start) : `${formatDateTime(start)} – ${formatDateTime(end)}`;
const getErrorMessage = (e: unknown, fallback: string) => e instanceof Error ? e.message : fallback;

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

  const [masterClassrooms, setMasterClassrooms] = useState<MasterClassroomRow[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
  const [classroomSearch, setClassroomSearch] = useState('');
  const [classroomSearchResults, setClassroomSearchResults] = useState<SearchStudentResult[]>([]);
  const [selectedSearchStudentIds, setSelectedSearchStudentIds] = useState<string[]>([]);
  const [newClassroomName, setNewClassroomName] = useState('');
  const [newClassroomTerm, setNewClassroomTerm] = useState('');
  const [newStudentFirstName, setNewStudentFirstName] = useState('');
  const [newStudentLastName, setNewStudentLastName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [classroomMessage, setClassroomMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [mAssignments, setMAssignments] = useState<MasterAssignment[]>([]);
  const [mTitle, setMTitle] = useState('');
  const [mDescription, setMDescription] = useState('');
  const [mDueDate, setMDueDate] = useState('');
  const [mSelectedSectionIds, setMSelectedSectionIds] = useState<string[]>([]);
  const [mSelectedChapterIds, setMSelectedChapterIds] = useState<string[]>([]);
  const [mSelectorOpen, setMSelectorOpen] = useState(false);
  const [mExpandedChapterIds, setMExpandedChapterIds] = useState<string[]>([]);
  const [mClassroomId, setMClassroomId] = useState('');
  const [mTarget, setMTarget] = useState<'class'|'students'>('class');
  const [mSelectedUsers, setMSelectedUsers] = useState<string[]>([]);
  const [mMsg, setMMsg] = useState<string | null>(null);
  const [mEditingAssignmentId, setMEditingAssignmentId] = useState<string | null>(null);
  const [mEditTitle, setMEditTitle] = useState('');
  const [mEditDescription, setMEditDescription] = useState('');
  const [mEditDueDate, setMEditDueDate] = useState('');
  const [mRecipients, setMRecipients] = useState<MasterAssignmentRecipient[] | null>(null);
  const [mRecipientAssignmentId, setMRecipientAssignmentId] = useState<string | null>(null);
  const [mRecipientsLoading, setMRecipientsLoading] = useState(false);
  const [mRecipientError, setMRecipientError] = useState<string | null>(null);

  const refreshOversightAssignments = async () => {
    setAssignmentsLoading(true);
    try {
      setAssignments(await getMasterAlgebra1Assignments());
      setAssignmentError(null);
    } catch (assignmentLoadError) {
      setAssignments([]);
      setAssignmentError(getErrorMessage(assignmentLoadError, 'Assignments panel failed to load.'));
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const refreshManagementAssignments = async () => {
    const result = await listMasterAssignments();
    setMAssignments(result.assignments || []);
  };

  const refreshMasterAssignmentPanels = async () => {
    await Promise.all([refreshOversightAssignments(), refreshManagementAssignments()]);
  };

  useEffect(() => { (async () => {
    setLoading(true); setError(null); setAssignmentsLoading(true);
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
      await refreshOversightAssignments();
    } catch (e) { setError(getErrorMessage(e, 'Failed to load dashboard.')); setAssignmentsLoading(false); }
    finally { setLoading(false); }
  try { await refreshManagementAssignments(); } catch {}
  })(); }, []);

  const loadClassrooms = async () => {
    try {
      const rows = await getMasterClassrooms();
      setMasterClassrooms(rows);
      setSelectedClassroomId((prev) => (prev && rows.some((r) => r.id === prev) ? prev : rows[0]?.id ?? null));
    } catch (e) { setClassroomMessage(getErrorMessage(e, 'Failed to load classrooms.')); }
  };
  useEffect(() => { void loadClassrooms(); }, []);

  const userById = useMemo(() => new Map(users.map((u) => [u.user_id, u])), [users]);
  const selectedClassroom = useMemo(() => masterClassrooms.find((c) => c.id === selectedClassroomId) ?? null, [masterClassrooms, selectedClassroomId]);
  const availableSearchResults = classroomSearchResults.filter((s) => !s.already_in_classroom);

  const onSelectUser = async (userId: string) => { setSelectedUserId(userId); setSelectedUser(userById.get(userId) ?? null); try { const data = await getMasterAlgebra1UserProgress(userId); setSelectedUser(data.user ?? userById.get(userId) ?? null); setSelectedAttempts(data.recentAttempts); } catch { setSelectedAttempts([]); } };
  const onSearchStudents = async (value: string) => {
    setClassroomSearch(value); setSelectedSearchStudentIds([]);
    if (!selectedClassroom || value.trim().length < 2) { setClassroomSearchResults([]); return; }
    try { setClassroomSearchResults(await searchMasterStudents(selectedClassroom.id, value)); }
    catch (e) { setClassroomMessage(getErrorMessage(e, 'Failed to search students.')); }
  };

  const filteredAssignments = useMemo(() => assignments.filter((assignment) => {
    if (teacherFilter !== 'all' && assignment.teacher_id !== teacherFilter) return false;
    if (statusFilter === 'active' && Boolean(assignment.archived_at)) return false;
    if (statusFilter === 'archived' && !assignment.archived_at) return false;
    const query = assignmentSearch.trim().toLowerCase();
    if (!query) return true;
    return [assignment.title, assignment.classroom_name ?? '', assignment.teacher_name ?? '', assignment.teacher_email ?? '', assignment.section_id ?? ''].join(' ').toLowerCase().includes(query);
  }), [assignments, teacherFilter, statusFilter, assignmentSearch]);

  const assignmentGroups = useMemo(() => groupMasterAssignmentRows(filteredAssignments), [filteredAssignments]);
  const mAssignmentGroups = useMemo(() => groupMasterAssignmentRows(mAssignments), [mAssignments]);
  const assignmentTeacherOptions = useMemo(() => { const t = new Map<string, string>(); assignments.forEach((a) => t.set(a.teacher_id, `${displayName(a)} (${a.teacher_email ?? 'No email'})`)); return Array.from(t.entries()); }, [assignments]);

  const loadMasterRecipients = async (assignmentId: string) => {
    setMRecipientAssignmentId(assignmentId);
    setMRecipientsLoading(true);
    setMRecipientError(null);
    setMRecipients(null);

    try {
      const x = await getMasterAssignmentRecipients(assignmentId);
      setMRecipientAssignmentId((currentAssignmentId) => (currentAssignmentId === assignmentId ? assignmentId : currentAssignmentId));
      setMRecipients(x.recipients);
    } catch (e) {
      setMRecipientError(getErrorMessage(e, 'Failed to load recipients.'));
    } finally {
      setMRecipientsLoading(false);
    }
  };

  const toggleMasterRecipientExcuse = async (recipient: MasterAssignmentRecipient) => {
    if (!mRecipientAssignmentId) return;
    try {
      const nextStatus = recipient.status === 'excused' ? 'assigned' : 'excused';
      await updateMasterAssignmentRecipient(mRecipientAssignmentId, recipient.user_id, nextStatus);
      await Promise.all([loadMasterRecipients(mRecipientAssignmentId), refreshMasterAssignmentPanels()]);
    } catch (e) {
      setMRecipientError(getErrorMessage(e, 'Failed to update recipient status.'));
    }
  };

  const beginEditMasterAssignment = (assignment: MasterAssignment) => {
    setMEditingAssignmentId(assignment.id);
    setMEditTitle(assignment.title);
    setMEditDescription(assignment.description ?? '');
    setMEditDueDate((assignment.due_date ?? '').slice(0, 10));
    setMMsg(null);
  };

  const cancelEditMasterAssignment = () => {
    setMEditingAssignmentId(null);
    setMEditTitle('');
    setMEditDescription('');
    setMEditDueDate('');
  };

  const assignmentSummary = useMemo(
    () =>
      assignments.reduce(
        (acc, assignment) => {
          acc.totalAssignments += 1;
          if (assignment.archived_at) acc.archivedAssignments += 1;
          else acc.activeAssignments += 1;
          acc.totalRecipients += Number(assignment.recipient_count ?? 0);
          acc.completedRecipients += Number(assignment.completed_count ?? 0);
          acc.incompleteRecipients += Number(assignment.incomplete_count ?? 0);
          acc.excusedRecipients += Number(assignment.excused_count ?? 0);
          return acc;
        },
        { totalAssignments: 0, activeAssignments: 0, archivedAssignments: 0, totalRecipients: 0, completedRecipients: 0, incompleteRecipients: 0, excusedRecipients: 0 },
      ),
    [assignments],
  );

  const panelAttempts = selectedUserId ? selectedAttempts : recentAttempts;
  const mSectionIdsFromSelectedChapters = useMemo(() => SECTIONS.filter((section) => mSelectedChapterIds.includes(section.chapterId)).map((section) => section.id), [mSelectedChapterIds]);
  const mResolvedSectionIds = useMemo(() => [...new Set([...mSelectedSectionIds, ...mSectionIdsFromSelectedChapters])], [mSelectedSectionIds, mSectionIdsFromSelectedChapters]);
  const mSelectedChapterLabels = useMemo(() => CHAPTERS.filter((chapter) => mSelectedChapterIds.includes(chapter.id)).map((chapter) => `Chapter ${chapter.number}: ${chapter.title}`), [mSelectedChapterIds]);
  const mSelectedSectionLabels = useMemo(() => mSelectedSectionIds.map((sectionId) => getSectionLabel(sectionId)), [mSelectedSectionIds]);

  const toggleMSelectedChapter = (chapterId: string) => {
    setMSelectedChapterIds((prev) => prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]);
  };

  const toggleMSelectedSection = (sectionId: string) => {
    setMSelectedSectionIds((prev) => prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]);
  };

  const toggleMExpandedChapter = (chapterId: string) => {
    setMExpandedChapterIds((prev) => prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]);
  };

  const resetMasterAssignmentForm = () => {
    setMTitle('');
    setMDescription('');
    setMDueDate('');
    setMTarget('class');
    setMSelectedUsers([]);
    setMSelectedChapterIds([]);
    setMSelectedSectionIds([]);
    setMSelectorOpen(false);
    setMExpandedChapterIds([]);
  };

  if (loading) return <main className="min-h-screen bg-slate-950 p-8 text-white"><div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-white/10 p-8">Loading Master Dashboard...</div></main>;
  if (error) return <main className="min-h-screen bg-slate-950 p-8 text-white"><div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/10 p-8"><h1 className="text-3xl font-black">Master Dashboard</h1><p className="mt-3 text-white/80">{error}</p><div className="mt-5"><Link href="/dashboard" className="rounded-lg bg-indigo-500 px-4 py-2">Go to Dashboard</Link></div></div></main>;

  return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-7xl">
    <h1 className="mb-4 text-3xl font-black">Master Dashboard (Algebra 1)</h1>
    <p className="mb-6 text-sm text-white/70">Global Regents Algebra 1 overview + interactive classroom management.</p>

    {/* existing overview + assignments mostly unchanged */}
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-xl font-bold">All Users</h2>
            {users.length === 0 ? <p className="text-white/70">No Algebra 1 users found yet.</p> : <ul className="space-y-3">{users.map((u) => <li key={u.user_id} className="rounded-xl border border-white/10 p-3"><p className="font-semibold">{displayName(u)}</p><p className="text-xs text-white/70">{u.email ?? 'No email'}</p><p className="text-xs text-white/60">Last activity: {formatDateTime(u.last_activity_at, 'No activity yet')}</p><button onClick={() => void onSelectUser(u.user_id)} className="mt-2 rounded-md bg-indigo-500 px-3 py-1 text-sm">View Progress</button></li>)}</ul>}
          </aside>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-3 sm:grid-cols-3">{[
              ['Total users', summary.totalUsersWithActivity], ['Active now', summary.activeNow], ['Avg completion', `${summary.avgCompletionPercent}%`], ['Avg accuracy', `${summary.avgAccuracyPercent}%`], ['Total attempts', summary.totalAttempts], ['Total correct', summary.totalCorrect],
            ].map(([k, v]) => <div key={String(k)} className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-xs text-white/60">{k}</p><p className="text-xl font-bold">{v}</p></div>)}</div>

            <div className="mt-6">
              <h2 className="text-xl font-bold">{selectedUser ? `${displayName(selectedUser)} Progress` : 'Recent Attempts'}</h2>
              {selectedUser && <p className="mb-3 text-sm text-white/70">{selectedUser.email ?? 'No email'} · Completion {Math.round(Number(selectedUser.completion_percent ?? 0))}% · Accuracy {selectedUser.accuracy_percent == null ? '—' : `${Math.round(Number(selectedUser.accuracy_percent))}%`} · Attempts {Number(selectedUser.attempts_count ?? 0)} · Correct {Number(selectedUser.correct_count ?? 0)}</p>}
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
                {assignmentGroups.length === 0 ? <p className="text-white/70">No assignments yet.</p> : <table className="min-w-full border-collapse text-sm"><thead><tr className="border-b border-white/10 text-left text-white/70"><th className="px-2 py-2">Teacher</th><th className="px-2 py-2">Classroom</th><th className="px-2 py-2">Assignment group</th><th className="px-2 py-2">Sections</th><th className="px-2 py-2">Due date</th><th className="px-2 py-2">Created</th><th className="px-2 py-2">Updated</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Recipients</th></tr></thead><tbody>{assignmentGroups.map((group) => <tr key={group.id} className="border-b border-white/5 align-top"><td className="px-2 py-2"><p>{group.teacherName ?? 'Unknown teacher'}</p><p className="text-xs text-white/60">{group.teacherEmail ?? 'No email'}</p></td><td className="px-2 py-2">{group.classroomName ?? group.classroomId}</td><td className="px-2 py-2"><p className="font-semibold">{group.title}</p><p className="text-xs text-white/60">{group.description || 'No description'}</p></td><td className="px-2 py-2"><p className="mb-1 text-xs text-white/60">{group.sectionIds.length} section{group.sectionIds.length === 1 ? '' : 's'}</p><div className="flex max-w-xs flex-wrap gap-1">{group.sectionIds.map((sectionId) => <span key={`${group.id}-${sectionId ?? 'none'}`} className="rounded-full border border-indigo-300/30 bg-indigo-400/10 px-2 py-0.5 text-xs">{getShortSectionLabel(sectionId)}</span>)}</div></td><td className="px-2 py-2">{formatCalendarDate(group.dueDate)}</td><td className="px-2 py-2">{formatDateTimeRange(group.createdAtStart, group.createdAtEnd)}</td><td className="px-2 py-2">{formatDateTime(group.updatedAtLatest)}</td><td className="px-2 py-2">{group.isArchived ? 'Archived' : 'Active'}</td><td className="px-2 py-2">{group.recipientCount} total · {group.completedCount} complete · {group.incompleteCount} incomplete · {group.excusedCount} excused</td></tr>)}</tbody></table>}
              </div>
            </>
          ) : null}
        </section>


    <section className="mt-8 rounded-2xl border-2 border-cyan-400/40 bg-white/5 p-5" aria-label="Master Assignment Management">
      <h2 className="text-2xl font-black text-cyan-200">Master Assignment Management</h2>
      {mMsg ? <p className="mb-2 text-sm">{mMsg}</p> : null}
      <div className="grid gap-2 md:grid-cols-3">
        <input value={mTitle} onChange={(e)=>setMTitle(e.target.value)} placeholder="Assignment title" className="rounded bg-black/20 px-2 py-1" />
        <input value={mDescription} onChange={(e)=>setMDescription(e.target.value)} placeholder="Description" className="rounded bg-black/20 px-2 py-1" />
        <input type="date" value={mDueDate} onChange={(e)=>setMDueDate(e.target.value)} className="rounded bg-black/20 px-2 py-1" />
        <select value={mClassroomId} onChange={(e)=>{setMClassroomId(e.target.value); setMSelectedUsers([]);}} className="rounded bg-black/20 px-2 py-1"><option value="">Select classroom</option>{masterClassrooms.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={mTarget} onChange={(e)=>setMTarget(e.target.value as 'class'|'students')} className="rounded bg-black/20 px-2 py-1"><option value="class">Entire class</option><option value="students">Selected students</option></select>
      </div>
      <div className="mt-3 rounded border border-white/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Section targeting</p>
            <p className="text-xs text-white/70">Select any mix of chapters and individual sections. One assignment row will be created per resolved section.</p>
          </div>
          <button type="button" className="rounded bg-cyan-600 px-3 py-1 text-sm" onClick={() => setMSelectorOpen((open) => !open)} aria-expanded={mSelectorOpen}>Choose chapters/sections</button>
        </div>
        {mSelectorOpen ? <div className="mt-3 max-h-96 space-y-2 overflow-y-auto rounded border border-white/10 bg-black/20 p-3">
          {CHAPTERS.map((chapter) => {
            const chapterSections = SECTIONS.filter((section) => section.chapterId === chapter.id);
            const chapterChecked = mSelectedChapterIds.includes(chapter.id);
            const chapterExpanded = mExpandedChapterIds.includes(chapter.id);
            return <div key={chapter.id} className="rounded border border-white/10 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={chapterChecked} onChange={() => toggleMSelectedChapter(chapter.id)} />
                  <span>{`Chapter ${chapter.number}: ${chapter.title}`}</span>
                </label>
                <button type="button" className="rounded bg-slate-700 px-2 py-0.5 text-xs" onClick={() => toggleMExpandedChapter(chapter.id)} aria-expanded={chapterExpanded}>{chapterExpanded ? 'Hide sections' : 'Show sections'}</button>
              </div>
              {chapterExpanded ? <div className="mt-2 grid gap-1 md:grid-cols-2">
                {chapterSections.map((section) => <label key={section.id} className="inline-flex items-center gap-2 text-xs text-white/80">
                  <input type="checkbox" checked={mSelectedSectionIds.includes(section.id)} onChange={() => toggleMSelectedSection(section.id)} />
                  <span>{`Section ${section.sectionNumber}: ${section.title} (${section.id})`}</span>
                </label>)}
              </div> : null}
            </div>;
          })}
        </div> : null}
        <p className="mt-3 text-xs text-cyan-200">Selected chapters: {mSelectedChapterIds.length} · Resolved sections: {mResolvedSectionIds.length}</p>
        <div className="mt-2 flex flex-wrap gap-1">{mSelectedChapterLabels.map((label) => <span key={label} className="rounded-full border border-indigo-300/40 bg-indigo-400/10 px-2 py-0.5 text-xs">{label}</span>)}</div>
        <div className="mt-2 flex flex-wrap gap-1">{mSelectedSectionLabels.map((label) => <span key={label} className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-2 py-0.5 text-xs">{label}</span>)}</div>
      </div>
      {mTarget==='students' && mClassroomId ? <div className="mt-2 max-h-36 overflow-y-auto rounded border border-white/10 p-2">{(masterClassrooms.find((c)=>c.id===mClassroomId)?.members ?? []).map((m)=><label key={m.user_id} className="mr-3 inline-flex items-center gap-1 text-sm"><input type="checkbox" checked={mSelectedUsers.includes(m.user_id)} onChange={()=>setMSelectedUsers((prev)=>prev.includes(m.user_id)?prev.filter((id)=>id!==m.user_id):[...prev,m.user_id])} />{m.full_name ?? m.email}</label>)}</div>:null}
      <button className="mt-2 rounded bg-cyan-600 px-3 py-1 text-sm" onClick={async()=>{try{const result = await createMasterAssignment({title:mTitle,description:mDescription,due_date:mDueDate,section_ids:mSelectedSectionIds,chapter_ids:mSelectedChapterIds,classroom_id:mClassroomId,target:mTarget,recipient_user_ids:mSelectedUsers}); await refreshMasterAssignmentPanels(); resetMasterAssignmentForm(); setMMsg(`Created ${result.created_count} assignment${result.created_count===1?'':'s'}.`);}catch(e){setMMsg(getErrorMessage(e,'Failed'));}}}>Create Assignment</button>
      <div className="mt-4 space-y-3">{mAssignmentGroups.map((group) => <div key={group.id} className="rounded border border-white/10 bg-black/10 p-3 text-sm"><div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><p><b>{group.title}</b> · {group.classroomName ?? group.classroomId} · {formatCalendarDate(group.dueDate)} · {group.isArchived ? 'Archived' : 'Active'}</p><p className="text-xs text-white/60">{group.description || 'No description'} · Created {formatDateTimeRange(group.createdAtStart, group.createdAtEnd)} · Updated {formatDateTime(group.updatedAtLatest)}</p><p className="mt-1 text-xs text-white/70">{group.recipientCount} recipients · {group.completedCount} complete · {group.incompleteCount} incomplete · {group.excusedCount} excused</p><div className="mt-2 flex flex-wrap gap-1"><span className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-2 py-0.5 text-xs">{group.sectionIds.length} section{group.sectionIds.length === 1 ? '' : 's'}</span>{group.sectionIds.map((sectionId) => <span key={`${group.id}-${sectionId ?? 'none'}`} className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs">{getShortSectionLabel(sectionId)}</span>)}</div></div></div><div className="mt-3 space-y-2 border-t border-white/10 pt-3">{group.assignments.map((a) => { const isEditing = mEditingAssignmentId === a.id; const isArchived = Boolean(a.archived_at); return <div key={a.id} className="rounded border border-white/10 p-2"><div className="flex flex-wrap justify-between gap-2"><div><b>{getSectionLabel(a.section_id)}</b><p className="text-xs text-white/60">{formatCalendarDate(a.due_date)} · {isArchived ? 'Archived' : 'Active'} · {Number(a.recipient_count ?? 0)} total · {Number(a.completed_count ?? 0)} complete · {Number(a.incomplete_count ?? 0)} incomplete · {Number(a.excused_count ?? 0)} excused</p></div><div className="flex flex-wrap gap-2">{isEditing ? <><button onClick={async()=>{ try { if (!mEditTitle.trim()) { setMMsg('Assignment title is required.'); return; } await updateMasterAssignment(a.id,{title:mEditTitle,description:mEditDescription,due_date:mEditDueDate || null}); cancelEditMasterAssignment(); await refreshMasterAssignmentPanels(); setMMsg('Assignment updated.'); } catch (e) { setMMsg(getErrorMessage(e, 'Failed to update assignment.')); } }} className="rounded bg-emerald-600 px-2">Save</button><button onClick={cancelEditMasterAssignment} className="rounded bg-slate-600 px-2">Cancel</button></> : <button onClick={()=>beginEditMasterAssignment(a)} className="rounded bg-indigo-600 px-2">Edit</button>}<button onClick={async()=>{ try { if (isArchived) { setMMsg('Assignment is already archived.'); return; } await archiveMasterAssignment(a.id); await refreshMasterAssignmentPanels(); setMMsg('Assignment archived.'); } catch (e) { setMMsg(getErrorMessage(e, 'Failed to archive assignment.')); } }} className="rounded bg-rose-600 px-2 disabled:opacity-60" disabled={isArchived}>{isArchived ? 'Archived' : 'Archive'}</button><button onClick={() => void loadMasterRecipients(a.id)} className="rounded bg-slate-600 px-2">View Recipients</button></div></div>{isEditing ? <div className="mt-2 grid gap-2 md:grid-cols-3"><input value={mEditTitle} onChange={(e)=>setMEditTitle(e.target.value)} placeholder="Assignment title" className="rounded bg-black/20 px-2 py-1" /><input value={mEditDescription} onChange={(e)=>setMEditDescription(e.target.value)} placeholder="Description" className="rounded bg-black/20 px-2 py-1" /><input type="date" value={mEditDueDate} onChange={(e)=>setMEditDueDate(e.target.value)} className="rounded bg-black/20 px-2 py-1" /></div> : null}</div>; })}</div></div>)}</div>
      {mRecipientsLoading ? <p className="mt-3 text-sm text-white/70">Loading recipients…</p> : null}
      {mRecipientError ? <p className="mt-3 rounded border border-rose-400/30 bg-rose-500/10 p-2 text-sm text-rose-100">{mRecipientError}</p> : null}
      {mRecipients && mRecipientAssignmentId ? <div className="mt-3 rounded border border-white/10 p-2">{mRecipients.map((r)=><div key={r.user_id} className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm"><span>{r.full_name ?? r.email} · {r.email} · {r.status} · completion {Math.round(Number(r.completion_percent ?? 0))}% · accuracy {Math.round(Number(r.accuracy_percent ?? 0))}% · {Number(r.questions_correct ?? 0)}/{Number(r.questions_attempted ?? 0)} · {formatDateTime(r.last_activity_at)}</span><button className="rounded bg-amber-600 px-2" onClick={() => void toggleMasterRecipientExcuse(r)}>{r.status==='excused'?'Un-excuse':'Mark Excused'}</button></div>)}</div> : null}
    </section>

    <section className="mt-8 rounded-2xl border-2 border-emerald-400/40 bg-white/5 p-5" aria-label="Master Classroom Management">
      <h2 className="text-2xl font-black text-emerald-200">Master Classroom Management</h2>
      <p className="mb-4 text-sm text-white/70">Global classroom and student roster management.</p>
      {classroomMessage ? <p className="mb-3 rounded border border-white/10 bg-black/20 p-2 text-sm">{classroomMessage}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-2 rounded-xl border border-white/10 p-3">
          {masterClassrooms.map((c) => <button type="button" key={c.id} onClick={() => { setSelectedClassroomId(c.id); setClassroomSearch(''); setClassroomSearchResults([]); setSelectedSearchStudentIds([]); }} className={`w-full rounded-lg border p-3 text-left ${selectedClassroomId===c.id?'border-emerald-400/70 bg-emerald-500/10':'border-white/10'}`}><p className="font-semibold">{c.name}</p><p className="text-xs text-white/70">{c.teacher_name ?? 'Unknown teacher'} · {c.teacher_email ?? 'No email'}</p><p className="text-xs text-white/60">Term: {c.term ?? 'N/A'} · Roster: {c.roster_count} · Assignments: {c.assignment_count}</p></button>)}
          <form className="mt-3 space-y-2 rounded-lg border border-white/10 p-3" onSubmit={async (event) => { event.preventDefault(); if (!newClassroomName.trim()) return; setIsSaving(true); setClassroomMessage(null); try { await createMasterClassroom({ name: newClassroomName.trim(), term: newClassroomTerm.trim() || undefined }); setNewClassroomName(''); setNewClassroomTerm(''); await loadClassrooms(); setClassroomMessage('Classroom created.'); } catch (e) { setClassroomMessage(getErrorMessage(e, 'Failed to create classroom.')); } finally { setIsSaving(false); } }}>
            <input value={newClassroomName} onChange={(e)=>setNewClassroomName(e.target.value)} placeholder="New classroom name" className="w-full rounded bg-black/20 px-2 py-1" />
            <input value={newClassroomTerm} onChange={(e)=>setNewClassroomTerm(e.target.value)} placeholder="Term (optional)" className="w-full rounded bg-black/20 px-2 py-1" />
            <button type="submit" disabled={isSaving || !newClassroomName.trim()} className="rounded bg-emerald-600 px-3 py-1 text-sm disabled:opacity-50">Create classroom</button>
          </form>
        </aside>
        <div className="rounded-xl border border-white/10 p-3">
          {!selectedClassroom ? <p>Select a classroom.</p> : <>
            <h3 className="text-xl font-bold">{selectedClassroom.name}</h3>
            <p className="mb-3 text-sm text-white/70">Teacher: {selectedClassroom.teacher_name ?? 'Unknown'} ({selectedClassroom.teacher_email ?? 'No email'})</p>
            <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto]">
              <input value={classroomSearch} onChange={(e)=>void onSearchStudents(e.target.value)} placeholder="Search existing students" className="rounded bg-black/20 px-2 py-1" />
              <button type="button" disabled={isSaving || selectedSearchStudentIds.length === 0} onClick={async()=>{ setIsSaving(true); setClassroomMessage(null); try { const result = await addMasterStudents(selectedClassroom.id, selectedSearchStudentIds); setClassroomMessage(`Added ${result.added_count} students (${result.already_enrolled_count} already enrolled).`); setSelectedSearchStudentIds([]); await loadClassrooms(); } catch (e) { setClassroomMessage(getErrorMessage(e, 'Failed to add students.')); } finally { setIsSaving(false); } }} className="rounded bg-indigo-600 px-3 py-1 text-sm disabled:opacity-50">Add selected students</button>
            </div>
            <div className="mb-3 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2 text-sm">{availableSearchResults.length === 0 ? <p className="text-white/60">No matching students.</p> : availableSearchResults.map((s) => <label key={s.id} className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={selectedSearchStudentIds.includes(s.id)} onChange={() => setSelectedSearchStudentIds((prev) => prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id])} /><span>{s.full_name ?? s.email} <span className="text-xs text-white/60">({s.email ?? 'No email'})</span></span></label>)}</div>
            <form className="mb-4 grid gap-2 md:grid-cols-4" onSubmit={async (e) => { e.preventDefault(); const firstName = newStudentFirstName.trim(); const lastName = newStudentLastName.trim(); const fullName = [firstName, lastName].filter(Boolean).join(' ').trim(); if (!fullName || !newStudentEmail.trim()) return; setIsSaving(true); setClassroomMessage(null); try { const result = await createMasterStudent(selectedClassroom.id, fullName, newStudentEmail.trim());
                if (result.status === 'created_and_added') {
                  setClassroomMessage(`Student created and added. Temporary login: ${result.email} (password setup via invite email).`);
                } else {
                  setClassroomMessage(`Student ${result.status.replaceAll('_', ' ')}.`);
                }
                setNewStudentFirstName('');
                setNewStudentLastName('');
                setNewStudentEmail(''); await loadClassrooms(); } catch (err) { setClassroomMessage(getErrorMessage(err, 'Failed to create student.')); } finally { setIsSaving(false); } }}>
              <input value={newStudentFirstName} onChange={(e)=>setNewStudentFirstName(e.target.value)} placeholder="Student first name" className="rounded bg-black/20 px-2 py-1" />
              <input value={newStudentLastName} onChange={(e)=>setNewStudentLastName(e.target.value)} placeholder="Student last name" className="rounded bg-black/20 px-2 py-1" />
              <input value={newStudentEmail} onChange={(e)=>setNewStudentEmail(e.target.value)} placeholder="New student email" className="rounded bg-black/20 px-2 py-1" />
              <button type="submit" disabled={isSaving || !newStudentFirstName.trim() || !newStudentLastName.trim() || !newStudentEmail.trim()} className="rounded bg-indigo-600 px-3 py-1 text-sm disabled:opacity-50">Create student + add</button>
            </form>
            <ul className="space-y-2">{selectedClassroom.members.map((m) => <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/10 p-2"><span>{m.full_name ?? m.email} <span className="text-xs text-white/60">({m.email ?? 'No email'})</span></span><span className="flex gap-2"><select onChange={async(e)=>{const toClassroomId = e.target.value; if(!toClassroomId) return; setIsSaving(true); setClassroomMessage(null); try { await moveMasterStudent(selectedClassroom.id,m.user_id,toClassroomId); setClassroomMessage('Student moved successfully.'); await loadClassrooms(); } catch (err) { setClassroomMessage(getErrorMessage(err, 'Failed to move student.')); } finally { e.currentTarget.value=''; setIsSaving(false); }}} defaultValue="" className="rounded bg-black/30 px-1 py-1 text-xs"><option value="">Move to…</option>{masterClassrooms.filter((c)=>c.id!==selectedClassroom.id).map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" onClick={async()=>{ setIsSaving(true); setClassroomMessage(null); try { await removeMasterStudent(selectedClassroom.id,m.user_id); setClassroomMessage('Student removed from classroom.'); await loadClassrooms(); } catch (err) { setClassroomMessage(getErrorMessage(err, 'Failed to remove student.')); } finally { setIsSaving(false); } }} className="rounded bg-rose-600 px-2 py-1 text-xs">Remove</button></span></li>)}</ul>
          </>}
        </div>
      </div>
    </section>
  </div></main>;
}
