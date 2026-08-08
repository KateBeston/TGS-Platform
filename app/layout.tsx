import type { Metadata } from 'next';
import { Suspense } from 'react';
import Analytics, { AnalyticsNoScript } from '@/components/Analytics';
import ConsentBanner from '@/components/ConsentBanner';
import ConsentDefaults from '@/components/ConsentDefaults';
import FirstTouch from '@/components/FirstTouch';
import PageViews from '@/components/PageViews';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import JournalSignup from '@/components/JournalSignup';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'The Global Sanctum — retreat spaces and wellness venues, globally curated',
    // Every page sets its own. The audit found /about, /contact and
    // /studio all serving the home page's title, which suppresses
    // rankings across the whole site.
    template: '%s | The Global Sanctum',
  },
  description:
    'Retreat centres, wellness resorts, thermal sanctuaries and sacred spaces, '
    + 'curated from around the world.',
  metadataBase: new URL('https://www.theglobalsanctum.com'),
  openGraph: {
    siteName: 'The Global Sanctum',
    locale: 'en_AU',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        {/* Before anything else. Denied by default, so a visitor who
            never answers is treated as having declined rather than as
            having agreed by silence. */}
        <ConsentDefaults />
        {/* After the defaults, never before. GTM starts with permission
            for nothing and is updated when somebody answers the banner. */}
        <Analytics />
      </head>
      <body>
        <AnalyticsNoScript />
        {/* Records how somebody arrived, once per session. First touch
            rather than last — a Journal reader who later searches for us
            was brought here by the Journal. */}
        <FirstTouch />
        {/* This is a single-page application, so after the first load
            navigation replaces the content without a new document and
            GA4 sees nothing. Without this it records only the landing
            page and every session looks like a bounce. */}
        <Suspense fallback={null}><PageViews /></Suspense>
        <SiteHeader />
        <main id="main">{children}</main>
        {/* Above the footer on every page, from the layout rather than
            from each template. Eleven templates would mean eleven copies
            and nine versions. */}
        <JournalSignup source="site" />
        <SiteFooter />
        <ConsentBanner />
      </body>
    </html>
  );
}
