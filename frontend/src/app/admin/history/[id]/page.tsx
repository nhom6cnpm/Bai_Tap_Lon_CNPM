"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import AdminGate from "@/components/admin/AdminGate";
import AdminNav from "@/components/admin/AdminNav";
import PriceSummary from "@/components/PriceSummary";
import { OrderItems, StatusBadge } from "@/components/orders/OrderParts";
import { getAdminOrderDetail } from "@/lib/admin/history";
import { formatPrice } from "@/lib/formatPrice";
import { formatDate } from "@/lib/orderUtils";
import { OrderApiError } from "@/lib/orders/history";

const PAYMENT_STATUS: Record<string, string> = {
  PENDING: "Chưa thấy tiền về",
  TRANSFER_RECEIVED: "Tiền đã về",
  SUCCESS: "Đã xác nhận",
  FAILED: "Đã từ chối / hủy",
};
const CANCEL_REASON: Record<string, string> = {
  PAYMENT_TIMEOUT: "Quá hạn thanh toán",
  USER_CANCELLED: "Khách hủy / nhân viên duyệt hủy",
};
const date = (value: string | null) => (value ? formatDate(value) : "—");

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AdminGate redirect={`/admin/history/${id}`}>
      {(token) => <OrderDetail key={`${token}:${id}`} id={id} token={token} />}
    </AdminGate>
  );
}

function OrderDetail({ id, token }: { id: string; token: string }) {
  const query = useQuery({
    queryKey: ["admin-order-detail", token, id],
    queryFn: ({ signal }) => getAdminOrderDetail(id, token, signal),
    retry: false,
  });
  const order = query.data;

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-8">
      <AdminNav />
      <Link
        href="/admin/history"
        className="text-sm font-semibold text-amber-800 underline"
      >
        ← Lịch sử đơn
      </Link>
      {query.isPending ? (
        <p role="status" className="mt-6 text-stone-600">
          Đang tải đơn…
        </p>
      ) : query.isError ? (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-red-200 p-8 text-center"
        >
          <p className="font-semibold text-red-800">
            {query.error instanceof OrderApiError && query.error.status === 404
              ? "Không tìm thấy đơn hàng."
              : query.error.message}
          </p>
        </div>
      ) : order ? (
        <>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 break-all font-mono text-xl font-bold">
              {order.id}
            </h1>
            <StatusBadge order={order} />
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl border border-stone-200 bg-white p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Khách hàng</dt>
              <dd className="break-all">{order.customerEmail ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Tạo lúc</dt>
              <dd>{date(order.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Hạn thanh toán</dt>
              <dd>{date(order.expiresAt)}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Điểm thưởng</dt>
              <dd>
                {order.pointsEarned > 0 ? `+${order.pointsEarned} điểm` : "—"}
                {order.pointsReversed > 0 &&
                  ` (đã thu hồi ${order.pointsReversed})`}
              </dd>
            </div>
            {order.cancelledAt && (
              <div className="sm:col-span-2">
                <dt className="text-stone-500">Đã hủy</dt>
                <dd>
                  {date(order.cancelledAt)} ·{" "}
                  {CANCEL_REASON[order.cancelReason ?? ""] ??
                    order.cancelReason}
                </dd>
              </div>
            )}
            {order.cancelRequest && (
              <div className="sm:col-span-2">
                <dt className="text-stone-500">Yêu cầu hủy</dt>
                <dd className="break-words">
                  “{order.cancelRequest.reason}” · {order.cancelRequest.status}
                  {order.cancelReviewedByEmail &&
                    ` · duyệt bởi ${order.cancelReviewedByEmail}`}
                  {order.cancelRequest.reviewNote &&
                    ` · ${order.cancelRequest.reviewNote}`}
                </dd>
              </div>
            )}
          </dl>

          <h2 className="mt-6 text-lg font-bold">Món</h2>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <OrderItems order={order} />
            <PriceSummary totals={order} />
          </div>

          <h2 className="mt-6 text-lg font-bold">Phiên thanh toán</h2>
          {order.payments.length ? (
            <ul className="grid gap-2">
              {order.payments.map((payment) => (
                <li
                  key={payment.paymentId}
                  className="rounded-2xl border border-stone-200 bg-white p-4 text-sm"
                >
                  <p className="flex flex-wrap justify-between gap-2">
                    <span className="break-all font-mono text-xs">
                      {payment.paymentId}
                    </span>
                    <strong>
                      {PAYMENT_STATUS[payment.status] ?? payment.status}
                    </strong>
                  </p>
                  <p className="mt-1 text-stone-600">
                    {payment.method === "WALLET"
                      ? "Chuyển khoản / Ví"
                      : "Thẻ tại quầy"}{" "}
                    · {formatPrice(payment.amount)} · tạo{" "}
                    {date(payment.createdAt)}
                    {payment.receivedAt &&
                      ` · tiền về ${date(payment.receivedAt)}`}
                  </p>
                  {payment.reviewedAt && (
                    <p className="mt-1 text-stone-600">
                      Xử lý {date(payment.reviewedAt)}
                      {payment.reviewedByEmail &&
                        ` bởi ${payment.reviewedByEmail}`}
                      {payment.reviewNote && ` · ${payment.reviewNote}`}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-600">Chưa có phiên thanh toán.</p>
          )}

          <h2 className="mt-6 text-lg font-bold">Sao kê của đơn</h2>
          {order.bankTransactions.length ? (
            <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white px-4">
              {order.bankTransactions.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                >
                  <span className="min-w-0 flex-1 break-words">
                    {row.content}
                    <span className="block text-xs text-stone-500">
                      {date(row.createdAt)}
                    </span>
                  </span>
                  <strong
                    className={
                      row.type === "IN" ? "text-green-700" : "text-red-700"
                    }
                  >
                    {row.type === "IN" ? "+" : "−"}
                    {formatPrice(row.amount)}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-600">Chưa có giao dịch.</p>
          )}
          {order.refundedAmount > 0 && (
            <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-900">
              Đã hoàn {formatPrice(order.refundedAmount)} cho khách.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
