"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import AdminGate from "@/components/admin/AdminGate";
import AdminNav from "@/components/admin/AdminNav";
import { StatusBadge } from "@/components/orders/OrderParts";
import { listAdminOrders } from "@/lib/admin/history";
import { formatPrice } from "@/lib/formatPrice";
import { formatDate, statusLabels } from "@/lib/orderUtils";
import { ORDER_STATUSES, type OrderStatus } from "@/types/order";

export default function AdminHistoryPage() {
  return (
    <AdminGate redirect="/admin/history">
      {(token) => <HistoryBoard key={token} token={token} />}
    </AdminGate>
  );
}

function HistoryBoard({ token }: { token: string }) {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-order-history", token, status, search, page],
    queryFn: ({ signal }) =>
      listAdminOrders({ status, q: search, page }, token, signal),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(draft.trim());
    setPage(1);
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8">
      <AdminNav />
      <h1 className="text-2xl font-bold">Lịch sử đơn</h1>
      <p className="mt-1 text-sm text-stone-600">
        Mọi đơn hàng, mới nhất trước{data ? ` · ${data.total} đơn` : ""}
      </p>

      <form
        onSubmit={submit}
        className="mt-5 flex flex-wrap items-end gap-3"
        role="search"
      >
        <label className="text-sm font-semibold">
          Trạng thái
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as OrderStatus | "");
              setPage(1);
            }}
            className="mt-1 block rounded-xl border border-stone-300 px-3 py-2 font-normal"
          >
            <option value="">Tất cả trạng thái</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1 text-sm font-semibold sm:max-w-sm">
          Mã đơn hoặc email khách
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="ORD-… hoặc email"
            className="mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2 font-normal"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-amber-800 px-4 py-2 text-sm font-semibold text-white"
        >
          Tìm
        </button>
      </form>

      <div className="mt-6">
        {query.isPending ? (
          <p
            role="status"
            className="rounded-2xl border border-stone-200 p-8 text-center text-stone-600"
          >
            Đang tải lịch sử đơn…
          </p>
        ) : query.isError ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 p-8 text-center"
          >
            <p className="font-semibold text-red-800">{query.error.message}</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-3 font-semibold text-amber-800 underline"
            >
              Thử lại
            </button>
          </div>
        ) : !data?.items.length ? (
          <p className="rounded-2xl border border-stone-200 p-8 text-center text-stone-600">
            Không có đơn nào phù hợp.
          </p>
        ) : (
          <ul className="grid gap-3" aria-label="Danh sách đơn">
            {data.items.map((order) => (
              <li
                key={order.id}
                className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/history/${encodeURIComponent(order.id)}`}
                      className="break-all font-mono text-sm font-bold text-amber-900 underline"
                    >
                      {order.id}
                    </Link>
                    <p className="truncate text-sm text-stone-600">
                      {order.customerEmail ?? "Khách hàng"} ·{" "}
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <StatusBadge order={order} />
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="font-bold">{formatPrice(order.total)}</span>
                  <span className="text-stone-600">
                    {order.items.reduce((sum, item) => sum + item.qty, 0)} món
                  </span>
                  {order.paymentMethod && (
                    <span className="text-stone-600">
                      {order.paymentMethod === "WALLET"
                        ? "Chuyển khoản / Ví"
                        : "Thẻ tại quầy"}
                    </span>
                  )}
                  {order.refundedAmount > 0 && (
                    <span className="font-semibold text-green-800">
                      Đã hoàn {formatPrice(order.refundedAmount)}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && data.total > data.pageSize && (
        <nav
          aria-label="Phân trang"
          className="mt-5 flex items-center justify-center gap-3 text-sm"
        >
          <button
            type="button"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-xl border border-stone-300 px-3 py-2 disabled:opacity-50"
          >
            Trước
          </button>
          <span>
            Trang {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages || query.isFetching}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-xl border border-stone-300 px-3 py-2 disabled:opacity-50"
          >
            Sau
          </button>
        </nav>
      )}
    </section>
  );
}
