-- Phase A1: Administrator role signup, approval, and email-domain foundation.

alter table public.profiles
  add column if not exists email_domain text;

update public.profiles
set email_domain = lower(split_part(email, '@', 2))
where email_domain is null
  and position('@' in email) > 0;

create or replace function public.normalize_profile_signup_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.email is not null and position('@' in new.email) > 0 then
      new.email_domain := nullif(lower(split_part(new.email, '@', 2)), '');
    end if;
  elsif new.email_domain is null or new.email is distinct from old.email then
    if new.email is not null and position('@' in new.email) > 0 then
      new.email_domain := nullif(lower(split_part(new.email, '@', 2)), '');
    else
      new.email_domain := null;
    end if;
  end if;

  if tg_op = 'INSERT' and new.requested_role in ('teacher', 'admin') then
    new.role := 'student';
    new.approval_status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_normalize_signup_role on public.profiles;
create trigger trg_profiles_normalize_signup_role
before insert or update of email, requested_role, role, approval_status
on public.profiles
for each row
execute function public.normalize_profile_signup_role();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role_value text;
  email_domain_value text;
begin
  requested_role_value := coalesce(new.raw_user_meta_data->>'requested_role', 'student');

  if requested_role_value not in ('student', 'teacher', 'admin') then
    requested_role_value := 'student';
  end if;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Profiles remain self-editable for safe display fields only. Role and approval
-- fields must be changed manually by privileged Supabase access.
revoke update on public.profiles from anon, authenticated;
grant update (username, full_name, is_independent) on public.profiles to authenticated;
