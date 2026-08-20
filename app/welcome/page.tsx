import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { setOrientation } from '@/app/actions/account';

export const metadata = { title: 'Welcome — The Global Sanctum' };

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');
  const { data: profile } = await supabase.from('profiles').select('oriented_at').eq('id', user.id).maybeSingle();
  if (profile?.oriented_at) redirect('/account');

  return (
    <main className="welcome">
      <div className="welcome-eyebrow">The Global Sanctum</div>
      <h1 className="welcome-title">What are you here for?</h1>
      <p className="welcome-sub">So we can shape things around you. You can explore everything either way, and change this anytime.</p>
      <div className="welcome-cards">
        <form action={setOrientation}>
          <input type="hidden" name="kind" value="guest" />
          <button type="submit" className="welcome-card">
            <span className="welcome-card-title">Wellness experiences</span>
            <span className="welcome-card-desc">I&rsquo;m looking for wellness experiences and spaces to visit.</span>
            <span className="welcome-card-go">Explore as a guest &rarr;</span>
          </button>
        </form>
        <form action={setOrientation}>
          <input type="hidden" name="kind" value="host" />
          <button type="submit" className="welcome-card">
            <span className="welcome-card-title">A retreat venue</span>
            <span className="welcome-card-desc">I&rsquo;m looking for a venue to host my own retreat.</span>
            <span className="welcome-card-go">Explore as a host &rarr;</span>
          </button>
        </form>
      </div>
    </main>
  );
}
