-- Phase T5 teacher assignment recipient detail RPC.
-- Additive only: this does not replace existing views, tables, or progress RPCs.

begin;

create or replace function public.get_teacher_assignment_recipients(
  p_classroom_id uuid,
  p_assignment_id uuid
)
returns table (
  assignment_id uuid,
  user_id uuid,
  full_name text,
  email text,
  status text,
  completion_percent numeric,
  accuracy_percent numeric,
  is_complete boolean,
  completed_at timestamptz,
  last_active_at timestamptz,
  questions_attempted bigint,
  questions_correct bigint
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
  assignment_scope as (
    select a.id, a.classroom_id, a.section_id
    from public.assignments a
    where a.id = p_assignment_id
      and a.classroom_id = p_classroom_id
  ),
  assigned_roster as (
    select
      ar.assignment_id,
      ar.user_id,
      p.full_name::text as full_name,
      p.email::text as email,
      ar.status::text as status,
      ar.completed_at
    from public.assignment_recipients ar
    join assignment_scope a
      on a.id = ar.assignment_id
     and a.classroom_id = ar.classroom_id
    join public.classroom_members cm
      on cm.classroom_id = ar.classroom_id
     and cm.user_id = ar.user_id
    join public.profiles p on p.id = ar.user_id
    where ar.assignment_id = p_assignment_id
      and ar.classroom_id = p_classroom_id
  ),
  progress_rows as (
    select
      sp.user_id,
      max(sp.questions_attempted)::bigint as questions_attempted,
      max(sp.questions_correct)::bigint as questions_correct,
      max(sp.completion_percent)::numeric as completion_percent,
      max(sp.accuracy_percent)::numeric as accuracy_percent,
      max(sp.last_active_at) as last_active_at
    from public.student_progress sp
    join assigned_roster ar on ar.user_id = sp.user_id
    join assignment_scope a on a.id = ar.assignment_id
    where sp.app_id = 'regents-algebra'
      and sp.course_id = 'algebra1'
      and sp.section_id = a.section_id
    group by sp.user_id
  ),
  attempt_rows as (
    select
      qa.user_id,
      count(*)::bigint as attempt_count,
      count(*) filter (where qa.correct)::bigint as correct_count,
      max(qa.attempted_at) as last_attempt_at
    from public.question_attempts qa
    join assigned_roster ar on ar.user_id = qa.user_id
    join assignment_scope a on a.id = ar.assignment_id
    where qa.app_id = 'regents-algebra'
      and qa.course_id = 'algebra1'
      and qa.section_id = a.section_id
    group by qa.user_id
  )
  select
    ar.assignment_id,
    ar.user_id,
    ar.full_name,
    ar.email,
    ar.status,
    coalesce(pr.completion_percent, 0)::numeric as completion_percent,
    case
      when coalesce(attempt_rows.attempt_count, 0) > 0 then
        round((attempt_rows.correct_count::numeric / attempt_rows.attempt_count::numeric) * 100, 2)
      else coalesce(pr.accuracy_percent, 0)::numeric
    end as accuracy_percent,
    (
      ar.status = 'completed'
      or ar.completed_at is not null
      or coalesce(pr.completion_percent, 0) >= 100
    ) as is_complete,
    ar.completed_at,
    nullif(
      greatest(
        coalesce(pr.last_active_at, '-infinity'::timestamptz),
        coalesce(attempt_rows.last_attempt_at, '-infinity'::timestamptz)
      ),
      '-infinity'::timestamptz
    ) as last_active_at,
    coalesce(pr.questions_attempted, attempt_rows.attempt_count, 0)::bigint as questions_attempted,
    coalesce(pr.questions_correct, attempt_rows.correct_count, 0)::bigint as questions_correct
  from assigned_roster ar
  left join progress_rows pr on pr.user_id = ar.user_id
  left join attempt_rows on attempt_rows.user_id = ar.user_id
  where exists (select 1 from authorized)
    and exists (select 1 from assignment_scope)
  order by ar.full_name nulls last, ar.email nulls last;
$$;

grant execute on function public.get_teacher_assignment_recipients(uuid, uuid) to authenticated;

commit;
