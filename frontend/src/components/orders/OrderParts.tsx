"use client";
import Image from "next/image";
import Link from "next/link";
import type { Order } from "@/types/order";
import { formatPrice } from "@/lib/formatPrice";
import {
  canPay,
  formatDate,
  formatRemaining,
  orderStatusLabel,
  toppingLabel,
} from "@/lib/orderUtils";
import { OrderApiError } from "@/lib/orders/history";

export const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2 text-center text-sm font-semibold text-white hover:bg-amber-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-800 disabled:opacity-50";
export const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-stone-300 px-5 py-2 text-center text-sm font-semibold text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-amber-800 disabled:opacity-50";

export function StatusBadge({ order }: { order: Order }) {
  const color =
    order.status === "CANCELLED" || order.status === "PAYMENT_FAILED"
      ? "bg-red-50 text-red-800"
      : order.status === "COMPLETED"
        ? "bg-stone-100 text-stone-700"
        : "bg-amber-50 text-amber-900";
  return (
    <span
      className={`inline-flex max-w-full rounded-full px-3 py-1 text-xs font-semibold ${color}`}
    >
      {orderStatusLabel(order)}
    </span>
  );
}

export function OrderItems({ order }: { order: Order }) {
  return (
    <ul className="divide-y divide-stone-100" aria-label="Các món trong đơn">
      {order.items.map((item) => (
        <li key={item.id} className="flex items-start gap-3 py-4">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-stone-100">
            {item.imageUrl?.startsWith("/images/") ? (
              <Image
                src={item.imageUrl}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid h-full place-items-center text-2xl"
              >
                ☕
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words font-semibold text-stone-900">
              {item.qty} × {item.name}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Size {item.size} · {toppingLabel(item.toppingIds)}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {formatPrice(item.unitPrice)} / ly
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-amber-900">
            {formatPrice(item.lineTotal)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function OrderProgress({ order }: { order: Order }) {
  const index = ["PAID", "PREPARING", "READY", "COMPLETED"].indexOf(
    order.status,
  );
  if (index < 0)
    return <p className="text-sm text-stone-600">{orderStatusLabel(order)}</p>;
  return (
    <ol
      aria-label="Tiến trình đơn hàng"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {["Đã thanh toán", "Đang pha chế", "Sẵn sàng nhận", "Hoàn tất"].map(
        (label, step) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={`rounded-xl border p-3 text-xs font-semibold ${step <= index ? "border-amber-200 bg-amber-50 text-amber-900" : "border-stone-200 text-stone-500"}`}
          >
            <span className="mb-2 block text-lg" aria-hidden="true">
              {step < index ? "✓" : step + 1}
            </span>
            {label}
          </li>
        ),
      )}
    </ol>
  );
}

export function PaymentAction({
  order,
  serverNow,
}: {
  order: Order;
  serverNow: number;
}) {
  if (canPay(order, serverNow))
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/checkout/${encodeURIComponent(order.id)}`}
          className={primaryButton}
        >
          Thanh toán
        </Link>
        <span className="text-sm text-stone-600">
          Còn {formatRemaining(Date.parse(order.expiresAt) - serverNow)} để
          thanh toán
        </span>
      </div>
    );
  if (order.status === "PENDING" || order.status === "PAYMENT_FAILED") {
    return (
      <p className="text-sm font-semibold text-red-700">
        Đã hết hạn thanh toán. Đơn đang chờ cập nhật trạng thái hủy.
      </p>
    );
  }
  return null;
}

export function OrderCard({
  order,
  serverNow,
}: {
  order: Order;
  serverNow: number;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="min-w-0 flex-1">
          <h2 className="break-all font-semibold text-stone-900">{order.id}</h2>
          <p className="mt-1 text-xs text-stone-500">
            Đặt lúc {formatDate(order.createdAt)}
          </p>
        </div>
        <StatusBadge order={order} />
      </div>
      <OrderItems order={order} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <Link
          href={`/orders/${encodeURIComponent(order.id)}`}
          className={secondaryButton}
        >
          Xem chi tiết
        </Link>
        <p className="font-semibold">
          Tổng tiền:{" "}
          <span className="text-amber-900">{formatPrice(order.total)}</span>
        </p>
      </div>
      {(order.status === "PENDING" || order.status === "PAYMENT_FAILED") && (
        <div className="mt-4">
          <PaymentAction order={order} serverNow={serverNow} />
        </div>
      )}
      {order.status === "PAID" && (
        <Link
          className="mt-4 inline-block text-sm font-semibold text-amber-800 underline"
          href={`/orders/${encodeURIComponent(order.id)}/confirmation`}
        >
          Xem xác nhận thanh toán
        </Link>
      )}
    </article>
  );
}

export function LoginPrompt({ returnTo }: { returnTo: string }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
      <h2 className="text-xl font-bold">Đăng nhập để xem đơn hàng</h2>
      <p className="mt-3 text-sm text-stone-600">
        Lịch sử và chi tiết đơn chỉ hiển thị cho tài khoản đã đặt đơn.
      </p>
      <Link
        className={`${primaryButton} mt-6`}
        href={`/login?redirect=${encodeURIComponent(returnTo)}`}
      >
        Đăng nhập
      </Link>
    </section>
  );
}

export function OrderLoading() {
  return (
    <div
      role="status"
      className="rounded-2xl border border-stone-200 bg-white p-8 text-stone-600"
    >
      Đang tải đơn hàng…
    </div>
  );
}

export function OrderError({
  error,
  retry,
  fetching,
}: {
  error: unknown;
  retry: () => void;
  fetching: boolean;
}) {
  const missing = error instanceof OrderApiError && error.status === 404;
  return (
    <section
      role="alert"
      className="rounded-2xl border border-red-200 bg-white p-8 text-center"
    >
      <h2 className="text-xl font-bold text-stone-900">
        {missing ? "Không tìm thấy đơn hàng" : "Chưa tải được đơn hàng"}
      </h2>
      <p className="mt-3 text-sm text-stone-600">
        {error instanceof Error
          ? error.message
          : "Vui lòng kiểm tra kết nối và thử lại."}
      </p>
      <button
        type="button"
        disabled={fetching}
        onClick={retry}
        className={`${secondaryButton} mt-6`}
      >
        {fetching ? "Đang tải…" : "Thử lại"}
      </button>
    </section>
  );
}
