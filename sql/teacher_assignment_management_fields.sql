-- Phase T4 teacher assignment management fields.
-- Additive only: keeps the existing assignments table and assignment_recipients table intact.

begin;

alter table public.assignments
  add column if not exists updated_at timestamptz null default now(),
  add column if not exists archived_at timestamptz null;

update public.assignments
set updated_at = created_at
where updated_at is null;

create index if not exists assignments_classroom_archived_created_idx
  on public.assignments (classroom_id, archived_at, created_at desc);

commit;
