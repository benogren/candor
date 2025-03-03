// components/dashboard/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type SidebarProps = {
  role: 'admin' | 'member';
};

export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const links = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      adminOnly: false,
    },
    {
      name: 'My Feedback',
      href: '/dashboard/feedback',
      adminOnly: false,
    },
    {
      name: 'Team',
      href: '/dashboard/team',
      adminOnly: false,
    },
    {
      name: 'Company Settings',
      href: '/dashboard/company',
      adminOnly: true,
    },
  ];

  const filteredLinks = links.filter(link => !link.adminOnly || role === 'admin');

  return (
    <aside className="w-64 bg-white shadow-sm h-[calc(100vh-64px)] p-4">
      <nav className="space-y-1">
        {filteredLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex items-center px-4 py-2 text-sm rounded-md',
              pathname === link.href
                ? 'bg-slate-100 text-slate-900 font-medium'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            {link.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}