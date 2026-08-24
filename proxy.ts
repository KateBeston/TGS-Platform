import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Renamed from middleware.ts per Next.js 16 (the middleware file convention is
// deprecated and renamed to proxy). Same behaviour: refreshes the Supabase auth
// session on each request. config.matcher is unchanged.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
