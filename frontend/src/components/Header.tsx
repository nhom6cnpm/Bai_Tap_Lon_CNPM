'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { label: 'Menu', href: '/menu', match: ['/menu', '/products'] },
  { label: 'Giỏ hàng', href: '/cart', match: ['/cart'] },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/menu" className="text-xl font-bold text-amber-800">
          BrewLite
        </Link>
        <nav className="flex gap-1 text-sm sm:gap-3">
          {NAV.map((n) => {
            const active = n.match.some((m) => pathname.startsWith(m));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3 py-1.5 font-medium ${
                  active ? 'bg-amber-100 text-amber-900' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}