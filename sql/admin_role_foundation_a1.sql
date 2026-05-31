-- Phase A1: Administrator role signup, approval, and email-domain foundation.

alter table public.profiles
  add column if not exists email_domain text;

update public.profiles
set email_domain = lower(split_part(email, '@', 2))
where email_domain is null
  and position('@' in email) > 0;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  requested_role_value text;
  email_domain_value text;
begin
  requested_role_value := coalesce(new.raw_user_meta_data->>'requested_role', 'student');
  email_domain_value := lower(split_part(new.email, '@', 2));

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    requested_role,
    approval_status,
    email_domain,
    is_independent
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when requested_role_value in ('teacher', 'admin') then 'student'
      else requested_role_value
    end,
    requested_role_value,
    case
      when requested_role_value in ('teacher', 'admin') then 'pending'
      else 'approved'
    end,
    nullif(email_domain_value, ''),
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
