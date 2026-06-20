-- A3.6b.1 Quick Assign MVP infrastructure.
-- Minimal additive classroom discriminator so Admin Classroom and Quick Class do not conflict.

begin;

alter table public.classrooms
  add column if not exists classroom_kind text not null default 'standard';

alter table public.classrooms
  drop constraint if exists classrooms_classroom_kind_check;

alter table public.classrooms
  add constraint classrooms_classroom_kind_check
  check (classroom_kind in ('standard', 'admin_assignment', 'quick_assign'));

update public.classrooms
set classroom_kind = 'admin_assignment'
where classroom_kind = 'standard'
  and name = 'Admin Classroom';

create unique index if not exists classrooms_one_admin_assignment_per_admin_idx
  on public.classrooms (teacher_id)
  where classroom_kind = 'admin_assignment';

create unique index if not exists classrooms_one_quick_assign_per_admin_idx
  on public.classrooms (teacher_id)
  where classroom_kind = 'quick_assign';

commit;
