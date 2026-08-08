import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'The Global Sanctum',
    template: '%s · The Global Sanctum',
  },
  description:
    'Retreat spaces, wellness experiences, globally curated.',
  metadataBase: new URL('https://www.theglobalsanctum.com'),
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>{children}</body>
    </html>
  );
}
