-- Phase 1 teacher assignment recipient infrastructure.
-- Additive only: this does not replace the existing assignments table or any views.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.assignment_recipients (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz null,
  status text not null default 'assigned',
  constraint assignment_recipients_status_check check (
    status in ('assigned', 'completed', 'excused', 'archived')
  ),
  constraint assignment_recipients_assignment_user_key unique (assignment_id, user_id)
);

create index if not exists assignment_recipients_student_status_idx
  on public.assignment_recipients (user_id, status, assigned_at desc);

create index if not exists assignment_recipients_classroom_user_idx
  on public.assignment_recipients (classroom_id, user_id);

create index if not exists assignment_recipients_assignment_idx
  on public.assignment_recipients (assignment_id);

alter table public.assignment_recipients enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_recipients'
      and policyname = 'Teachers can read assignment recipients for owned classrooms'
  ) then
    create policy "Teachers can read assignment recipients for owned classrooms"
      on public.assignment_recipients
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.classrooms c
          join public.profiles p on p.id = auth.uid()
          where c.id = assignment_recipients.classroom_id
            and p.role in ('teacher', 'master')
            and (c.teacher_id = auth.uid() or p.role = 'master')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_recipients'
      and policyname = 'Students can read own assignment recipients'
  ) then
    create policy "Students can read own assignment recipients"
      on public.assignment_recipients
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_recipients'
      and policyname = 'Teachers can create assignment recipients for owned classrooms'
  ) then
    create policy "Teachers can create assignment recipients for owned classrooms"
      on public.assignment_recipients
      for insert
      to authenticated
      with check (
        assigned_by = auth.uid()
        and exists (
          select 1
          from public.classrooms c
          join public.profiles p on p.id = auth.uid()
          where c.id = assignment_recipients.classroom_id
            and p.role in ('teacher', 'master')
            and (c.teacher_id = auth.uid() or p.role = 'master')
        )
        and exists (
          select 1
          from public.assignments a
          where a.id = assignment_recipients.assignment_id
            and a.classroom_id = assignment_recipients.classroom_id
        )
        and exists (
          select 1
          from public.classroom_members cm
          where cm.classroom_id = assignment_recipients.classroom_id
            and cm.user_id = assignment_recipients.user_id
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'assignment_recipients'
      and policyname = 'Teachers can update assignment recipients for owned classrooms'
  ) then
    create policy "Teachers can update assignment recipients for owned classrooms"
      on public.assignment_recipients
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.classrooms c
          join public.profiles p on p.id = auth.uid()
          where c.id = assignment_recipients.classroom_id
            and p.role in ('teacher', 'master')
            and (c.teacher_id = auth.uid() or p.role = 'master')
        )
      )
      with check (
        exists (
          select 1
          from public.classrooms c
          join public.profiles p on p.id = auth.uid()
          where c.id = assignment_recipients.classroom_id
            and p.role in ('teacher', 'master')
            and (c.teacher_id = auth.uid() or p.role = 'master')
        )
      );
  end if;
end $$;

grant select, insert, update on public.assignment_recipients to authenticated;

commit;
