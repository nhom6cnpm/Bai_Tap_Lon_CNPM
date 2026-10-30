"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useAuth } from "@/hooks/useAuth";

const CartBadge = dynamic(() => import("./CartBadge"), { ssr: false });
const AuthNav = dynamic(() => import("./AuthNav"), { ssr: false });

const NAV = [
  { label: "Menu", href: "/menu", match: ["/menu", "/products"] },
  { label: "Giỏ hàng", href: "/cart", match: ["/cart"] },
];

export default function Header() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const links = isAuthenticated
    ? [...NAV, { label: "Đơn hàng", href: "/orders", match: ["/orders"] }]
    : NAV;

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/menu" className="text-xl font-bold text-amber-800">
          BrewLite
        </Link>
        <nav className="order-last flex w-full flex-wrap gap-1 text-sm sm:order-none sm:ml-auto sm:w-auto sm:gap-3">
          {links.map((n) => {
            const active = n.match.some((m) => pathname.startsWith(m));
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 font-medium ${
                  active
                    ? "bg-amber-100 text-amber-900"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {n.label}
                {n.href === "/cart" && <CartBadge />}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 sm:ml-3">
          <AuthNav />
        </div>
      </div>
    </header>
  );
}
