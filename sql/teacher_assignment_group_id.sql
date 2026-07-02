-- Add a persisted logical assignment grouping identifier.
-- Existing assignment rows self-group by default so current single-section behavior is preserved.

begin;

alter table public.assignments
  add column if not exists assignment_group_id uuid;

update public.assignments
set assignment_group_id = id
where assignment_group_id is null;

alter table public.assignments
  alter column assignment_group_id set not null;

create index if not exists assignments_assignment_group_id_idx
  on public.assignments (assignment_group_id);

create index if not exists assignments_classroom_group_idx
  on public.assignments (classroom_id, assignment_group_id);

commit;
