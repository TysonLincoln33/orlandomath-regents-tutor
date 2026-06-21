begin;

alter table public.assignment_recipients
  drop constraint if exists assignment_recipients_status_check;

alter table public.assignment_recipients
  add constraint assignment_recipients_status_check
  check (status in ('assigned', 'completed', 'excused', 'archived', 'unassigned'));

commit;
