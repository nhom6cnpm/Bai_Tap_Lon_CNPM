"use client";
import PriceSummary from "@/components/PriceSummary";
import OrderRewards from "./OrderRewards";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOwnOrder, useOrderClock } from "@/hooks/useOrderHistory";
import { canPay, formatRemaining, orderStatusLabel } from "@/lib/orderUtils";
import { formatPrice } from "@/lib/formatPrice";
import {
  createPayment,
  getPayment,
  PaymentApiError,
  type PaymentMethod,
} from "@/lib/payments/api";
import {
  getAttempt,
  getCartFingerprint,
  removeAttempt,
  saveAttempt,
  saveCheckout,
  savePaymentSession,
} from "@/lib/payments/storage";
import {
  LoginPrompt,
  OrderError,
  OrderLoading,
  primaryButton,
  secondaryButton,
} from "./OrderParts";

function newIdempotencyKey(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function OrderCheckout({ id }: { id: string }) {
  const query = useOwnOrder(id);
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("WALLET");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const order = query.data;
  const now = useOrderClock(order?.serverTime, query.dataUpdatedAt);
  const payable = order ? canPay(order, now) : false;

  async function pay() {
    if (!order || !payable || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const refreshed = await query.refetch();
      if (refreshed.isError || !refreshed.data)
        throw new Error("Chưa cập nhật được đơn hàng. Vui lòng thử lại.");
      const current = refreshed.data;
      if (!current.canPay)
        throw new Error("Đơn không còn chờ thanh toán hoặc đã hết hạn.");
      // Recover an existing pending attempt, including one opened on an earlier visit.
      for (const option of ["WALLET", "CARD"] as const) {
        const stored = getAttempt(id, option);
        if (!stored?.paymentId) continue;
        try {
          const previous = await getPayment(stored.paymentId);
          if (
            previous.status === "PENDING" ||
            previous.status === "CUSTOMER_REPORTED"
          ) {
            router.push(`/pay/${encodeURIComponent(previous.paymentId)}`);
            return;
          }
          if (previous.status === "SUCCESS") {
            router.push(`/orders/${encodeURIComponent(id)}/confirmation`);
            return;
          }
          removeAttempt(id, option);
        } catch (cause) {
          if (cause instanceof PaymentApiError && cause.status === 404)
            removeAttempt(id, option);
          else throw cause;
        }
      }
      saveCheckout({
        orderId: id,
        total: current.total,
        createdAt: current.createdAt,
        expiresAt: current.expiresAt,
        cartFingerprint: getCartFingerprint(current.items),
      });
      const key = getAttempt(id, method)?.idempotencyKey || newIdempotencyKey();
      saveAttempt({ orderId: id, method, idempotencyKey: key });
      const payment = await createPayment(id, method, key);
      saveAttempt({
        orderId: id,
        method,
        idempotencyKey: key,
        paymentId: payment.paymentId,
      });
      savePaymentSession({
        paymentId: payment.paymentId,
        orderId: id,
        method,
        amount: current.total,
        startedAt: Date.now(),
      });
      router.push(`/pay/${encodeURIComponent(payment.paymentId)}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không tạo được phiên thanh toán. Vui lòng thử lại.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (!query.hydrated || (query.authenticated && query.isPending))
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <OrderLoading />
      </div>
    );
  if (!query.authenticated)
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <LoginPrompt returnTo={`/checkout/${encodeURIComponent(id)}`} />
      </div>
    );
  if (query.isError || !order)
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <OrderError
          error={query.error}
          retry={() => void query.refetch()}
          fetching={query.isFetching}
        />
      </div>
    );
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8 text-stone-900 sm:py-10">
      <Link
        href={`/orders/${encodeURIComponent(id)}`}
        className="text-sm font-semibold text-amber-800 hover:underline"
      >
        ← Chi tiết đơn hàng
      </Link>
      <div className="mt-5 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Chọn cách thanh toán</h1>
        <p className="mt-3 break-all text-sm text-stone-600">
          Mã đơn: <strong className="text-stone-900">{id}</strong>
        </p>
        <PriceSummary totals={order} />
        <OrderRewards order={order} compact />
        <p
          role="status"
          className={`mt-4 text-sm font-semibold ${payable ? "text-stone-600" : "text-red-700"}`}
        >
          {payable
            ? `Vui lòng thanh toán trong ${formatRemaining(Date.parse(order.expiresAt) - now)}`
            : ["PENDING", "PAYMENT_FAILED", "CANCELLED"].includes(order.status)
              ? "Đơn đã hết hạn hoặc đã bị hủy. Vui lòng xem lại đơn hàng."
              : orderStatusLabel(order)}
        </p>
        {payable && (
          <fieldset disabled={pending} className="mt-6">
            <legend className="font-semibold">Phương thức</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    id: "WALLET",
                    title: "Ví điện tử",
                    detail: "Báo đã chuyển tiền và chờ nhân viên xác nhận",
                  },
                  {
                    id: "CARD",
                    title: "Thẻ tại quầy",
                    detail: "Nhân viên xác nhận sau khi quẹt thẻ",
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.id}
                  className={`cursor-pointer rounded-2xl border p-4 focus-within:outline-2 focus-within:outline-amber-800 ${method === option.id ? "border-amber-800 bg-amber-50" : "border-stone-200"}`}
                >
                  <input
                    type="radio"
                    name="payment-method"
                    checked={method === option.id}
                    onChange={() => setMethod(option.id)}
                    className="mr-2 accent-amber-800"
                  />
                  <span className="font-semibold">{option.title}</span>
                  <span className="mt-2 block text-sm text-stone-600">
                    {option.detail}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        {payable && (
          <button
            type="button"
            onClick={() => void pay()}
            disabled={pending || query.isFetching}
            className={`${primaryButton} mt-7 w-full`}
          >
            {pending
              ? "Đang tạo phiên thanh toán…"
              : `Thanh toán · ${formatPrice(order.total)}`}
          </button>
        )}
        {!payable && (
          <Link
            href={`/orders/${encodeURIComponent(id)}${order.status === "PAID" ? "/confirmation" : ""}`}
            className={`${secondaryButton} mt-6 w-full`}
          >
            Xem đơn hàng
          </Link>
        )}
      </div>
    </section>
  );
}
