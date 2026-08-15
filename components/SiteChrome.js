'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Nav from './Nav';

// Rendered once in the root layout instead of per-page, so Header's logo
// image and Nav don't unmount/remount (and visibly flash) on every
// client-side navigation. Hidden on /kitten, matching Footer's existing
// pathname check -- that page is a deliberate full-bleed easter egg with
// no site chrome at all.
export default function SiteChrome() {
  const pathname = usePathname();
  if (pathname === '/kitten') return null;

  return (
    <>
      <Header />
      <Nav />
    </>
  );
}
