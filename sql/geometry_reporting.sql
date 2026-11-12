-- Add Geometry reporting alongside the existing Algebra RPCs.
-- Existing tables, rows, policies, and Algebra functions are unchanged.
-- Definitions were inspected in the production SQL editor before this migration.
begin;
do $migration$
declare
  source_name text;
  target_name text;
  source_oid oid;
  definition text;
  signature text;
begin
  foreach source_name in array array[
    'get_master_algebra1_user_progress_rows',
    'get_master_algebra1_overview',
    'get_master_algebra1_recent_attempts',
    'get_master_algebra1_user_progress',
    'get_master_algebra1_assignments',
    'get_student_active_assignments',
    'get_teacher_assignment_recipients',
    'get_teacher_classroom_progress',
    'get_teacher_classroom_recent_attempts',
    'get_teacher_classroom_student_progress'
  ] loop
    select p.oid into strict source_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=source_name;
    definition := pg_get_functiondef(source_oid);
    target_name := case when source_name like 'get_master_algebra1_%'
      then replace(source_name,'algebra1','geometry') else source_name || '_geometry' end;
    definition := replace(definition, 'public.' || source_name || '(', 'public.' || target_name || '(');
    definition := replace(definition, 'get_master_algebra1_user_progress_rows()', 'get_master_geometry_user_progress_rows()');
    definition := replace(definition, '''algebra1''', '''geometry''');
    definition := replace(definition, '''^ch[0-9]+_s[0-9]+$''', '''^geo-ch[0-9]+_s[0-9]+$''');
    -- New reporting functions require the existing approved teacher/master roles.
    definition := replace(definition, 'p.role in (''teacher'', ''master'')',
      'p.role in (''teacher'', ''master'') and p.approval_status = ''approved''');
    definition := replace(definition, 'v_role <> ''master'' or v_approval <> ''approved''',
      'v_role is distinct from ''master'' or v_approval is distinct from ''approved''');
    if source_name = 'get_master_algebra1_user_progress_rows' then
      definition := replace(definition, 'where p.role = ''student''',
        'where p.role = ''student'' and exists (select 1 from public.profiles viewer where viewer.id = auth.uid() and viewer.role = ''master'' and viewer.approval_status = ''approved'')');
      -- Include untouched Geometry sections in overall completion (38 sections).
      definition := replace(definition, 'avg(sp.completion_percent)', 'sum(sp.completion_percent) / 38.0');
    end if;
    execute definition;
    signature := format('public.%I(%s)',target_name,pg_get_function_identity_arguments(source_oid));
    execute 'revoke all on function ' || signature || ' from public, anon';
    execute 'grant execute on function ' || signature || ' to authenticated';
  end loop;
end;
$migration$;

create or replace function public.get_teacher_student_assignments_geometry(p_classroom_id uuid, p_student_user_id uuid)
returns table(assignment_id uuid,title text,description text,section_id text,due_date date,assigned_at timestamptz,status text,archived_at timestamptz,completion_percent numeric,is_complete boolean)
language sql stable security definer set search_path=public as $function$
  select a.id,a.title::text,a.description::text,a.section_id::text,a.due_date,ar.assigned_at,ar.status::text,a.archived_at,
    coalesce(sp.completion_percent,0)::numeric,(ar.status='completed' or coalesce(sp.completion_percent,0)>=100)
  from public.assignments a join public.assignment_recipients ar on ar.assignment_id=a.id and ar.classroom_id=a.classroom_id
  join public.classroom_members cm on cm.classroom_id=a.classroom_id and cm.user_id=ar.user_id
  left join public.student_progress sp on sp.user_id=ar.user_id and sp.section_id=a.section_id and sp.course_id='geometry' and sp.app_id='regents-algebra'
  where a.classroom_id=p_classroom_id and ar.user_id=p_student_user_id and a.section_id ~ '^geo-ch[0-9]+_s[0-9]+$'
    and exists(select 1 from public.classrooms c join public.profiles viewer on viewer.id=auth.uid()
      where c.id=p_classroom_id and viewer.role in ('teacher','master') and viewer.approval_status='approved'
      and (c.teacher_id=auth.uid() or viewer.role='master'))
  order by ar.assigned_at desc;
$function$;
revoke all on function public.get_teacher_student_assignments_geometry(uuid,uuid) from public,anon;
grant execute on function public.get_teacher_student_assignments_geometry(uuid,uuid) to authenticated;
commit;
