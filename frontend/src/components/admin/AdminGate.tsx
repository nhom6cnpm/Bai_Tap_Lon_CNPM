"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useHydrated } from "@/hooks/useHydrated";

/** Shows children only to a logged-in ADMIN (the backend checks the role too). */
export default function AdminGate({
  redirect,
  children,
}: {
  redirect: string;
  children: (token: string) => ReactNode;
}) {
  const { token, user } = useAuth();
  const hydrated = useHydrated();
  if (!hydrated) return <p className="p-8">Đang tải…</p>;
  if (!token)
    return (
      <section className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-bold">Trang dành cho nhân viên</h1>
        <Link
          href={`/login?redirect=${encodeURIComponent(redirect)}`}
          className="mt-4 inline-block text-amber-800 underline"
        >
          Đăng nhập
        </Link>
      </section>
    );
  if (user?.role !== "ADMIN")
    return (
      <section className="p-8 text-center">
        <h1 className="text-2xl font-bold">Không có quyền truy cập</h1>
        <p>Chỉ nhân viên cửa hàng mới xem được trang này.</p>
      </section>
    );
  return <>{children(token)}</>;
}
