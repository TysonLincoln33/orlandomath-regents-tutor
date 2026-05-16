-- Phase 2 teacher classroom progress RPC.
-- Additive only: this does not replace existing views or progress RPCs.

begin;

create or replace function public.get_teacher_classroom_progress(p_classroom_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  chapter_id text,
  section_id text,
  questions_attempted bigint,
  questions_correct bigint,
  accuracy_percent numeric,
  completion_percent numeric,
  last_active_at timestamptz,
  attempt_count bigint,
  correct_count bigint,
  last_attempt_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select 1
    from public.classrooms c
    join public.profiles p on p.id = auth.uid()
    where c.id = p_classroom_id
      and p.role in ('teacher', 'master')
      and (c.teacher_id = auth.uid() or p.role = 'master')
  ),
  roster as (
    select
      cm.user_id,
      p.full_name::text as full_name,
      p.email::text as email
    from public.classroom_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.classroom_id = p_classroom_id
  ),
  progress_rows as (
    select
      sp.user_id,
      sp.chapter_id,
      sp.section_id,
      max(sp.questions_attempted)::bigint as questions_attempted,
      max(sp.questions_correct)::bigint as questions_correct,
      max(sp.accuracy_percent)::numeric as accuracy_percent,
      max(sp.completion_percent)::numeric as completion_percent,
      max(sp.last_active_at) as last_active_at
    from public.student_progress sp
    join roster r on r.user_id = sp.user_id
    where sp.app_id = 'regents-algebra'
      and sp.course_id = 'algebra1'
    group by sp.user_id, sp.chapter_id, sp.section_id
  ),
  attempt_rows as (
    select
      qa.user_id,
      qa.chapter_id,
      qa.section_id,
      count(*)::bigint as attempt_count,
      count(*) filter (where qa.correct)::bigint as correct_count,
      max(qa.attempted_at) as last_attempt_at
    from public.question_attempts qa
    join roster r on r.user_id = qa.user_id
    where qa.app_id = 'regents-algebra'
      and qa.course_id = 'algebra1'
    group by qa.user_id, qa.chapter_id, qa.section_id
  ),
  activity_keys as (
    select pr.user_id, pr.chapter_id, pr.section_id from progress_rows pr
    union
    select ar.user_id, ar.chapter_id, ar.section_id from attempt_rows ar
  )
  select
    r.user_id,
    r.full_name,
    r.email,
    coalesce(k.chapter_id, pr.chapter_id, ar.chapter_id)::text as chapter_id,
    coalesce(k.section_id, pr.section_id, ar.section_id)::text as section_id,
    coalesce(pr.questions_attempted, 0)::bigint as questions_attempted,
    coalesce(pr.questions_correct, 0)::bigint as questions_correct,
    coalesce(pr.accuracy_percent, 0)::numeric as accuracy_percent,
    coalesce(pr.completion_percent, 0)::numeric as completion_percent,
    pr.last_active_at,
    coalesce(ar.attempt_count, 0)::bigint as attempt_count,
    coalesce(ar.correct_count, 0)::bigint as correct_count,
    ar.last_attempt_at
  from activity_keys k
  join roster r on r.user_id = k.user_id
  left join progress_rows pr
    on pr.user_id = k.user_id
   and pr.section_id = k.section_id
  left join attempt_rows ar
    on ar.user_id = k.user_id
   and ar.section_id = k.section_id
  where exists (select 1 from authorized)
  order by r.full_name nulls last, r.email nulls last, section_id;
$$;

grant execute on function public.get_teacher_classroom_progress(uuid) to authenticated;

commit;
