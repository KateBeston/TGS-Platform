-- Silent attribution: the signup trigger records the platform role; a trigger on
-- venue_applications records the venue_owner role (even for someone who first
-- arrived as a platform guest/host, so accumulating roles just works).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_audience text;
begin
  if coalesce(new.raw_user_meta_data->>'account_kind', 'platform') = 'venue_owner' then
    insert into public.account_roles (user_id, role, granted_via)
    values (new.id, 'venue_owner', 'vms') on conflict do nothing;
    return new;
  end if;
  v_audience := case when new.raw_user_meta_data->>'primary_audience' in ('guest','host')
                     then new.raw_user_meta_data->>'primary_audience' else 'guest' end;
  insert into public.profiles (id, first_name, surname, primary_audience, marketing_opt_in)
  values (new.id, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'surname',
          v_audience, coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false))
  on conflict (id) do nothing;
  insert into public.account_roles (user_id, role, granted_via)
  values (new.id, case when v_audience='host' then 'retreat_host' else 'wellness_guest' end, 'platform')
  on conflict do nothing;
  return new;
end $$;

create or replace function public.grant_owner_role_on_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    insert into public.account_roles (user_id, role, granted_via)
    values (new.user_id, 'venue_owner', 'vms') on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists t_grant_owner_role on public.venue_applications;
create trigger t_grant_owner_role after insert on public.venue_applications
  for each row execute function public.grant_owner_role_on_application();
