


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_master_algebra1_assignments"() RETURNS TABLE("assignment_id" "uuid", "classroom_id" "uuid", "classroom_name" "text", "teacher_id" "uuid", "teacher_name" "text", "teacher_email" "text", "title" "text", "description" "text", "section_id" "text", "due_date" "date", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "archived_at" timestamp with time zone, "recipient_count" integer, "completed_count" integer, "incomplete_count" integer, "excused_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_master_algebra1_assignments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_master_algebra1_overview"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_master_algebra1_overview"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_master_algebra1_recent_attempts"() RETURNS TABLE("user_id" "uuid", "full_name" "text", "email" "text", "section_id" "text", "question_id" "text", "correct" boolean, "attempted_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_master_algebra1_recent_attempts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_master_algebra1_user_progress"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_master_algebra1_user_progress"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_master_algebra1_user_progress_rows"() RETURNS TABLE("user_id" "uuid", "full_name" "text", "email" "text", "role" "text", "completion_percent" integer, "accuracy_percent" integer, "attempts_count" integer, "correct_count" integer, "last_activity_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_master_algebra1_user_progress_rows"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_teacher_assignment_recipients"("p_classroom_id" "uuid", "p_assignment_id" "uuid") RETURNS TABLE("assignment_id" "uuid", "assignment_title" "text", "assignment_section_id" "text", "assignment_due_date" "date", "assignment_created_at" timestamp with time zone, "assignment_updated_at" timestamp with time zone, "user_id" "uuid", "full_name" "text", "email" "text", "status" "text", "assigned_at" timestamp with time zone, "completed_at" timestamp with time zone, "questions_attempted" bigint, "questions_correct" bigint, "completion_percent" numeric, "accuracy_percent" numeric, "attempt_count" bigint, "correct_count" bigint, "last_activity_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_teacher_assignment_recipients"("p_classroom_id" "uuid", "p_assignment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_teacher_classroom_progress"("p_classroom_id" "uuid") RETURNS TABLE("user_id" "uuid", "full_name" "text", "email" "text", "chapter_id" "text", "section_id" "text", "questions_attempted" bigint, "questions_correct" bigint, "accuracy_percent" numeric, "completion_percent" numeric, "last_active_at" timestamp with time zone, "attempt_count" bigint, "correct_count" bigint, "last_attempt_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with authorized as (
    select 1
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
  ),
  progress_rows as (
    select
      sp.user_id,
      sp.chapter_id,
      sp.section_id,
      max(sp.questions_attempted)::bigint as questions_attempted,
      max(sp.questions_correct)::bigint as questions_correct,
      max(sp.accuracy_percent)::numeric as accuracy_percent,
      max(sp.completion_percent)::numeric as completion_percent,
      max(sp.last_active_at) as last_active_at
    from public.student_progress sp
    join roster r on r.user_id = sp.user_id
    where sp.app_id = 'regents-algebra'
      and sp.course_id = 'algebra1'
    group by sp.user_id, sp.chapter_id, sp.section_id
  ),
  attempt_rows as (
    select
      qa.user_id,
      qa.chapter_id,
      qa.section_id,
      count(*)::bigint as attempt_count,
      count(*) filter (where qa.correct)::bigint as correct_count,
      max(qa.attempted_at) as last_attempt_at
    from public.question_attempts qa
    join roster r on r.user_id = qa.user_id
    where qa.app_id = 'regents-algebra'
      and qa.course_id = 'algebra1'
    group by qa.user_id, qa.chapter_id, qa.section_id
  ),
  activity_keys as (
    select pr.user_id, pr.chapter_id, pr.section_id from progress_rows pr
    union
    select ar.user_id, ar.chapter_id, ar.section_id from attempt_rows ar
  )
  select
    r.user_id,
    r.full_name,
    r.email,
    coalesce(k.chapter_id, pr.chapter_id, ar.chapter_id)::text as chapter_id,
    coalesce(k.section_id, pr.section_id, ar.section_id)::text as section_id,
    coalesce(pr.questions_attempted, 0)::bigint as questions_attempted,
    coalesce(pr.questions_correct, 0)::bigint as questions_correct,
    coalesce(pr.accuracy_percent, 0)::numeric as accuracy_percent,
    coalesce(pr.completion_percent, 0)::numeric as completion_percent,
    pr.last_active_at,
    coalesce(ar.attempt_count, 0)::bigint as attempt_count,
    coalesce(ar.correct_count, 0)::bigint as correct_count,
    ar.last_attempt_at
  from activity_keys k
  join roster r on r.user_id = k.user_id
  left join progress_rows pr
    on pr.user_id = k.user_id
   and pr.section_id = k.section_id
  left join attempt_rows ar
    on ar.user_id = k.user_id
   and ar.section_id = k.section_id
  where exists (select 1 from authorized)
  order by r.full_name nulls last, r.email nulls last, section_id;
$$;


ALTER FUNCTION "public"."get_teacher_classroom_progress"("p_classroom_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_teacher_classroom_recent_attempts"("p_classroom_id" "uuid") RETURNS TABLE("user_id" "uuid", "full_name" "text", "email" "text", "chapter_id" "text", "section_id" "text", "question_id" "text", "correct" boolean, "attempted_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_teacher_classroom_recent_attempts"("p_classroom_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_teacher_classroom_student_progress"("p_classroom_id" "uuid", "p_student_user_id" "uuid") RETURNS TABLE("user_id" "uuid", "full_name" "text", "email" "text", "chapter_id" "text", "section_id" "text", "questions_attempted" bigint, "questions_correct" bigint, "accuracy_percent" numeric, "completion_percent" numeric, "last_active_at" timestamp with time zone, "attempt_count" bigint, "correct_count" bigint, "last_attempt_at" timestamp with time zone, "recent_attempts" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with authorized as (
    select 1
    from public.classrooms c
    join public.profiles p on p.id = auth.uid()
    where c.id = p_classroom_id
      and p.role in ('teacher', 'master')
      and (c.teacher_id = auth.uid() or p.role = 'master')
  ),
  requested_student as (
    select
      cm.user_id,
      p.full_name::text as full_name,
      p.email::text as email
    from public.classroom_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.classroom_id = p_classroom_id
      and cm.user_id = p_student_user_id
  ),
  progress_rows as (
    select
      sp.user_id,
      sp.chapter_id,
      sp.section_id,
      max(sp.questions_attempted)::bigint as questions_attempted,
      max(sp.questions_correct)::bigint as questions_correct,
      max(sp.accuracy_percent)::numeric as accuracy_percent,
      max(sp.completion_percent)::numeric as completion_percent,
      max(sp.last_active_at) as last_active_at
    from public.student_progress sp
    join requested_student rs on rs.user_id = sp.user_id
    where sp.app_id = 'regents-algebra'
      and sp.course_id = 'algebra1'
    group by sp.user_id, sp.chapter_id, sp.section_id
  ),
  attempt_rows as (
    select
      qa.user_id,
      qa.chapter_id,
      qa.section_id,
      count(*)::bigint as attempt_count,
      count(*) filter (where qa.correct)::bigint as correct_count,
      max(qa.attempted_at) as last_attempt_at,
      jsonb_agg(
        jsonb_build_object(
          'question_id', qa.question_id,
          'selected_answer', qa.selected_answer,
          'correct', qa.correct,
          'attempted_at', qa.attempted_at
        )
        order by qa.attempted_at desc
      ) filter (where qa.id is not null) as recent_attempts
    from public.question_attempts qa
    join requested_student rs on rs.user_id = qa.user_id
    where qa.app_id = 'regents-algebra'
      and qa.course_id = 'algebra1'
    group by qa.user_id, qa.chapter_id, qa.section_id
  ),
  activity_keys as (
    select pr.user_id, pr.chapter_id, pr.section_id from progress_rows pr
    union
    select ar.user_id, ar.chapter_id, ar.section_id from attempt_rows ar
  )
  select
    rs.user_id,
    rs.full_name,
    rs.email,
    coalesce(k.chapter_id, pr.chapter_id, ar.chapter_id)::text as chapter_id,
    coalesce(k.section_id, pr.section_id, ar.section_id)::text as section_id,
    coalesce(pr.questions_attempted, 0)::bigint as questions_attempted,
    coalesce(pr.questions_correct, 0)::bigint as questions_correct,
    coalesce(pr.accuracy_percent, 0)::numeric as accuracy_percent,
    coalesce(pr.completion_percent, 0)::numeric as completion_percent,
    pr.last_active_at,
    coalesce(ar.attempt_count, 0)::bigint as attempt_count,
    coalesce(ar.correct_count, 0)::bigint as correct_count,
    ar.last_attempt_at,
    coalesce(ar.recent_attempts, '[]'::jsonb) as recent_attempts
  from activity_keys k
  join requested_student rs on rs.user_id = k.user_id
  left join progress_rows pr
    on pr.user_id = k.user_id
   and pr.section_id = k.section_id
  left join attempt_rows ar
    on ar.user_id = k.user_id
   and ar.section_id = k.section_id
  where exists (select 1 from authorized)
  order by section_id;
$$;


ALTER FUNCTION "public"."get_teacher_classroom_student_progress"("p_classroom_id" "uuid", "p_student_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  requested_role_value text;
begin
  requested_role_value := coalesce(new.raw_user_meta_data->>'requested_role', 'student');

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    requested_role,
    approval_status,
    is_independent
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when requested_role_value = 'teacher' then 'student'
      else requested_role_value
    end,
    requested_role_value,
    case
      when requested_role_value = 'teacher' then 'pending'
      else 'approved'
    end,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_classroom_by_code"("p_class_code" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_classroom_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'User must be authenticated';
  end if;

  select id
  into v_classroom_id
  from public.classrooms
  where upper(class_code) = upper(trim(p_class_code));

  if v_classroom_id is null then
    raise exception 'Invalid class code';
  end if;

  insert into public.classroom_members (
    classroom_id,
    user_id,
    joined_via
  )
  values (
    v_classroom_id,
    v_user_id,
    'class_code'
  )
  on conflict (classroom_id, user_id) do nothing;

  return v_classroom_id;
end;
$$;


ALTER FUNCTION "public"."join_classroom_by_code"("p_class_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_daily_lesson_attempt"("p_lesson_id" "text", "p_section_id" "text", "p_question_id" "text", "p_selected_answer" "text", "p_correct" boolean, "p_section_total_questions" integer, "p_course_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_attempted integer;
  v_correct integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'User must be logged in to save progress.';
  end if;

  insert into public.question_attempts (
    user_id,
    app_id,
    lesson_id,
    course_id,
    chapter_id,
    section_id,
    question_id,
    selected_answer,
    correct,
    attempted_at
  )
  values (
    v_user_id,
    'daily-lessons',
    p_lesson_id,
    p_course_id,
    p_lesson_id,
    p_section_id,
    p_question_id,
    p_selected_answer,
    p_correct,
    now()
  );

  select
    count(distinct question_id),
    count(distinct question_id) filter (where correct = true)
  into v_attempted, v_correct
  from public.question_attempts
  where user_id = v_user_id
    and app_id = 'daily-lessons'
    and lesson_id = p_lesson_id
    and section_id = p_section_id;

  insert into public.student_progress (
    user_id,
    app_id,
    lesson_id,
    course_id,
    chapter_id,
    section_id,
    questions_attempted,
    questions_correct,
    completion_percent,
    accuracy_percent,
    last_active_at,
    updated_at
  )
  values (
    v_user_id,
    'daily-lessons',
    p_lesson_id,
    p_course_id,
    p_lesson_id,
    p_section_id,
    v_attempted,
    v_correct,
    least(100, round((v_attempted::numeric / greatest(p_section_total_questions, 1)) * 100, 2)),
    case when v_attempted = 0 then 0 else round((v_correct::numeric / v_attempted::numeric) * 100, 2) end,
    now(),
    now()
  )
  on conflict (user_id, course_id, chapter_id, section_id)
  do update set
    app_id = excluded.app_id,
    lesson_id = excluded.lesson_id,
    questions_attempted = excluded.questions_attempted,
    questions_correct = excluded.questions_correct,
    completion_percent = excluded.completion_percent,
    accuracy_percent = excluded.accuracy_percent,
    last_active_at = now(),
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."record_daily_lesson_attempt"("p_lesson_id" "text", "p_section_id" "text", "p_question_id" "text", "p_selected_answer" "text", "p_correct" boolean, "p_section_total_questions" integer, "p_course_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_question_attempt_and_update_progress"("p_course_id" "text", "p_chapter_id" "text", "p_section_id" "text", "p_question_id" "text", "p_selected_answer" "text", "p_correct" boolean, "p_section_total_questions" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'User must be authenticated';
  end if;

  if p_section_total_questions is null or p_section_total_questions <= 0 then
    raise exception 'p_section_total_questions must be greater than 0';
  end if;

  insert into public.question_attempts (
    user_id,
    course_id,
    chapter_id,
    section_id,
    question_id,
    selected_answer,
    correct
  )
  values (
    v_user_id,
    p_course_id,
    p_chapter_id,
    p_section_id,
    p_question_id,
    p_selected_answer,
    p_correct
  );

  insert into public.student_progress (
    user_id,
    course_id,
    chapter_id,
    section_id,
    questions_attempted,
    questions_correct,
    accuracy_percent,
    completion_percent,
    last_active_at
  )
  with latest_per_question as (
    select distinct on (qa.question_id)
      qa.question_id,
      qa.correct
    from public.question_attempts qa
    where qa.user_id = v_user_id
      and qa.course_id = p_course_id
      and qa.chapter_id = p_chapter_id
      and qa.section_id = p_section_id
    order by qa.question_id, qa.attempted_at desc
  ),
  agg as (
    select
      count(*)::int as questions_attempted,
      count(*) filter (where correct = true)::int as questions_correct
    from latest_per_question
  )
  select
    v_user_id,
    p_course_id,
    p_chapter_id,
    p_section_id,
    agg.questions_attempted,
    agg.questions_correct,
    case
      when agg.questions_attempted = 0 then 0
      else round((agg.questions_correct::numeric / agg.questions_attempted::numeric) * 100, 2)
    end as accuracy_percent,
    least(
      100,
      round((agg.questions_correct::numeric / p_section_total_questions::numeric) * 100, 2)
    ) as completion_percent,
    timezone('utc', now()) as last_active_at
  from agg
  on conflict (user_id, course_id, chapter_id, section_id)
  do update set
    questions_attempted = excluded.questions_attempted,
    questions_correct = excluded.questions_correct,
    accuracy_percent = excluded.accuracy_percent,
    completion_percent = excluded.completion_percent,
    last_active_at = excluded.last_active_at,
    updated_at = timezone('utc', now());
end;
$$;


ALTER FUNCTION "public"."record_question_attempt_and_update_progress"("p_course_id" "text", "p_chapter_id" "text", "p_section_id" "text", "p_question_id" "text", "p_selected_answer" "text", "p_correct" boolean, "p_section_total_questions" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."assignment_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_by" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    CONSTRAINT "assignment_recipients_status_check" CHECK (("status" = ANY (ARRAY['assigned'::"text", 'completed'::"text", 'excused'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."assignment_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "due_date" "date",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "section_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classroom_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "classroom_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_via" "text" DEFAULT 'class_code'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."classroom_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classrooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "subject" "text",
    "term" "text",
    "class_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."classrooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_lessons" (
    "lesson_id" "text" NOT NULL,
    "lesson_title" "text",
    "total_questions" integer NOT NULL
);


ALTER TABLE "public"."daily_lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "username" "text",
    "full_name" "text",
    "role" "text" DEFAULT 'student'::"text" NOT NULL,
    "is_independent" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requested_role" "text" DEFAULT 'student'::"text" NOT NULL,
    "approval_status" "text" DEFAULT 'approved'::"text" NOT NULL,
    CONSTRAINT "profiles_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'denied'::"text"]))),
    CONSTRAINT "profiles_requested_role_check" CHECK (("requested_role" = ANY (ARRAY['student'::"text", 'teacher'::"text", 'admin'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'teacher'::"text", 'admin'::"text", 'master'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "text" DEFAULT 'algebra-1'::"text" NOT NULL,
    "chapter_id" "text" NOT NULL,
    "section_id" "text" NOT NULL,
    "completion_percent" numeric DEFAULT 0 NOT NULL,
    "accuracy_percent" numeric DEFAULT 0 NOT NULL,
    "last_active_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "questions_attempted" integer DEFAULT 0 NOT NULL,
    "questions_correct" integer DEFAULT 0 NOT NULL,
    "app_id" "text" DEFAULT 'regents-algebra'::"text" NOT NULL,
    "lesson_id" "text",
    CONSTRAINT "student_progress_accuracy_range" CHECK ((("accuracy_percent" >= (0)::numeric) AND ("accuracy_percent" <= (100)::numeric))),
    CONSTRAINT "student_progress_attempted_nonnegative" CHECK (("questions_attempted" >= 0)),
    CONSTRAINT "student_progress_completion_range" CHECK ((("completion_percent" >= (0)::numeric) AND ("completion_percent" <= (100)::numeric))),
    CONSTRAINT "student_progress_correct_lte_attempted" CHECK (("questions_correct" <= "questions_attempted")),
    CONSTRAINT "student_progress_correct_nonnegative" CHECK (("questions_correct" >= 0))
);


ALTER TABLE "public"."student_progress" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."daily_lesson_summary" AS
 SELECT "sp"."user_id",
    "p"."full_name",
    "p"."email",
    "sp"."lesson_id",
    "sum"("sp"."questions_attempted") AS "total_attempted",
    "sum"("sp"."questions_correct") AS "total_correct",
    "dl"."total_questions",
    "round"(((("sum"("sp"."questions_attempted"))::numeric / (GREATEST("dl"."total_questions", 1))::numeric) * (100)::numeric), 2) AS "progress_percent",
        CASE
            WHEN ("sum"("sp"."questions_attempted") = 0) THEN (0)::numeric
            ELSE "round"(((("sum"("sp"."questions_correct"))::numeric / ("sum"("sp"."questions_attempted"))::numeric) * (100)::numeric), 2)
        END AS "accuracy_percent",
    "max"("sp"."last_active_at") AS "last_active_at"
   FROM (("public"."student_progress" "sp"
     LEFT JOIN "public"."profiles" "p" ON (("sp"."user_id" = "p"."id")))
     LEFT JOIN "public"."daily_lessons" "dl" ON (("sp"."lesson_id" = "dl"."lesson_id")))
  WHERE ("sp"."app_id" = 'daily-lessons'::"text")
  GROUP BY "sp"."user_id", "p"."full_name", "p"."email", "sp"."lesson_id", "dl"."total_questions";


ALTER VIEW "public"."daily_lesson_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "course_id" "text" DEFAULT 'algebra-1'::"text" NOT NULL,
    "chapter_id" "text" NOT NULL,
    "section_id" "text" NOT NULL,
    "question_id" "text" NOT NULL,
    "selected_answer" "text",
    "correct" boolean NOT NULL,
    "attempted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "app_id" "text" DEFAULT 'regents-algebra'::"text" NOT NULL,
    "lesson_id" "text"
);


ALTER TABLE "public"."question_attempts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."master_student_summary" AS
 WITH "scoped_progress" AS (
         SELECT "student_progress"."user_id",
            "student_progress"."completion_percent",
            "student_progress"."accuracy_percent",
            "student_progress"."last_active_at"
           FROM "public"."student_progress"
          WHERE (("student_progress"."app_id" = 'regents-algebra'::"text") AND ("student_progress"."course_id" = 'algebra1'::"text"))
        ), "progress_summary" AS (
         SELECT "scoped_progress"."user_id",
            "avg"("scoped_progress"."completion_percent") AS "completion",
            "avg"("scoped_progress"."accuracy_percent") AS "progress_accuracy",
            "max"("scoped_progress"."last_active_at") AS "progress_last_active"
           FROM "scoped_progress"
          GROUP BY "scoped_progress"."user_id"
        ), "scoped_attempts" AS (
         SELECT "question_attempts"."user_id",
            "question_attempts"."correct",
            "question_attempts"."attempted_at"
           FROM "public"."question_attempts"
          WHERE (("question_attempts"."app_id" = 'regents-algebra'::"text") AND ("question_attempts"."course_id" = 'algebra1'::"text"))
        ), "attempt_summary" AS (
         SELECT "scoped_attempts"."user_id",
            "count"(*) AS "attempts",
            "count"(*) FILTER (WHERE "scoped_attempts"."correct") AS "correct",
            "max"("scoped_attempts"."attempted_at") AS "attempt_last_active"
           FROM "scoped_attempts"
          GROUP BY "scoped_attempts"."user_id"
        ), "scoped_users" AS (
         SELECT "progress_summary_1"."user_id"
           FROM "progress_summary" "progress_summary_1"
        UNION
         SELECT "attempt_summary_1"."user_id"
           FROM "attempt_summary" "attempt_summary_1"
        )
 SELECT "scoped_users"."user_id",
    "profiles"."full_name",
    "profiles"."email",
    COALESCE("round"("progress_summary"."completion"), (0)::numeric) AS "completion",
        CASE
            WHEN (COALESCE("attempt_summary"."attempts", (0)::bigint) > 0) THEN "round"((((COALESCE("attempt_summary"."correct", (0)::bigint))::numeric / ("attempt_summary"."attempts")::numeric) * (100)::numeric))
            ELSE COALESCE("round"("progress_summary"."progress_accuracy"), (0)::numeric)
        END AS "accuracy",
    COALESCE("attempt_summary"."attempts", (0)::bigint) AS "attempts",
    COALESCE("attempt_summary"."correct", (0)::bigint) AS "correct",
    ( SELECT "max"("activity"."last_active") AS "max"
           FROM ( VALUES ("progress_summary"."progress_last_active"), ("attempt_summary"."attempt_last_active")) "activity"("last_active")) AS "last_active"
   FROM ((("scoped_users"
     JOIN "public"."profiles" ON (("profiles"."id" = "scoped_users"."user_id")))
     LEFT JOIN "progress_summary" ON (("progress_summary"."user_id" = "scoped_users"."user_id")))
     LEFT JOIN "attempt_summary" ON (("attempt_summary"."user_id" = "scoped_users"."user_id")));


ALTER VIEW "public"."master_student_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."progress_saves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "goal" "text",
    "test_date" "date",
    "progress_json" "jsonb" NOT NULL,
    "resume_token" "text" NOT NULL
);


ALTER TABLE "public"."progress_saves" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."teacher_classroom_progress_summary" WITH ("security_invoker"='true') AS
 WITH "roster" AS (
         SELECT "cm"."classroom_id",
            "cm"."user_id",
            "p"."full_name",
            "p"."email"
           FROM ("public"."classroom_members" "cm"
             LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "cm"."user_id")))
        ), "progress_agg" AS (
         SELECT "sp"."user_id",
            ("count"(*))::integer AS "sections_started",
            "round"("avg"("sp"."completion_percent"), 1) AS "avg_progress",
            "round"("avg"("sp"."accuracy_percent"), 1) AS "avg_section_accuracy",
            "max"("sp"."last_active_at") AS "last_progress_activity"
           FROM "public"."student_progress" "sp"
          GROUP BY "sp"."user_id"
        ), "attempt_agg" AS (
         SELECT "qa"."user_id",
            ("count"(*))::integer AS "total_attempts",
            ("count"(*) FILTER (WHERE ("qa"."correct" = true)))::integer AS "total_correct",
                CASE
                    WHEN ("count"(*) = 0) THEN (0)::numeric
                    ELSE "round"(((("count"(*) FILTER (WHERE ("qa"."correct" = true)))::numeric / ("count"(*))::numeric) * (100)::numeric), 1)
                END AS "true_attempt_accuracy",
            "max"("qa"."attempted_at") AS "last_attempt_activity"
           FROM "public"."question_attempts" "qa"
          GROUP BY "qa"."user_id"
        )
 SELECT "r"."classroom_id",
    "r"."user_id",
    COALESCE("r"."full_name", ''::"text") AS "full_name",
    COALESCE("r"."email", ''::"text") AS "email",
    COALESCE("pa"."sections_started", 0) AS "sections_started",
    COALESCE("pa"."avg_progress", (0)::numeric) AS "avg_progress",
    COALESCE("pa"."avg_section_accuracy", (0)::numeric) AS "avg_section_accuracy",
    COALESCE("aa"."total_attempts", 0) AS "total_attempts",
    COALESCE("aa"."total_correct", 0) AS "total_correct",
    COALESCE("aa"."true_attempt_accuracy", (0)::numeric) AS "true_attempt_accuracy",
    GREATEST(COALESCE("pa"."last_progress_activity", '1970-01-01 00:00:00+00'::timestamp with time zone), COALESCE("aa"."last_attempt_activity", '1970-01-01 00:00:00+00'::timestamp with time zone)) AS "last_active"
   FROM (("roster" "r"
     LEFT JOIN "progress_agg" "pa" ON (("pa"."user_id" = "r"."user_id")))
     LEFT JOIN "attempt_agg" "aa" ON (("aa"."user_id" = "r"."user_id")));


ALTER VIEW "public"."teacher_classroom_progress_summary" OWNER TO "postgres";


ALTER TABLE ONLY "public"."assignment_recipients"
    ADD CONSTRAINT "assignment_recipients_assignment_user_key" UNIQUE ("assignment_id", "user_id");



ALTER TABLE ONLY "public"."assignment_recipients"
    ADD CONSTRAINT "assignment_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_members"
    ADD CONSTRAINT "classroom_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classroom_members"
    ADD CONSTRAINT "classroom_members_unique" UNIQUE ("classroom_id", "user_id");



ALTER TABLE ONLY "public"."classrooms"
    ADD CONSTRAINT "classrooms_class_code_key" UNIQUE ("class_code");



ALTER TABLE ONLY "public"."classrooms"
    ADD CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_lessons"
    ADD CONSTRAINT "daily_lessons_pkey" PRIMARY KEY ("lesson_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."progress_saves"
    ADD CONSTRAINT "progress_saves_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."progress_saves"
    ADD CONSTRAINT "progress_saves_resume_token_key" UNIQUE ("resume_token");



ALTER TABLE ONLY "public"."question_attempts"
    ADD CONSTRAINT "question_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_user_id_course_id_chapter_id_section_id_key" UNIQUE ("user_id", "course_id", "chapter_id", "section_id");



CREATE INDEX "assignment_recipients_assignment_idx" ON "public"."assignment_recipients" USING "btree" ("assignment_id");



CREATE INDEX "assignment_recipients_classroom_user_idx" ON "public"."assignment_recipients" USING "btree" ("classroom_id", "user_id");



CREATE INDEX "assignment_recipients_student_status_idx" ON "public"."assignment_recipients" USING "btree" ("user_id", "status", "assigned_at" DESC);



CREATE INDEX "assignments_classroom_archived_created_idx" ON "public"."assignments" USING "btree" ("classroom_id", "archived_at", "created_at" DESC);



CREATE INDEX "assignments_classroom_id_idx" ON "public"."assignments" USING "btree" ("classroom_id");



CREATE INDEX "assignments_due_date_idx" ON "public"."assignments" USING "btree" ("due_date");



CREATE INDEX "assignments_section_id_idx" ON "public"."assignments" USING "btree" ("section_id");



CREATE INDEX "idx_classroom_members_classroom_id" ON "public"."classroom_members" USING "btree" ("classroom_id");



CREATE INDEX "idx_classroom_members_user_id" ON "public"."classroom_members" USING "btree" ("user_id");



CREATE INDEX "idx_classrooms_class_code" ON "public"."classrooms" USING "btree" ("class_code");



CREATE INDEX "idx_classrooms_teacher_id" ON "public"."classrooms" USING "btree" ("teacher_id");



CREATE INDEX "idx_question_attempts_app_lesson" ON "public"."question_attempts" USING "btree" ("app_id", "lesson_id", "user_id", "attempted_at" DESC);



CREATE INDEX "idx_question_attempts_progress_lookup" ON "public"."question_attempts" USING "btree" ("user_id", "course_id", "chapter_id", "section_id", "question_id", "attempted_at" DESC);



CREATE INDEX "idx_question_attempts_question" ON "public"."question_attempts" USING "btree" ("user_id", "question_id");



CREATE INDEX "idx_question_attempts_section" ON "public"."question_attempts" USING "btree" ("user_id", "chapter_id", "section_id");



CREATE INDEX "idx_question_attempts_user_id" ON "public"."question_attempts" USING "btree" ("user_id");



CREATE INDEX "idx_student_progress_app_lesson" ON "public"."student_progress" USING "btree" ("app_id", "lesson_id", "user_id", "last_active_at" DESC);



CREATE INDEX "idx_student_progress_section" ON "public"."student_progress" USING "btree" ("user_id", "chapter_id", "section_id");



CREATE INDEX "idx_student_progress_user_course" ON "public"."student_progress" USING "btree" ("user_id", "course_id");



CREATE INDEX "idx_student_progress_user_course_chapter" ON "public"."student_progress" USING "btree" ("user_id", "course_id", "chapter_id");



CREATE UNIQUE INDEX "idx_student_progress_user_course_chapter_section" ON "public"."student_progress" USING "btree" ("user_id", "course_id", "chapter_id", "section_id");



CREATE INDEX "idx_student_progress_user_id" ON "public"."student_progress" USING "btree" ("user_id");



CREATE INDEX "progress_saves_created_at_idx" ON "public"."progress_saves" USING "btree" ("created_at");



CREATE INDEX "progress_saves_email_idx" ON "public"."progress_saves" USING "btree" ("email");



CREATE OR REPLACE TRIGGER "trg_classrooms_set_updated_at" BEFORE UPDATE ON "public"."classrooms" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_student_progress_set_updated_at" BEFORE UPDATE ON "public"."student_progress" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."assignment_recipients"
    ADD CONSTRAINT "assignment_recipients_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."assignment_recipients"
    ADD CONSTRAINT "assignment_recipients_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_recipients"
    ADD CONSTRAINT "assignment_recipients_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignment_recipients"
    ADD CONSTRAINT "assignment_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."classroom_members"
    ADD CONSTRAINT "classroom_members_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classroom_members"
    ADD CONSTRAINT "classroom_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classrooms"
    ADD CONSTRAINT "classrooms_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."question_attempts"
    ADD CONSTRAINT "question_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_progress"
    ADD CONSTRAINT "student_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view classrooms" ON "public"."classrooms" FOR SELECT USING (true);



CREATE POLICY "Masters can view all question attempts" ON "public"."question_attempts" FOR SELECT USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."role" = 'master'::"text") AND ("profiles"."approval_status" = 'approved'::"text")))));



CREATE POLICY "Masters can view all student progress" ON "public"."student_progress" FOR SELECT USING (("auth"."uid"() IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE (("profiles"."role" = 'master'::"text") AND ("profiles"."approval_status" = 'approved'::"text")))));



CREATE POLICY "Service role full access" ON "public"."profiles" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to question_attempts" ON "public"."question_attempts" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to student_progress" ON "public"."student_progress" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Students can read own assignment recipients" ON "public"."assignment_recipients" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Teachers can add members to their classrooms" ON "public"."classroom_members" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_members"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Teachers can create assignment recipients for owned classrooms" ON "public"."assignment_recipients" FOR INSERT TO "authenticated" WITH CHECK ((("assigned_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("public"."classrooms" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("c"."id" = "assignment_recipients"."classroom_id") AND ("p"."role" = ANY (ARRAY['teacher'::"text", 'master'::"text"])) AND (("c"."teacher_id" = "auth"."uid"()) OR ("p"."role" = 'master'::"text"))))) AND (EXISTS ( SELECT 1
   FROM "public"."assignments" "a"
  WHERE (("a"."id" = "assignment_recipients"."assignment_id") AND ("a"."classroom_id" = "assignment_recipients"."classroom_id")))) AND (EXISTS ( SELECT 1
   FROM "public"."classroom_members" "cm"
  WHERE (("cm"."classroom_id" = "assignment_recipients"."classroom_id") AND ("cm"."user_id" = "assignment_recipients"."user_id"))))));



CREATE POLICY "Teachers can create assignments for their classrooms" ON "public"."assignments" FOR INSERT WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "assignments"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can create their own classrooms" ON "public"."classrooms" FOR INSERT WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can delete assignments for their classrooms" ON "public"."assignments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "assignments"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can read assignment recipients for owned classrooms" ON "public"."assignment_recipients" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."classrooms" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("c"."id" = "assignment_recipients"."classroom_id") AND ("p"."role" = ANY (ARRAY['teacher'::"text", 'master'::"text"])) AND (("c"."teacher_id" = "auth"."uid"()) OR ("p"."role" = 'master'::"text"))))));



CREATE POLICY "Teachers can read profiles for their classroom roster" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."classroom_members" "cm"
     JOIN "public"."classrooms" "c" ON (("c"."id" = "cm"."classroom_id")))
  WHERE (("cm"."user_id" = "profiles"."id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can remove members from their classrooms" ON "public"."classroom_members" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_members"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Teachers can update assignment recipients for owned classrooms" ON "public"."assignment_recipients" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."classrooms" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("c"."id" = "assignment_recipients"."classroom_id") AND ("p"."role" = ANY (ARRAY['teacher'::"text", 'master'::"text"])) AND (("c"."teacher_id" = "auth"."uid"()) OR ("p"."role" = 'master'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."classrooms" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("c"."id" = "assignment_recipients"."classroom_id") AND ("p"."role" = ANY (ARRAY['teacher'::"text", 'master'::"text"])) AND (("c"."teacher_id" = "auth"."uid"()) OR ("p"."role" = 'master'::"text"))))));



CREATE POLICY "Teachers can update assignments for their classrooms" ON "public"."assignments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "assignments"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "assignments"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can update their own classrooms" ON "public"."classrooms" FOR UPDATE USING (("teacher_id" = "auth"."uid"())) WITH CHECK (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Teachers can view classroom question attempts" ON "public"."question_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."classroom_members" "cm"
     JOIN "public"."classrooms" "c" ON (("c"."id" = "cm"."classroom_id")))
  WHERE (("cm"."user_id" = "question_attempts"."user_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view classroom student progress" ON "public"."student_progress" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."classroom_members" "cm"
     JOIN "public"."classrooms" "c" ON (("c"."id" = "cm"."classroom_id")))
  WHERE (("cm"."user_id" = "student_progress"."user_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view members of their classrooms" ON "public"."classroom_members" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "classroom_members"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Teachers can view their classroom assignments" ON "public"."assignments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."classrooms" "c"
  WHERE (("c"."id" = "assignments"."classroom_id") AND ("c"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view their own classrooms" ON "public"."classrooms" FOR SELECT USING (("teacher_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own question attempts" ON "public"."question_attempts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own student progress" ON "public"."student_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own student progress" ON "public"."student_progress" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own question attempts" ON "public"."question_attempts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own student progress" ON "public"."student_progress" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "allow_insert_progress_saves" ON "public"."progress_saves" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "allow_select_by_token" ON "public"."progress_saves" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."assignment_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classroom_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classrooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_lessons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."progress_saves" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."question_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_progress" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."get_master_algebra1_assignments"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_master_algebra1_assignments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_master_algebra1_assignments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_master_algebra1_overview"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_master_algebra1_overview"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_master_algebra1_overview"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_master_algebra1_recent_attempts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_master_algebra1_recent_attempts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_master_algebra1_recent_attempts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_master_algebra1_user_progress"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_master_algebra1_user_progress"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_master_algebra1_user_progress"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_master_algebra1_user_progress_rows"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_master_algebra1_user_progress_rows"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_master_algebra1_user_progress_rows"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_teacher_assignment_recipients"("p_classroom_id" "uuid", "p_assignment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_teacher_assignment_recipients"("p_classroom_id" "uuid", "p_assignment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_teacher_assignment_recipients"("p_classroom_id" "uuid", "p_assignment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_teacher_classroom_progress"("p_classroom_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_teacher_classroom_progress"("p_classroom_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_teacher_classroom_progress"("p_classroom_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_teacher_classroom_recent_attempts"("p_classroom_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_teacher_classroom_recent_attempts"("p_classroom_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_teacher_classroom_recent_attempts"("p_classroom_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_teacher_classroom_student_progress"("p_classroom_id" "uuid", "p_student_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_teacher_classroom_student_progress"("p_classroom_id" "uuid", "p_student_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_teacher_classroom_student_progress"("p_classroom_id" "uuid", "p_student_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."join_classroom_by_code"("p_class_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_classroom_by_code"("p_class_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_classroom_by_code"("p_class_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_daily_lesson_attempt"("p_lesson_id" "text", "p_section_id" "text", "p_question_id" "text", "p_selected_answer" "text", "p_correct" boolean, "p_section_total_questions" integer, "p_course_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_daily_lesson_attempt"("p_lesson_id" "text", "p_section_id" "text", "p_question_id" "text", "p_selected_answer" "text", "p_correct" boolean, "p_section_total_questions" integer, "p_course_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_daily_lesson_attempt"("p_lesson_id" "text", "p_section_id" "text", "p_question_id" "text", "p_selected_answer" "text", "p_correct" boolean, "p_section_total_questions" integer, "p_course_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_question_attempt_and_update_progress"("p_course_id" "text", "p_chapter_id" "text", "p_section_id" "text", "p_question_id" "text", "p_selected_answer" "text", "p_correct" boolean, "p_section_total_questions" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."record_question_attempt_and_update_progress"("p_course_id" "text", "p_chapter_id" "text", "p_section_id" "text", "p_question_id" "text", "p_selected_answer" "text", "p_correct" boolean, "p_section_total_questions" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_question_attempt_and_update_progress"("p_course_id" "text", "p_chapter_id" "text", "p_section_id" "text", "p_question_id" "text", "p_selected_answer" "text", "p_correct" boolean, "p_section_total_questions" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."assignment_recipients" TO "anon";
GRANT ALL ON TABLE "public"."assignment_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."assignment_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."classroom_members" TO "anon";
GRANT ALL ON TABLE "public"."classroom_members" TO "authenticated";
GRANT ALL ON TABLE "public"."classroom_members" TO "service_role";



GRANT ALL ON TABLE "public"."classrooms" TO "anon";
GRANT ALL ON TABLE "public"."classrooms" TO "authenticated";
GRANT ALL ON TABLE "public"."classrooms" TO "service_role";



GRANT ALL ON TABLE "public"."daily_lessons" TO "anon";
GRANT ALL ON TABLE "public"."daily_lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_lessons" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."student_progress" TO "anon";
GRANT ALL ON TABLE "public"."student_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."student_progress" TO "service_role";



GRANT ALL ON TABLE "public"."daily_lesson_summary" TO "anon";
GRANT ALL ON TABLE "public"."daily_lesson_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_lesson_summary" TO "service_role";



GRANT ALL ON TABLE "public"."question_attempts" TO "anon";
GRANT ALL ON TABLE "public"."question_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."question_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."master_student_summary" TO "anon";
GRANT ALL ON TABLE "public"."master_student_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."master_student_summary" TO "service_role";



GRANT ALL ON TABLE "public"."progress_saves" TO "anon";
GRANT ALL ON TABLE "public"."progress_saves" TO "authenticated";
GRANT ALL ON TABLE "public"."progress_saves" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_classroom_progress_summary" TO "anon";
GRANT ALL ON TABLE "public"."teacher_classroom_progress_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_classroom_progress_summary" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































