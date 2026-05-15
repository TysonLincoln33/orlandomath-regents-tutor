-- Minimal master dashboard data-scope fix.
-- Apply this in place of the existing public.master_student_summary view definition.
-- It intentionally scopes both summary aggregates to the Regents Algebra 1 app/course
-- so the /master dashboard cannot mix daily-lesson rows with Algebra 1 rows.

create or replace view public.master_student_summary as
with scoped_progress as (
  select
    user_id,
    completion_percent,
    accuracy_percent,
    last_active_at
  from public.student_progress
  where app_id = 'regents-algebra'
    and course_id = 'algebra1'
),
progress_summary as (
  select
    user_id,
    avg(completion_percent) as completion,
    avg(accuracy_percent) as progress_accuracy,
    max(last_active_at) as progress_last_active
  from scoped_progress
  group by user_id
),
scoped_attempts as (
  select
    user_id,
    correct,
    attempted_at
  from public.question_attempts
  where app_id = 'regents-algebra'
    and course_id = 'algebra1'
),
attempt_summary as (
  select
    user_id,
    count(*) as attempts,
    count(*) filter (where correct) as correct,
    max(attempted_at) as attempt_last_active
  from scoped_attempts
  group by user_id
),
scoped_users as (
  select user_id from progress_summary
  union
  select user_id from attempt_summary
)
select
  scoped_users.user_id,
  profiles.full_name,
  profiles.email,
  coalesce(round(progress_summary.completion), 0) as completion,
  case
    when coalesce(attempt_summary.attempts, 0) > 0 then
      round((coalesce(attempt_summary.correct, 0)::numeric / attempt_summary.attempts) * 100)
    else coalesce(round(progress_summary.progress_accuracy), 0)
  end as accuracy,
  coalesce(attempt_summary.attempts, 0) as attempts,
  coalesce(attempt_summary.correct, 0) as correct,
  (
    select max(last_active)
    from (
      values
        (progress_summary.progress_last_active::timestamptz),
        (attempt_summary.attempt_last_active::timestamptz)
    ) as activity(last_active)
  ) as last_active,
  'regents-algebra'::text as app_id,
  'algebra1'::text as course_id
from scoped_users
join public.profiles on profiles.id = scoped_users.user_id
left join progress_summary on progress_summary.user_id = scoped_users.user_id
left join attempt_summary on attempt_summary.user_id = scoped_users.user_id;
