-- Account deletion (required by Google Play for apps with sign-up).
-- A signed-in user can delete their own login; their tanks and entries go
-- with it (tanks.user_id and entries.user_id are ON DELETE CASCADE).
--
-- Warning for shared projects: every table whose user id references
-- auth.users with ON DELETE CASCADE loses that user's rows too.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
-- Empty search_path: every name below is schema-qualified, so nothing can be shadowed.
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

comment on function public.delete_my_account() is
  'Deletes the calling user''s login and, by cascade, their tanks and entries.';

-- Only signed-in users may call it, and it only ever deletes the caller.
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
