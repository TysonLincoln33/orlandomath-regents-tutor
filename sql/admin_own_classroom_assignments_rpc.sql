-- Admin own-classroom chapter assignment creation.
-- Creates section assignment rows and recipient rows transactionally.
-- The admin classroom must already exist as public.classrooms.teacher_id = auth.uid().

begin;

create or replace function public.create_admin_own_classroom_section_assignments(
  p_title text,
  p_description text,
  p_due_date date,
  p_section_ids text[],
  p_student_user_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin public.profiles%rowtype;
  v_classroom public.classrooms%rowtype;
  v_classroom_count integer;
  v_section_ids text[];
  v_student_user_ids uuid[];
  v_admin_domain text;
  v_existing_membership_count integer;
  v_assignment_count integer;
  v_recipient_count integer;
  v_section_id text;
  v_inserted_assignment record;
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_admin
  from public.profiles
  where id = v_uid;

  if not found then
    raise exception 'Administrator profile not found';
  end if;

  if v_admin.role = 'master' then
    raise exception 'Master assignment creation is not supported for this workflow';
  end if;

  if v_admin.role <> 'admin' or v_admin.approval_status <> 'approved' then
    raise exception 'Approved administrator access required';
  end if;

  if v_admin.is_active is not true then
    raise exception 'Administrator account is inactive';
  end if;

  v_admin_domain := coalesce(nullif(v_admin.email_domain, ''), nullif(lower(split_part(v_admin.email, '@', 2)), ''));

  if v_admin_domain is null then
    raise exception 'Administrator account is missing an email domain';
  end if;

  v_section_ids := array(
    select distinct section_id
    from unnest(coalesce(p_section_ids, array[]::text[])) as section_id
    where nullif(trim(section_id), '') is not null
    order by section_id
  );

  v_student_user_ids := array(
    select distinct student_user_id
    from unnest(coalesce(p_student_user_ids, array[]::uuid[])) as student_user_id
    where student_user_id is not null
    order by student_user_id
  );

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Assignment title is required';
  end if;

  if coalesce(array_length(v_section_ids, 1), 0) = 0 then
    raise exception 'At least one section is required';
  end if;

  if coalesce(array_length(v_student_user_ids, 1), 0) = 0 then
    raise exception 'At least one student is required';
  end if;

  select count(*) into v_classroom_count
  from public.classrooms
  where teacher_id = v_uid
    and classroom_kind = 'admin_assignment';

  if v_classroom_count = 0 then
    raise exception 'Admin classroom is not configured. Please create an administrator classroom before creating assignments';
  end if;

  if v_classroom_count > 1 then
    raise exception 'Multiple admin classrooms are configured. Please resolve the duplicate classrooms before creating assignments';
  end if;

  select * into v_classroom
  from public.classrooms
  where teacher_id = v_uid
    and classroom_kind = 'admin_assignment'
  limit 1;

  if exists (
    select 1
    from unnest(v_student_user_ids) selected_students(student_user_id)
    left join public.profiles p on p.id = selected_students.student_user_id
    where p.id is null
      or p.role <> 'student'
      or p.is_active is not true
      or coalesce(nullif(p.email_domain, ''), nullif(lower(split_part(p.email, '@', 2)), '')) is distinct from v_admin_domain
  ) then
    raise exception 'Selected students must be active students in the administrator email domain';
  end if;

  select count(*) into v_existing_membership_count
  from public.classroom_members cm
  where cm.classroom_id = v_classroom.id
    and cm.user_id = any(v_student_user_ids);

  insert into public.classroom_members (classroom_id, user_id, joined_via)
  select v_classroom.id, student_user_id, 'admin_assignment'
  from unnest(v_student_user_ids) selected_students(student_user_id)
  on conflict (classroom_id, user_id) do nothing;

  create temporary table if not exists created_admin_assignments (
    id uuid not null,
    section_id text not null
  ) on commit drop;
  truncate table created_admin_assignments;

  foreach v_section_id in array v_section_ids loop
    insert into public.assignments (
      classroom_id,
      title,
      description,
      due_date,
      section_id,
      created_by
    )
    values (
      v_classroom.id,
      trim(p_title),
      nullif(trim(coalesce(p_description, '')), ''),
      p_due_date,
      v_section_id,
      v_uid
    )
    returning id, section_id into v_inserted_assignment;

    insert into created_admin_assignments (id, section_id)
    values (v_inserted_assignment.id, v_inserted_assignment.section_id);
  end loop;

  select count(*) into v_assignment_count from created_admin_assignments;

  insert into public.assignment_recipients (
    assignment_id,
    classroom_id,
    user_id,
    assigned_by,
    status
  )
  select
    ca.id,
    v_classroom.id,
    selected_students.student_user_id,
    v_uid,
    'assigned'
  from created_admin_assignments ca
  cross join unnest(v_student_user_ids) selected_students(student_user_id);

  get diagnostics v_recipient_count = row_count;

  return jsonb_build_object(
    'classroom', jsonb_build_object(
      'id', v_classroom.id,
      'name', v_classroom.name
    ),
    'assignmentCount', v_assignment_count,
    'recipientCount', v_recipient_count,
    'classroomMembershipsCreated',
      coalesce(array_length(v_student_user_ids, 1), 0) - v_existing_membership_count,
    'assignments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'classroom_id', a.classroom_id,
        'title', a.title,
        'description', a.description,
        'due_date', a.due_date,
        'section_id', a.section_id,
        'created_by', a.created_by,
        'created_at', a.created_at
      ) order by a.section_id), '[]'::jsonb)
      from public.assignments a
      join created_admin_assignments ca on ca.id = a.id
    )
  );
end;
$$;

grant execute on function public.create_admin_own_classroom_section_assignments(text, text, date, text[], uuid[]) to authenticated;

commit;
