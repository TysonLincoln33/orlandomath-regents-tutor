-- Master Dashboard Phase M2 additive RPC
-- Read-only Regents Algebra 1 assignment oversight, master-approved users only.

create or replace function public.get_master_algebra1_assignments()
returns table (
  assignment_id uuid,
  classroom_id uuid,
  classroom_name text,
  teacher_id uuid,
  teacher_name text,
  teacher_email text,
  title text,
  description text,
  section_id text,
  due_date date,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz,
  recipient_count int,
  completed_count int,
  incomplete_count int,
  excused_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_approval text;
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  select role, approval_status into v_role, v_approval
  from public.profiles
  where id = v_uid;

  if v_role <> 'master' or v_approval <> 'approved' then
    raise exception 'Forbidden';
  end if;

  return query
  select
    a.id as assignment_id,
    a.classroom_id,
    c.name as classroom_name,
    c.teacher_id,
    tp.full_name as teacher_name,
    tp.email as teacher_email,
    a.title::text,
    a.description::text,
    a.section_id::text,
    a.due_date,
    a.created_at,
    a.updated_at,
    a.archived_at,
    count(ar.id)::int as recipient_count,
    count(ar.id) filter (where ar.status = 'completed')::int as completed_count,
    count(ar.id) filter (where ar.status = 'assigned')::int as incomplete_count,
    count(ar.id) filter (where ar.status = 'excused')::int as excused_count
  from public.assignments a
  join public.classrooms c on c.id = a.classroom_id
  join public.profiles tp on tp.id = c.teacher_id
  left join public.assignment_recipients ar
    on ar.assignment_id = a.id
   and ar.classroom_id = a.classroom_id
  where a.app_id = 'regents-algebra'
    and a.course_id = 'algebra1'
  group by a.id, c.id, tp.id
  order by a.created_at desc;
end;
$$;
