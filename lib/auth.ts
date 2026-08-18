import { createClient } from '@/lib/supabase/server';

/** The signed-in auth user, or null. Uses getUser (verified) not the session. */
export async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** The user's profile merged with their email, or null when signed out. */
export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return { id: user.id, email: user.email ?? null, ...(data ?? {}) } as Record<string, any>;
}
