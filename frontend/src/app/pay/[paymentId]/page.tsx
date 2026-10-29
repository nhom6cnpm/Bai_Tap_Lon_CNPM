"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatPrice } from "@/lib/formatPrice";
import {
  confirmGatewayPayment,
  getGatewayDetails,
  getPayment,
  PaymentApiError,
  type GatewayResult,
  type PaymentDetails,
} from "@/lib/payments/api";
import {
  clearActiveCheckout,
  getCartFingerprint,
  getCheckout,
  getPaymentSession,
  removeAttempt,
  savePaymentSession,
  type PaymentSession,
} from "@/lib/payments/storage";
import { ORDER_PAYMENT_TIMEOUT_MS } from "@/lib/payments/timeout";
import { useCart } from "@/store/useCart";
import { useOrderClock } from "@/hooks/useOrderHistory";
import { formatRemaining } from "@/lib/orderUtils";

const POLL_INTERVAL_MS = 2500;

function publicAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return window.location.origin;
  try {
    const url = new URL(configured);
    const current = new URL(window.location.origin);
    if (
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      !["localhost", "127.0.0.1"].includes(current.hostname)
    ) {
      return current.origin;
    }
    return url.origin;
  } catch {
    return window.location.origin;
  }
}

export default function PaymentGatewayPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [receivedAt, setReceivedAt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const checking = useRef(false);
  const completed = useRef(false);
  const now = useOrderClock(details?.serverTime, receivedAt);
  const remainingForOrder = details
    ? Date.parse(details.expiresAt) - now
    : null;
  const orderExpired =
    !!details &&
    details.status !== "SUCCESS" &&
    (details.orderStatus === "CANCELLED" ||
      (remainingForOrder !== null && remainingForOrder <= 0));

  const refreshStatus = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const payment = await getPayment(paymentId);
      setDetails(payment);
      setReceivedAt(Date.now());
      setError("");
      setNeedsLogin(false);
      if (payment.status === "SUCCESS" && !completed.current) {
        completed.current = true;
        const checkout = getCheckout(payment.orderId);
        if (
          checkout &&
          checkout.cartFingerprint ===
            getCartFingerprint(useCart.getState().items)
        )
          useCart.getState().clear();
        clearActiveCheckout(payment.orderId);
        const stored = getPaymentSession(paymentId);
        if (stored) removeAttempt(stored.orderId, stored.method);
        router.replace(
          `/orders/${encodeURIComponent(payment.orderId)}/confirmation`,
        );
      }
      if (payment.status === "FAILED") {
        const stored = getPaymentSession(paymentId);
        if (stored) removeAttempt(stored.orderId, stored.method);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không kiểm tra được trạng thái thanh toán.",
      );
      setNeedsLogin(cause instanceof PaymentApiError && cause.status === 401);
    } finally {
      checking.current = false;
    }
  }, [paymentId, router]);

  useEffect(() => {
    let active = true;
    const initial = window.setTimeout(() => {
      setAppUrl(publicAppUrl());
      const stored = getPaymentSession(paymentId);
      if (stored) {
        setSession(stored);
        setReady(true);
        void refreshStatus();
        return;
      }
      void getGatewayDetails(paymentId)
        .then((gateway) => {
          if (!active) return;
          const recovered: PaymentSession = {
            paymentId,
            orderId: gateway.orderId,
            method: gateway.method,
            amount: gateway.amount,
            startedAt: Date.now(),
          };
          savePaymentSession(recovered);
          setSession(recovered);
          void refreshStatus();
        })
        .catch((cause) => {
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : "Không tải được phiên thanh toán.",
            );
        })
        .finally(() => {
          if (active) setReady(true);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(initial);
    };
  }, [paymentId, refreshStatus]);

  useEffect(() => {
    if (
      !session ||
      details?.status === "SUCCESS" ||
      details?.status === "FAILED" ||
      timedOut ||
      orderExpired
    )
      return;
    const deadlineRemaining = details
      ? Date.parse(details.expiresAt) -
        Date.parse(details.serverTime) -
        Math.max(0, Date.now() - receivedAt)
      : Infinity;
    const remaining = Math.min(
      ORDER_PAYMENT_TIMEOUT_MS - (Date.now() - session.startedAt),
      deadlineRemaining,
    );
    const poll =
      remaining > 0
        ? window.setInterval(() => void refreshStatus(), POLL_INTERVAL_MS)
        : null;
    const timeout = window.setTimeout(
      () => setTimedOut(true),
      Math.max(0, remaining),
    );
    return () => {
      if (poll !== null) window.clearInterval(poll);
      window.clearTimeout(timeout);
    };
  }, [session, details, refreshStatus, timedOut, orderExpired, receivedAt]);

  async function submitResult(result: GatewayResult) {
    if (
      busy ||
      details?.status !== "PENDING" ||
      details.orderStatus !== "PENDING" ||
      orderExpired
    )
      return;
    setBusy(true);
    setActionError("");
    try {
      await confirmGatewayPayment(paymentId, result);
      await refreshStatus();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Không gửi được kết quả thanh toán.",
      );
    } finally {
      setBusy(false);
    }
  }

  function submitCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{12,19}$/.test(cardNumber.replace(/\s/g, ""))) {
      setActionError("Vui lòng nhập 12–19 chữ số thẻ giả để mô phỏng.");
      return;
    }
    setCardNumber("");
    void submitResult("SUCCESS");
  }

  if (!ready)
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-stone-600">
        Đang mở cổng thanh toán…
      </p>
    );
  if (!session) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Không mở được phiên thanh toán</h1>
        <p role="alert" className="mt-3 text-red-700">
          {error}
        </p>
        <Link
          href="/cart"
          className="mt-6 inline-block font-semibold text-amber-800 underline"
        >
          Về giỏ hàng
        </Link>
      </section>
    );
  }

  const qrUrl = appUrl
    ? `${appUrl}/mock-gateway/${encodeURIComponent(paymentId)}`
    : "";
  const qrNeedsLanAddress =
    qrUrl && ["localhost", "127.0.0.1"].includes(new URL(qrUrl).hostname);
  const status = details?.status;

  if (details?.status === "SUCCESS") {
    return (
      <p
        role="status"
        className="mx-auto max-w-xl px-4 py-12 text-center text-stone-600"
      >
        Đang mở xác nhận đơn hàng…
      </p>
    );
  }

  if (details?.status === "FAILED") {
    return (
      <section className="mx-auto max-w-xl px-4 py-12 text-center">
        <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-red-800">
            Thanh toán thất bại
          </h1>
          <p className="mt-3 break-all text-stone-600">
            {orderExpired
              ? "Đơn đã hết hạn hoặc đã bị hủy. Giỏ hàng vẫn được giữ nguyên."
              : `Giỏ hàng của bạn vẫn được giữ nguyên. Bạn có thể thử lại trên đơn ${details.orderId}.`}
          </p>
          {!orderExpired && (
            <button
              type="button"
              onClick={() =>
                router.push(`/checkout/${encodeURIComponent(details.orderId)}`)
              }
              className="mt-7 rounded-full bg-amber-800 px-6 py-3 font-semibold text-white"
            >
              Thử lại
            </button>
          )}
          {orderExpired && (
            <Link
              href={`/orders/${encodeURIComponent(details.orderId)}`}
              className="mt-5 inline-block font-semibold text-amber-800 underline"
            >
              Xem đơn hàng
            </Link>
          )}
          <Link
            href="/cart"
            className="mt-4 block font-semibold text-amber-800 underline"
          >
            Về giỏ hàng
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-800">
          BrewLite Pay
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {session.method === "WALLET"
            ? "Thanh toán bằng Ví"
            : "Thanh toán bằng Thẻ"}
        </h1>
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-amber-50 p-4">
          <span className="min-w-0 break-all">Đơn {session.orderId}</span>
          <strong className="shrink-0 text-xl text-amber-900">
            {formatPrice(details?.amount ?? session.amount)}
          </strong>
        </div>
        {session.method === "WALLET" ? (
          <div className="mt-7 text-center">
            {qrUrl && (
              <div className="inline-block rounded-2xl border border-stone-200 bg-white p-4">
                <QRCodeSVG
                  value={qrUrl}
                  size={220}
                  includeMargin
                  title="Mã QR thanh toán BrewLite Pay"
                />
              </div>
            )}
            <p className="mt-4 font-semibold">
              Quét mã bằng điện thoại để thanh toán
            </p>
            <p className="mt-2 break-all text-xs text-stone-500">{qrUrl}</p>
            {qrNeedsLanAddress && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Mã QR đang dùng địa chỉ localhost. Để quét bằng điện thoại, hãy
                mở ứng dụng qua địa chỉ mạng của máy tính.
              </p>
            )}
            <p className="mt-3 text-sm text-stone-600">
              Không có điện thoại? Dùng nút bên dưới để mô phỏng.
            </p>
          </div>
        ) : (
          <form id="mock-card-form" onSubmit={submitCard} className="mt-7">
            <label htmlFor="mock-card-number" className="font-semibold">
              Số thẻ giả
            </label>
            <input
              id="mock-card-number"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(event) => setCardNumber(event.target.value)}
              className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 focus:outline-2 focus:outline-amber-800"
            />
            <p className="mt-2 text-sm text-stone-500">
              Chỉ mô phỏng thanh toán. Không nhập số thẻ thật.
            </p>
          </form>
        )}

        {!details && !error && (
          <p role="status" className="mt-5 text-sm text-stone-600">
            Đang kiểm tra trạng thái thanh toán…
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
          >
            {error}
          </p>
        )}
        {actionError && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800"
          >
            {actionError}
          </p>
        )}
        {details && (
          <p
            role="status"
            className={`mt-4 text-sm font-semibold ${orderExpired ? "text-red-700" : "text-stone-600"}`}
          >
            {orderExpired
              ? "Đơn đã hết hạn hoặc đã bị hủy. Không thể tiếp tục thanh toán."
              : `Thời gian còn lại: ${formatRemaining(remainingForOrder ?? 0)}`}
          </p>
        )}
        {needsLogin && (
          <Link
            href={`/login?redirect=${encodeURIComponent(`/pay/${paymentId}`)}`}
            className="mt-3 block text-sm text-amber-800 underline"
          >
            Đăng nhập lại
          </Link>
        )}
        {timedOut && (
          <p role="status" className="mt-5 text-sm text-amber-900">
            Đã dừng tự kiểm tra sau thời gian chờ. Bạn vẫn có thể kiểm tra thủ
            công.
          </p>
        )}
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void submitResult("FAILED")}
            disabled={
              busy ||
              status !== "PENDING" ||
              orderExpired ||
              details?.orderStatus !== "PENDING"
            }
            className="rounded-xl border border-red-300 px-4 py-3 font-semibold text-red-800 disabled:opacity-50"
          >
            Giả lập lỗi
          </button>
          {session.method === "WALLET" ? (
            <button
              type="button"
              onClick={() => void submitResult("SUCCESS")}
              disabled={
                busy ||
                status !== "PENDING" ||
                orderExpired ||
                details?.orderStatus !== "PENDING"
              }
              className="rounded-xl bg-amber-800 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Đang xử lý…" : "Tôi đã thanh toán"}
            </button>
          ) : (
            <button
              form="mock-card-form"
              type="submit"
              disabled={
                busy ||
                status !== "PENDING" ||
                orderExpired ||
                details?.orderStatus !== "PENDING"
              }
              className="rounded-xl bg-amber-800 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Đang xử lý…" : "Xác nhận trả"}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refreshStatus()}
          className="mt-5 w-full text-sm font-semibold text-amber-800 underline"
        >
          Kiểm tra trạng thái
        </button>
      </div>
    </section>
  );
}
