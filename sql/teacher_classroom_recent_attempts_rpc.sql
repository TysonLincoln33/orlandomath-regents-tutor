-- Teacher classroom recent attempts RPC for full-class activity feed.
-- Additive only.

begin;

create or replace function public.get_teacher_classroom_recent_attempts(p_classroom_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  chapter_id text,
  section_id text,
  question_id text,
  correct boolean,
  attempted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select p.role
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
  )
  select
    qa.user_id,
    r.full_name,
    r.email,
    qa.chapter_id::text,
    qa.section_id::text,
    qa.question_id::text,
    qa.correct,
    qa.attempted_at
  from public.question_attempts qa
  join roster r on r.user_id = qa.user_id
  where exists (select 1 from authorized)
    and qa.app_id = 'regents-algebra'
    and qa.course_id = 'algebra1'
  order by qa.attempted_at desc
  limit 100;
$$;

grant execute on function public.get_teacher_classroom_recent_attempts(uuid) to authenticated;

commit;
