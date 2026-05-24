-- Master Dashboard Phase M1 additive RPCs
-- Read-only Regents Algebra 1 scope, master-approved users only.

create or replace function public.get_master_algebra1_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_approval text;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  select role, approval_status into v_role, v_approval from public.profiles where id = v_uid;
  if v_role <> 'master' or v_approval <> 'approved' then
    raise exception 'Forbidden';
  end if;

  return jsonb_build_object(
    'summary', (
      select jsonb_agg(s) from (
        select
          count(*)::int as total_users_with_activity,
          count(*) filter (where last_activity_at >= v_now - interval '10 minutes')::int as active_now,
          coalesce(round(avg(completion_percent)), 0)::int as avg_completion_percent,
          coalesce(round(avg(accuracy_percent)), 0)::int as avg_accuracy_percent,
          coalesce(sum(attempts_count), 0)::int as total_attempts,
          coalesce(sum(correct_count), 0)::int as total_correct
        from public.get_master_algebra1_user_progress_rows()
      ) s
    ),
    'users', (
      select coalesce(jsonb_agg(u order by u.last_activity_at desc), '[]'::jsonb)
      from public.get_master_algebra1_user_progress_rows() u
    )
  );
end;
$$;

create or replace function public.get_master_algebra1_recent_attempts()
returns table (
  user_id uuid,
  full_name text,
  email text,
  section_id text,
  question_id text,
  correct boolean,
  attempted_at timestamptz
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
  if v_uid is null then raise exception 'Unauthorized'; end if;
  select role, approval_status into v_role, v_approval from public.profiles where id = v_uid;
  if v_role <> 'master' or v_approval <> 'approved' then raise exception 'Forbidden'; end if;

  return query
  select qa.user_id, p.full_name, p.email, qa.section_id, qa.question_id, qa.correct, qa.attempted_at
  from public.question_attempts qa
  join public.profiles p on p.id = qa.user_id
  where qa.app_id = 'regents-algebra'
    and qa.course_id = 'algebra1'
  order by qa.attempted_at desc
  limit 100;
end;
$$;

create or replace function public.get_master_algebra1_user_progress(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_approval text;
begin
  if v_uid is null then raise exception 'Unauthorized'; end if;
  select role, approval_status into v_role, v_approval from public.profiles where id = v_uid;
  if v_role <> 'master' or v_approval <> 'approved' then raise exception 'Forbidden'; end if;

  return jsonb_build_object(
    'user', (
      select coalesce(jsonb_agg(u), '[]'::jsonb)
      from public.get_master_algebra1_user_progress_rows() u
      where u.user_id = p_user_id
    ),
    'recent_attempts', (
      select coalesce(jsonb_agg(t order by t.attempted_at desc), '[]'::jsonb)
      from (
        select qa.user_id, p.full_name, p.email, qa.section_id, qa.question_id, qa.correct, qa.attempted_at
        from public.question_attempts qa
        join public.profiles p on p.id = qa.user_id
        where qa.app_id = 'regents-algebra' and qa.course_id = 'algebra1' and qa.user_id = p_user_id
        order by qa.attempted_at desc
        limit 50
      ) t
    )
  );
end;
$$;

create or replace function public.get_master_algebra1_user_progress_rows()
returns table (
  user_id uuid,
  full_name text,
  email text,
  role text,
  completion_percent int,
  accuracy_percent int,
  attempts_count int,
  correct_count int,
  last_activity_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with progress_summary as (
    select sp.user_id,
      coalesce(round(avg(sp.completion_percent)), 0)::int as completion_percent,
      max(sp.last_active_at) as progress_last_active
    from public.student_progress sp
    where sp.app_id = 'regents-algebra' and sp.course_id = 'algebra1'
    group by sp.user_id
  ),
  attempt_summary as (
    select qa.user_id,
      count(*)::int as attempts_count,
      count(*) filter (where qa.correct)::int as correct_count,
      max(qa.attempted_at) as attempt_last_active
    from public.question_attempts qa
    where qa.app_id = 'regents-algebra' and qa.course_id = 'algebra1'
    group by qa.user_id
  ),
  users as (
    select user_id from progress_summary
    union
    select user_id from attempt_summary
  )
  select u.user_id, p.full_name, p.email, p.role,
    coalesce(ps.completion_percent, 0) as completion_percent,
    case when coalesce(a.attempts_count, 0) > 0 then round((a.correct_count::numeric / a.attempts_count) * 100)::int else 0 end as accuracy_percent,
    coalesce(a.attempts_count, 0) as attempts_count,
    coalesce(a.correct_count, 0) as correct_count,
    greatest(coalesce(ps.progress_last_active, to_timestamp(0)), coalesce(a.attempt_last_active, to_timestamp(0))) as last_activity_at
  from users u
  join public.profiles p on p.id = u.user_id
  left join progress_summary ps on ps.user_id = u.user_id
  left join attempt_summary a on a.user_id = u.user_id;
$$;
