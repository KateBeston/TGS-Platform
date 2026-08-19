-- Signup trigger: VMS (venue owner) sign-ups (account_kind='venue_owner' in
-- user metadata) are set up inside the VMS and get NO platform profiles row.
-- Everyone else gets a guest/host profile; any stray audience value defaults to guest.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'account_kind', 'platform') = 'venue_owner' then
    return new;
  end if;
  insert into public.profiles (id, first_name, surname, primary_audience, marketing_opt_in)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'surname',
    case when new.raw_user_meta_data->>'primary_audience' in ('guest','host')
         then new.raw_user_meta_data->>'primary_audience' else 'guest' end,
    coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;
