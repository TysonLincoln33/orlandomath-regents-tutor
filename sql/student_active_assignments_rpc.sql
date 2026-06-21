begin;

create or replace function public.get_student_active_assignments()
returns table (
  classroom_id uuid,
  classroom_name text,
  teacher_name text,
  teacher_email text,
  assignment_id uuid,
  title text,
  description text,
  section_id text,
  due_date date,
  assigned_at timestamptz,
  status text,
  completion_percent numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with student_classes as (
    select
      c.id as classroom_id,
      c.name::text as classroom_name,
      tp.full_name::text as teacher_name,
      tp.email::text as teacher_email
    from public.classroom_members cm
    join public.classrooms c
      on c.id = cm.classroom_id
    left join public.profiles tp
      on tp.id = c.teacher_id
    where cm.user_id = auth.uid()
  ),
  active_assignments as (
    select
      ar.classroom_id,
      a.id as assignment_id,
      a.title::text as title,
      a.description::text as description,
      a.section_id::text as section_id,
      a.due_date,
      ar.assigned_at,
      ar.status::text as status,
      sp.completion_percent::numeric as completion_percent
    from public.assignment_recipients ar
    join public.assignments a
      on a.id = ar.assignment_id
     and a.classroom_id = ar.classroom_id
    left join public.student_progress sp
      on sp.user_id = ar.user_id
     and sp.section_id = a.section_id
     and sp.app_id = 'regents-algebra'
     and sp.course_id = 'algebra1'
    where ar.user_id = auth.uid()
      and ar.status in ('assigned', 'completed')
      and a.archived_at is null
      and a.section_id ~ '^ch[0-9]+_s[0-9]+$'
  )
  select
    sc.classroom_id,
    sc.classroom_name,
    sc.teacher_name,
    sc.teacher_email,
    aa.assignment_id,
    aa.title,
    aa.description,
    aa.section_id,
    aa.due_date,
    aa.assigned_at,
    aa.status,
    aa.completion_percent
  from student_classes sc
  left join active_assignments aa
    on aa.classroom_id = sc.classroom_id
  order by sc.classroom_name asc, aa.due_date asc nulls last, aa.assigned_at desc nulls last;
$$;

grant execute on function public.get_student_active_assignments() to authenticated;

commit;
