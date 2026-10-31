"use client";

import { useQuery } from "@tanstack/react-query";
import { formatPrice } from "@/lib/formatPrice";
import { listBankTransactions } from "@/lib/admin/payments";
import { useAuth } from "@/hooks/useAuth";

const POLL_INTERVAL_MS = 4000;

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
      });
}

/** Sao kê tài khoản của quán trong ngân hàng giả lập (tiền vào / hoàn tiền). */
export default function BankStatement({ orderId }: { orderId: string }) {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ["admin-bank-transactions", token, orderId.trim()],
    queryFn: () => listBankTransactions(orderId),
    refetchInterval: POLL_INTERVAL_MS,
    retry: false,
  });
  const rows = query.data ?? [];
  const received = rows
    .filter((row) => row.type === "IN")
    .reduce((sum, row) => sum + row.amount, 0);
  const refunded = rows
    .filter((row) => row.type === "REFUND")
    .reduce((sum, row) => sum + row.amount, 0);

  if (query.isPending)
    return (
      <p className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-600">
        Đang tải sao kê…
      </p>
    );
  if (query.isError)
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-200 bg-white p-8 text-center"
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
    );
  if (!rows.length)
    return (
      <p className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-600">
        {orderId.trim()
          ? `Chưa có giao dịch nào cho đơn “${orderId.trim()}”.`
          : "Chưa có giao dịch nào."}
      </p>
    );

  return (
    <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-green-50 p-3">
          <dt className="text-green-800">Tiền vào</dt>
          <dd className="text-lg font-bold text-green-900">
            +{formatPrice(received)}
          </dd>
        </div>
        <div className="rounded-xl bg-red-50 p-3">
          <dt className="text-red-800">Đã hoàn</dt>
          <dd className="text-lg font-bold text-red-900">
            −{formatPrice(refunded)}
          </dd>
        </div>
        <div className="rounded-xl bg-stone-50 p-3">
          <dt className="text-stone-600">Còn giữ</dt>
          <dd className="text-lg font-bold text-stone-900">
            {formatPrice(received - refunded)}
          </dd>
        </div>
      </dl>
      <ul className="mt-4 divide-y divide-stone-100">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="break-all font-medium text-stone-900">
                {row.content}
              </p>
              <p className="text-xs text-stone-500">
                {formatDateTime(row.createdAt)} ·{" "}
                {row.type === "IN" ? "Nhận tiền" : "Hoàn tiền"}
              </p>
            </div>
            <span
              className={`shrink-0 font-bold ${row.type === "IN" ? "text-green-700" : "text-red-700"}`}
            >
              {row.type === "IN" ? "+" : "−"}
              {formatPrice(row.amount)}
            </span>
          </li>
        ))}
      </ul>
      {rows.length >= 200 && (
        <p className="mt-2 text-xs text-stone-500">
          Chỉ hiển thị 200 giao dịch mới nhất.
        </p>
      )}
    </div>
  );
}
