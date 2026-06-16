-- A3.3 User Activation Management
-- Adds active/inactive account state without changing role or approval semantics.

alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamp with time zone;
