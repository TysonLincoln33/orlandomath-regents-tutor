-- Phase T5 teacher assignment recipient detail RPC.
-- Additive only: exposes assignment recipient progress for the Regents Algebra 1 app/course.

begin;

create or replace function public.get_teacher_assignment_recipients(
  p_classroom_id uuid,
  p_assignment_id uuid
)
returns table (
  assignment_id uuid,
  assignment_title text,
  assignment_section_id text,
  assignment_due_date date,
  assignment_created_at timestamptz,
  assignment_updated_at timestamptz,
  user_id uuid,
  full_name text,
  email text,
  status text,
  assigned_at timestamptz,
  completed_at timestamptz,
  questions_attempted bigint,
  questions_correct bigint,
  completion_percent numeric,
  accuracy_percent numeric,
  attempt_count bigint,
  correct_count bigint,
  last_activity_at timestamptz
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
  assignment_row as (
    select
      a.id,
      a.title,
      a.section_id,
      a.due_date,
      a.created_at,
      a.updated_at
    from public.assignments a
    where a.id = p_assignment_id
      and a.classroom_id = p_classroom_id
  ),
  recipients as (
    select
      ar.assignment_id,
      ar.classroom_id,
      ar.user_id,
      ar.status,
      ar.assigned_at,
      ar.completed_at,
      p.full_name::text as full_name,
      p.email::text as email
    from public.assignment_recipients ar
    join assignment_row a on a.id = ar.assignment_id
    join public.classroom_members cm
      on cm.classroom_id = ar.classroom_id
     and cm.user_id = ar.user_id
    join public.profiles p on p.id = ar.user_id
    where ar.classroom_id = p_classroom_id
      and ar.assignment_id = p_assignment_id
  ),
  progress_rows as (
    select
      sp.user_id,
      max(sp.questions_attempted)::bigint as questions_attempted,
      max(sp.questions_correct)::bigint as questions_correct,
      max(sp.accuracy_percent)::numeric as accuracy_percent,
      max(sp.completion_percent)::numeric as completion_percent,
      max(sp.last_active_at) as last_active_at
    from public.student_progress sp
    join assignment_row a on a.section_id = sp.section_id
    join recipients r on r.user_id = sp.user_id
    where sp.app_id = 'regents-algebra'
      and sp.course_id = 'algebra1'
    group by sp.user_id
  ),
  attempt_rows as (
    select
      qa.user_id,
      count(*)::bigint as attempt_count,
      count(*) filter (where qa.correct)::bigint as correct_count,
      max(qa.attempted_at) as last_attempt_at
    from public.question_attempts qa
    join assignment_row a on a.section_id = qa.section_id
    join recipients r on r.user_id = qa.user_id
    where qa.app_id = 'regents-algebra'
      and qa.course_id = 'algebra1'
    group by qa.user_id
  )
  select
    a.id as assignment_id,
    a.title::text as assignment_title,
    a.section_id::text as assignment_section_id,
    a.due_date as assignment_due_date,
    a.created_at as assignment_created_at,
    a.updated_at as assignment_updated_at,
    r.user_id,
    r.full_name,
    r.email,
    r.status::text as status,
    r.assigned_at,
    r.completed_at,
    coalesce(pr.questions_attempted, 0)::bigint as questions_attempted,
    coalesce(pr.questions_correct, 0)::bigint as questions_correct,
    coalesce(pr.completion_percent, 0)::numeric as completion_percent,
    case
      when coalesce(ar.attempt_count, 0) > 0 then
        round((coalesce(ar.correct_count, 0)::numeric / ar.attempt_count) * 100)
      else coalesce(pr.accuracy_percent, 0)
    end::numeric as accuracy_percent,
    coalesce(ar.attempt_count, 0)::bigint as attempt_count,
    coalesce(ar.correct_count, 0)::bigint as correct_count,
    (
      select max(last_activity)
      from (
        values
          (pr.last_active_at::timestamptz),
          (ar.last_attempt_at::timestamptz)
      ) as activity(last_activity)
    ) as last_activity_at
  from assignment_row a
  join recipients r on r.assignment_id = a.id
  left join progress_rows pr on pr.user_id = r.user_id
  left join attempt_rows ar on ar.user_id = r.user_id
  where exists (select 1 from authorized)
  order by r.full_name nulls last, r.email nulls last;
$$;

grant execute on function public.get_teacher_assignment_recipients(uuid, uuid) to authenticated;

commit;
