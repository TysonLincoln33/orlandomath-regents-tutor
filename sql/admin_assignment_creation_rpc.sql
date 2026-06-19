-- A3.5e Admin Assignment Creation
-- Transactional RPC for creating admin/master assignments, optional classroom
-- memberships, and assignment recipients atomically.

create or replace function public.create_admin_assignments(
  p_actor_id uuid,
  p_classroom_id uuid,
  p_title text,
  p_description text,
  p_due_date date,
  p_section_ids text[],
  p_target text,
  p_recipient_user_ids uuid[] default '{}'::uuid[],
  p_add_student_user_ids uuid[] default '{}'::uuid[]
)
returns table (
  id uuid,
  classroom_id uuid,
  title text,
  description text,
  due_date date,
  section_id text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz,
  recipient_count integer,
  classroom_membership_created_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles%rowtype;
  v_actor_domain text;
  v_classroom public.classrooms%rowtype;
  v_teacher_domain text;
  v_is_master boolean;
  v_recipient_count integer;
  v_created_membership_count integer := 0;
begin
  select * into v_actor
  from public.profiles
  where id = p_actor_id;

  if not found then
    raise exception 'Profile not found.' using errcode = 'P0001';
  end if;

  if v_actor.is_active is not true then
    raise exception 'Administrator account is inactive.' using errcode = 'P0001';
  end if;

  if v_actor.approval_status <> 'approved' or v_actor.role not in ('admin', 'master') then
    raise exception 'Administrator access requires an approved administrator account.' using errcode = 'P0001';
  end if;

  v_is_master := v_actor.role = 'master';
  v_actor_domain := coalesce(v_actor.email_domain, nullif(lower(split_part(v_actor.email, '@', 2)), ''));

  if not v_is_master and v_actor_domain is null then
    raise exception 'Administrator account is missing an email domain.' using errcode = 'P0001';
  end if;

  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'Assignment title is required.' using errcode = 'P0001';
  end if;

  if p_target not in ('class', 'students') then
    raise exception 'Assignment target must be class or students.' using errcode = 'P0001';
  end if;

  if coalesce(cardinality(p_section_ids), 0) = 0 then
    raise exception 'Please select at least one section.' using errcode = 'P0001';
  end if;

  if exists (select 1 from unnest(p_section_ids) as section_id where nullif(trim(section_id), '') is null) then
    raise exception 'Section ids must not be blank.' using errcode = 'P0001';
  end if;

  if (select count(*) from unnest(p_section_ids) as section_id) <> (select count(distinct section_id) from unnest(p_section_ids) as section_id) then
    raise exception 'Section ids must not contain duplicates.' using errcode = 'P0001';
  end if;

  if (select count(*) from unnest(coalesce(p_recipient_user_ids, '{}'::uuid[])) as user_id) <> (select count(distinct user_id) from unnest(coalesce(p_recipient_user_ids, '{}'::uuid[])) as user_id) then
    raise exception 'Selected recipients must not contain duplicates.' using errcode = 'P0001';
  end if;

  if (select count(*) from unnest(coalesce(p_add_student_user_ids, '{}'::uuid[])) as user_id) <> (select count(distinct user_id) from unnest(coalesce(p_add_student_user_ids, '{}'::uuid[])) as user_id) then
    raise exception 'Students to add must not contain duplicates.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_recipient_user_ids, '{}'::uuid[])) selected_user_id
    join unnest(coalesce(p_add_student_user_ids, '{}'::uuid[])) added_user_id
      on added_user_id = selected_user_id
  ) then
    raise exception 'Students cannot be both selected classroom recipients and add-to-class recipients.' using errcode = 'P0001';
  end if;

  select * into v_classroom
  from public.classrooms
  where id = p_classroom_id;

  if not found then
    raise exception 'Classroom not found.' using errcode = 'P0001';
  end if;

  if not v_is_master then
    select coalesce(p.email_domain, nullif(lower(split_part(p.email, '@', 2)), ''))
      into v_teacher_domain
    from public.profiles p
    where p.id = v_classroom.teacher_id
      and p.role = 'teacher';

    if v_teacher_domain is null or v_teacher_domain <> v_actor_domain then
      raise exception 'Classroom not found.' using errcode = 'P0001';
    end if;
  end if;

  if p_target = 'students' and coalesce(cardinality(p_recipient_user_ids), 0) = 0 and coalesce(cardinality(p_add_student_user_ids), 0) = 0 then
    raise exception 'Please select at least one student.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_recipient_user_ids, '{}'::uuid[])) selected_user_id
    left join public.classroom_members cm
      on cm.classroom_id = p_classroom_id
     and cm.user_id = selected_user_id
    where cm.id is null
  ) then
    raise exception 'Selected students must belong to this classroom.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_add_student_user_ids, '{}'::uuid[])) added_user_id
    join public.classroom_members cm
      on cm.classroom_id = p_classroom_id
     and cm.user_id = added_user_id
  ) then
    raise exception 'Add-to-class students are already in this classroom.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from (
      select cm.user_id
      from public.classroom_members cm
      where cm.classroom_id = p_classroom_id
        and p_target = 'class'
      union
      select selected_user_id
      from unnest(coalesce(p_recipient_user_ids, '{}'::uuid[])) selected_user_id
      union
      select added_user_id
      from unnest(coalesce(p_add_student_user_ids, '{}'::uuid[])) added_user_id
    ) recipients
    left join public.profiles p on p.id = recipients.user_id
    where p.id is null
       or p.role <> 'student'
       or p.is_active is not true
       or (not v_is_master and coalesce(p.email_domain, nullif(lower(split_part(p.email, '@', 2)), '')) <> v_actor_domain)
  ) then
    raise exception 'Recipients must be active in-scope student accounts.' using errcode = 'P0001';
  end if;

  with inserted_memberships as (
    insert into public.classroom_members (classroom_id, user_id, joined_via)
    select p_classroom_id, added_user_id, case when v_is_master then 'master_added' else 'admin_added' end
    from unnest(coalesce(p_add_student_user_ids, '{}'::uuid[])) added_user_id
    on conflict (classroom_id, user_id) do nothing
    returning id
  )
  select count(*) into v_created_membership_count
  from inserted_memberships;

  drop table if exists tmp_admin_assignment_created;

  create temporary table tmp_admin_assignment_created (
    id uuid,
    classroom_id uuid,
    title text,
    description text,
    due_date date,
    section_id text,
    created_by uuid,
    created_at timestamptz,
    updated_at timestamptz,
    archived_at timestamptz
  ) on commit drop;

  with inserted_assignments as (
    insert into public.assignments (
      classroom_id,
      title,
      description,
      due_date,
      section_id,
      created_by
    )
    select
      p_classroom_id,
      trim(p_title),
      nullif(trim(coalesce(p_description, '')), ''),
      p_due_date,
      section_id,
      p_actor_id
    from unnest(p_section_ids) section_id
    returning assignments.id,
      assignments.classroom_id,
      assignments.title,
      assignments.description,
      assignments.due_date,
      assignments.section_id,
      assignments.created_by,
      assignments.created_at,
      assignments.updated_at,
      assignments.archived_at
  )
  insert into tmp_admin_assignment_created
  select * from inserted_assignments;

  drop table if exists tmp_admin_assignment_recipients;

  create temporary table tmp_admin_assignment_recipients (user_id uuid primary key) on commit drop;

  insert into tmp_admin_assignment_recipients (user_id)
  select user_id
  from (
    select cm.user_id
    from public.classroom_members cm
    where cm.classroom_id = p_classroom_id
      and p_target = 'class'
    union
    select selected_user_id
    from unnest(coalesce(p_recipient_user_ids, '{}'::uuid[])) selected_user_id
    union
    select added_user_id
    from unnest(coalesce(p_add_student_user_ids, '{}'::uuid[])) added_user_id
  ) recipients;

  select count(*) into v_recipient_count from tmp_admin_assignment_recipients;

  if v_recipient_count = 0 then
    raise exception 'This classroom has no students to assign.' using errcode = 'P0001';
  end if;

  insert into public.assignment_recipients (
    assignment_id,
    classroom_id,
    user_id,
    assigned_by,
    status
  )
  select
    a.id,
    p_classroom_id,
    r.user_id,
    p_actor_id,
    'assigned'
  from tmp_admin_assignment_created a
  cross join tmp_admin_assignment_recipients r;

  return query
  select
    a.id,
    a.classroom_id,
    a.title,
    a.description,
    a.due_date,
    a.section_id,
    a.created_by,
    a.created_at,
    a.updated_at,
    a.archived_at,
    v_recipient_count,
    v_created_membership_count
  from tmp_admin_assignment_created a
  order by a.created_at, a.section_id;
end;
$$;

grant execute on function public.create_admin_assignments(uuid, uuid, text, text, date, text[], text, uuid[], uuid[]) to authenticated;
grant execute on function public.create_admin_assignments(uuid, uuid, text, text, date, text[], text, uuid[], uuid[]) to service_role;
