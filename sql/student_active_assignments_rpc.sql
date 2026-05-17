-- Phase S1 student assignment display RPC.
-- Additive only: exposes the authenticated student's active assignment rows.

begin;

create or replace function public.get_student_active_assignments()
returns table (
  assignment_id uuid,
  classroom_id uuid,
  title text,
  description text,
  due_date date,
  section_id text,
  status text,
  assigned_at timestamptz,
  completion_percent numeric,
  is_complete boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with recipient_rows as (
    select
      ar.assignment_id,
      ar.classroom_id,
      ar.user_id,
      ar.status,
      ar.assigned_at,
      ar.completed_at
    from public.assignment_recipients ar
    where ar.user_id = auth.uid()
      and ar.status <> 'archived'
  ),
  assignment_rows as (
    select
      a.id,
      a.classroom_id,
      a.title,
      a.description,
      a.due_date,
      a.section_id
    from public.assignments a
    join recipient_rows r on r.assignment_id = a.id
    where a.archived_at is null
  ),
  progress_rows as (
    select
      sp.user_id,
      sp.section_id,
      max(sp.completion_percent)::numeric as completion_percent
    from public.student_progress sp
    join assignment_rows a on a.section_id = sp.section_id
    where sp.user_id = auth.uid()
      and sp.app_id = 'regents-algebra'
      and sp.course_id = 'algebra1'
    group by sp.user_id, sp.section_id
  )
  select
    a.id as assignment_id,
    a.classroom_id,
    a.title::text as title,
    a.description::text as description,
    a.due_date,
    a.section_id::text as section_id,
    r.status::text as status,
    r.assigned_at,
    coalesce(p.completion_percent, 0)::numeric as completion_percent,
    (
      r.completed_at is not null
      or r.status = 'completed'
      or coalesce(p.completion_percent, 0) >= 100
    ) as is_complete
  from recipient_rows r
  join assignment_rows a on a.id = r.assignment_id
  left join progress_rows p
    on p.user_id = r.user_id
   and p.section_id = a.section_id
  order by
    a.due_date nulls last,
    r.assigned_at desc,
    a.id;
$$;

grant execute on function public.get_student_active_assignments() to authenticated;

commit;
