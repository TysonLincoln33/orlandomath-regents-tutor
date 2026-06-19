-- Admin own-classroom setup.
-- Creates at most one admin classroom for an approved admin when explicitly requested.

begin;

create or replace function public.create_admin_own_classroom()
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
  v_class_code text;
  v_term text;
  v_created boolean := false;
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  perform pg_advisory_xact_lock(hashtext('admin_own_classroom:' || v_uid::text));

  select * into v_admin
  from public.profiles
  where id = v_uid;

  if not found then
    raise exception 'Administrator profile not found';
  end if;

  if v_admin.role = 'master' then
    raise exception 'Master classroom setup is not supported for this workflow';
  end if;

  if v_admin.role <> 'admin' or v_admin.approval_status <> 'approved' then
    raise exception 'Approved administrator access required';
  end if;

  if v_admin.is_active is not true then
    raise exception 'Administrator account is inactive';
  end if;

  select count(*) into v_classroom_count
  from public.classrooms
  where teacher_id = v_uid;

  if v_classroom_count > 1 then
    raise exception 'Multiple admin classrooms are configured for this administrator';
  end if;

  if v_classroom_count = 1 then
    select * into v_classroom
    from public.classrooms
    where teacher_id = v_uid
    limit 1;
  else
    v_term := case
      when extract(month from now()) >= 7 then
        extract(year from now())::int::text || '-' || (extract(year from now())::int + 1)::text
      else
        (extract(year from now())::int - 1)::text || '-' || extract(year from now())::int::text
    end;

    loop
      v_class_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit when not exists (
        select 1 from public.classrooms where class_code = v_class_code
      );
    end loop;

    insert into public.classrooms (
      teacher_id,
      name,
      subject,
      term,
      class_code
    ) values (
      v_uid,
      'Admin Classroom',
      'Algebra 1',
      v_term,
      v_class_code
    )
    returning * into v_classroom;

    v_created := true;
  end if;

  return jsonb_build_object(
    'created', v_created,
    'classroom', jsonb_build_object(
      'id', v_classroom.id,
      'teacher_id', v_classroom.teacher_id,
      'name', v_classroom.name,
      'subject', v_classroom.subject,
      'term', v_classroom.term,
      'class_code', v_classroom.class_code,
      'created_at', v_classroom.created_at
    )
  );
end;
$$;

grant execute on function public.create_admin_own_classroom() to authenticated;

commit;
