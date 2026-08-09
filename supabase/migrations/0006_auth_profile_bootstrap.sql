-- Keep application profile identity aligned with Supabase Auth.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users(id, locale)
  values (new.id, 'ar')
  on conflict (id) do nothing;
  return new;
end;
$$;

insert into public.users(id, locale)
select id, 'ar' from auth.users
on conflict (id) do nothing;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
