"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Order } from "@/types/order";

export default function ReadyOrdersNotice({
  orders,
}: {
  orders: readonly Order[];
}) {
  const { token, user } = useAuth();
  return token && user && user.role !== "ADMIN" ? (
    <ReadyNotice key={token} orders={orders} owner={user.id} />
  ) : null;
}

function ReadyNotice({
  orders,
  owner,
}: {
  orders: readonly Order[];
  owner: string;
}) {
  const [announced, setAnnounced] = useState<string[]>([]);
  const signature = JSON.stringify(
    orders
      .filter((order) => order.status === "READY")
      .map((order) => order.id)
      .sort(),
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const ids: string[] = JSON.parse(signature);
      const key = `brewlite-ready-notices:${owner}`;
      let seen: string[] = [];
      try {
        const stored: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
        if (Array.isArray(stored))
          seen = stored.filter((id): id is string => typeof id === "string");
      } catch {
        /* A blocked or invalid session cache must not hide a ready order. */
      }
      const fresh = ids.filter((id) => !seen.includes(id));
      if (!fresh.length) return;
      setAnnounced((current) => [...new Set([...current, ...fresh])]);
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify([...new Set([...seen, ...fresh])]),
        );
      } catch {
        /* Current component state still deduplicates notices. */
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [signature, owner]);
  const visible = orders.filter(
    (order) => order.status === "READY" && announced.includes(order.id),
  );
  if (!visible.length) return null;
  return (
    <section
      aria-label="Thông báo nhận món"
      className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div role="status">
          <p className="font-semibold">Đồ uống đã sẵn sàng, mời bạn ra quầy.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {visible.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${encodeURIComponent(order.id)}`}
                  className="break-all underline"
                >
                  Xem đơn {order.id}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          aria-label="Đóng thông báo nhận món"
          onClick={() => setAnnounced([])}
          className="shrink-0 rounded-full px-2 py-1 hover:bg-green-100"
        >
          ✕
        </button>
      </div>
    </section>
  );
}
