'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const links = [
  { href: '/', label: 'Dashboard', d: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z' },
  { href: '/pipeline', label: 'Pipeline', d: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z' },
  { href: '/jobs', label: 'Jobs', d: 'M3 7h18v13H3zM8 7V4h8v3M3 12h18' },
  { href: '/candidates', label: 'Candidates', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
  { href: '/clients', label: 'Clients', d: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01' },
  { href: '/placements', label: 'Placements', d: 'M20 6 9 17l-5-5' },
  { href: '/activities', label: 'Tasks & activity', d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav style={{ display: 'contents' }}>
      {links.map((l) => {
        const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`nav-link${active ? ' active' : ''}`}>
            {icon(l.d)}
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
