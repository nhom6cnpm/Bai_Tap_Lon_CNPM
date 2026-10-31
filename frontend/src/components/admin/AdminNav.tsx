"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/payments", label: "Thanh toán" },
  { href: "/admin/orders", label: "Đơn hàng" },
  { href: "/admin/history", label: "Lịch sử đơn" },
  { href: "/admin/ingredients", label: "Nguyên liệu" },
] as const;

/** Tabs shared by every staff page. */
export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Quản trị"
      className="mb-6 flex flex-wrap gap-3 text-sm font-semibold"
    >
      {LINKS.map((link) => {
        const current =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={
              current
                ? "rounded-full bg-amber-100 px-4 py-2 text-amber-900"
                : "rounded-full border border-stone-200 px-4 py-2"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
