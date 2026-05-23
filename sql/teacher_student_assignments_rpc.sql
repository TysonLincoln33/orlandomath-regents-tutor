begin;

create or replace function public.get_teacher_student_assignments(
  p_classroom_id uuid,
  p_student_user_id uuid
)
returns table (
  assignment_id uuid,
  title text,
  description text,
  section_id text,
  due_date date,
  assigned_at timestamptz,
  status text,
  archived_at timestamptz,
  completion_percent numeric,
  is_complete boolean
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
  roster_member as (
    select 1
    from public.classroom_members cm
    where cm.classroom_id = p_classroom_id
      and cm.user_id = p_student_user_id
  )
  select
    a.id as assignment_id,
    a.title::text as title,
    a.description::text as description,
    a.section_id::text as section_id,
    a.due_date as due_date,
    ar.assigned_at,
    ar.status::text as status,
    a.archived_at,
    coalesce(sp.completion_percent, 0)::numeric as completion_percent,
    coalesce(sp.is_complete, false) as is_complete
  from public.assignment_recipients ar
  join public.assignments a
    on a.id = ar.assignment_id
   and a.classroom_id = ar.classroom_id
  left join public.student_progress sp
    on sp.user_id = ar.user_id
   and sp.section_id = a.section_id
   and sp.app_id = 'regents-algebra'
   and sp.course_id = 'algebra1'
  where ar.classroom_id = p_classroom_id
    and ar.user_id = p_student_user_id
    and a.app_id = 'regents-algebra'
    and a.course_id = 'algebra1'
    and exists (select 1 from authorized)
    and exists (select 1 from roster_member)
  order by ar.assigned_at desc;
$$;

grant execute on function public.get_teacher_student_assignments(uuid, uuid) to authenticated;

commit;
