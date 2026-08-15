'use client';

import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  if (pathname === '/kitten') return null;

  return (
    <footer className="site-footer">
      <p>© {new Date().getFullYear()} Project PedalWatch</p>
    </footer>
  );
}
