'use client';

import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  if (pathname === '/kitten') return null;

  return (
    <footer className="site-footer">
      <p>© {new Date().getFullYear()} Project PedalWatch</p>
      <p>
        <a href="mailto:pedalwatchsf@gmail.com">pedalwatchsf@gmail.com</a>
        {' · '}
        <a href="https://instagram.com/pedalwatchsf" target="_blank" rel="noopener noreferrer">
          @pedalwatchsf
        </a>
      </p>
    </footer>
  );
}
