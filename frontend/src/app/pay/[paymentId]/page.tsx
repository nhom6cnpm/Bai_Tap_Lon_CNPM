"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatPrice } from "@/lib/formatPrice";
import {
  getPayment,
  PaymentApiError,
  type PaymentDetails,
} from "@/lib/payments/api";
import {
  clearActiveCheckout,
  getCheckout,
  getCartFingerprint,
  removeAttempt,
} from "@/lib/payments/storage";
import { useCart } from "@/store/useCart";
import { useOrderClock, useOwnOrder } from "@/hooks/useOrderHistory";
import OrderCancellation from "@/components/orders/OrderCancellation";
import { useAuth } from "@/hooks/useAuth";
import { getStoredToken } from "@/lib/auth";
import { useHydrated } from "@/hooks/useHydrated";

// Customer screen asks the backend again every few seconds until staff decide
const POLL_INTERVAL_MS = 3000;

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

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function PaymentPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { token } = useAuth();
  const hydrated = useHydrated();
  if (!hydrated)
    return (
      <p role="status" className="p-8">
        Đang tải thanh toán…
      </p>
    );
  if (!token)
    return (
      <section className="p-8 text-center">
        <p>Vui lòng đăng nhập để xem thanh toán.</p>
        <Link
          className="underline"
          href={`/login?redirect=${encodeURIComponent(`/pay/${paymentId}`)}`}
        >
          Đăng nhập lại
        </Link>
      </section>
    );
  return <PaymentSession key={`${token}:${paymentId}`} paymentId={paymentId} />;
}

function PaymentSession({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [receivedAt, setReceivedAt] = useState(0);
  const now = useOrderClock(details?.serverTime, receivedAt);
  const ownOrder = useOwnOrder(details?.orderId ?? "");
  const cancellationPending =
    ownOrder.data?.cancelRequest?.status === "PENDING";
  const mounted = useRef(true);
  const [appUrl, setAppUrl] = useState("");
  const checking = useRef(false);
  const finished = useRef(false);

  const applyDetails = useCallback(
    (payment: PaymentDetails) => {
      setDetails(payment);
      setReceivedAt(Date.now());
      if (finished.current) return;
      if (
        payment.status === "SUCCESS" &&
        ["PAID", "PREPARING", "READY", "COMPLETED"].includes(
          payment.orderStatus ?? "",
        )
      ) {
        // Paid: only now is the cart emptied
        finished.current = true;
        const checkout = getCheckout(payment.orderId);
        if (
          checkout?.cartFingerprint ===
          getCartFingerprint(useCart.getState().items)
        )
          useCart.getState().clear();
        clearActiveCheckout(payment.orderId);
        removeAttempt(payment.orderId, payment.method);
        router.replace(
          `/orders/${encodeURIComponent(payment.orderId)}${payment.orderStatus === "PAID" ? "/confirmation" : ""}`,
        );
      } else if (payment.status === "FAILED") {
        // Rejected: cart kept, a new attempt (new Idempotency-Key) is allowed
        finished.current = true;
        removeAttempt(payment.orderId, payment.method);
      }
    },
    [router],
  );

  const refreshStatus = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    const requestToken = getStoredToken();
    try {
      const payment = await getPayment(paymentId);
      if (!mounted.current || getStoredToken() !== requestToken) return;
      applyDetails(payment);
      setError("");
      setNeedsLogin(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không kiểm tra được trạng thái thanh toán.",
      );
      setNeedsLogin(cause instanceof PaymentApiError && cause.status === 401);
    } finally {
      checking.current = false;
      setLoaded(true);
    }
  }, [paymentId, applyDetails]);

  useEffect(() => {
    mounted.current = true;
    const initial = window.setTimeout(() => {
      setAppUrl(publicAppUrl());
      void refreshStatus();
    }, 0);
    return () => {
      mounted.current = false;
      window.clearTimeout(initial);
    };
  }, [refreshStatus]);

  const deadline = details?.expiresAt ? Date.parse(details.expiresAt) : NaN;
  const remaining =
    Number.isFinite(deadline) && now !== null ? deadline - now : null;
  const waiting =
    details?.status === "PENDING" || details?.status === "TRANSFER_RECEIVED";
  const orderClosed = details?.orderStatus === "CANCELLED";

  useEffect(() => {
    if (!waiting || orderClosed) return;
    const poll = window.setInterval(
      () => void refreshStatus(),
      POLL_INTERVAL_MS,
    );
    return () => window.clearInterval(poll);
  }, [waiting, orderClosed, refreshStatus]);

  if (!loaded)
    return (
      <p className="mx-auto max-w-2xl px-4 py-12 text-stone-600">
        Đang tải phiên thanh toán…
      </p>
    );
  if (!details) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Không mở được phiên thanh toán</h1>
        <p role="alert" className="mt-3 text-red-700">
          {error}
        </p>
        {needsLogin && (
          <Link
            href={`/login?redirect=${encodeURIComponent(`/pay/${paymentId}`)}`}
            className="mt-4 block font-semibold text-amber-800 underline"
          >
            Đăng nhập lại
          </Link>
        )}
        <Link
          href="/cart"
          className="mt-6 inline-block font-semibold text-amber-800 underline"
        >
          Về giỏ hàng
        </Link>
      </section>
    );
  }

  if (details.status === "SUCCESS" && !orderClosed)
    return (
      <p role="status" className="mx-auto max-w-2xl px-4 py-12">
        Đang mở đơn hàng đã thanh toán…
      </p>
    );

  if (details.status === "FAILED" && !orderClosed) {
    return (
      <section className="mx-auto max-w-xl px-4 py-12 text-center">
        <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-red-800">
            Thanh toán thất bại
          </h1>
          <p className="mt-3 text-stone-600">
            Nhân viên chưa xác nhận được khoản thanh toán của đơn{" "}
            {details.orderId}.
          </p>
          {details.reviewNote && (
            <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
              Lý do: {details.reviewNote}
            </p>
          )}
          <p className="mt-3 text-stone-600">
            Giỏ hàng của bạn vẫn được giữ nguyên.
          </p>
          {ownOrder.data && !ownOrder.isError && (
            <OrderCancellation order={ownOrder.data} serverNow={now} />
          )}
          {!orderClosed && (remaining === null || remaining > 0) && (
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

  if (orderClosed) {
    return (
      <section className="mx-auto max-w-xl px-4 py-12 text-center">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold">
            Đơn hàng đã hết hạn hoặc bị hủy
          </h1>
          <p className="mt-3 text-stone-600">
            Bạn có thể về giỏ hàng để kiểm tra và chỉnh sửa các món đang có.
          </p>
          <Link
            href="/cart"
            className="mt-6 inline-block rounded-full bg-amber-800 px-6 py-3 font-semibold text-white"
          >
            Về giỏ hàng
          </Link>
        </div>
      </section>
    );
  }

  const isWallet = details.method === "WALLET";
  const received = details.status === "TRANSFER_RECEIVED";
  const expired = remaining !== null && remaining <= 0;
  // Ví: QR mở ngân hàng giả lập trên điện thoại. Thẻ: QR = mã đơn, nhân viên quét tại quầy.
  const mockBankPath = `/mock-bank/${encodeURIComponent(paymentId)}`;
  const qrValue = !appUrl
    ? details.orderId
    : isWallet
      ? `${appUrl}${mockBankPath}`
      : `${appUrl}/admin/payments?orderId=${encodeURIComponent(details.orderId)}`;
  const qrOnLocalhost =
    isWallet && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(appUrl);
  const canTransfer =
    isWallet &&
    details.status === "PENDING" &&
    !expired &&
    !needsLogin &&
    !cancellationPending &&
    !ownOrder.isPending &&
    !ownOrder.isError;

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-800">
          BrewLite · Thanh toán
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          {isWallet ? "Chuyển khoản / Ví điện tử" : "Thanh toán thẻ tại quầy"}
        </h1>
        <div className="mt-6 flex items-center justify-between rounded-2xl bg-amber-50 p-4">
          <span className="min-w-0 flex-1 break-all">
            Đơn {details.orderId}
          </span>
          <strong className="shrink-0 text-xl text-amber-900">
            {formatPrice(details.amount)}
          </strong>
        </div>
        {remaining !== null && (
          <p
            role="status"
            className={`mt-3 text-sm font-semibold ${expired && !received ? "text-red-700" : "text-stone-600"}`}
          >
            {received && expired
              ? "Tiền đã về đúng hạn, đơn được giữ lại chờ nhân viên xác nhận."
              : expired
                ? "Đã quá thời gian chờ thanh toán."
                : `Thời gian còn lại: ${formatRemaining(remaining)}`}
          </p>
        )}

        <div className="mt-7 text-center">
          <div className="inline-block rounded-2xl border border-stone-200 bg-white p-4">
            <QRCodeSVG
              value={qrValue}
              size={200}
              marginSize={2}
              title={
                isWallet
                  ? `Mã QR chuyển khoản đơn ${details.orderId}`
                  : `Mã QR đơn hàng ${details.orderId}`
              }
            />
          </div>
          <p className="mt-3 text-sm text-stone-600">
            {isWallet
              ? "Quét mã bằng điện thoại để mở ngân hàng giả lập và chuyển tiền."
              : "Mã QR đơn hàng: nhân viên quét để đối chiếu đơn của bạn."}
          </p>
          {qrOnLocalhost && (
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              Mã QR đang dùng địa chỉ localhost nên điện thoại không mở được. Mở
              ứng dụng bằng địa chỉ mạng của máy tính (xem README), hoặc dùng
              nút “Mở ngân hàng giả lập” bên dưới.
            </p>
          )}
        </div>

        <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-stone-700">
          {isWallet ? (
            <>
              <li>
                Quét mã QR bằng điện thoại, hoặc bấm{" "}
                <strong>“Mở ngân hàng giả lập”</strong>.
              </li>
              <li>
                Kiểm tra số tiền <strong>{formatPrice(details.amount)}</strong>{" "}
                và nội dung{" "}
                <strong className="break-all font-mono">
                  {details.orderId}
                </strong>
                , rồi bấm <strong>“Chuyển tiền”</strong>.
              </li>
              <li>
                Nhân viên đối chiếu tiền đã về và xác nhận, màn hình sẽ tự cập
                nhật.
              </li>
            </>
          ) : (
            <>
              <li>
                Đưa mã QR hoặc mã đơn{" "}
                <strong className="break-all font-mono">
                  {details.orderId}
                </strong>{" "}
                cho nhân viên tại quầy.
              </li>
              <li>
                Quẹt thẻ thanh toán{" "}
                <strong>{formatPrice(details.amount)}</strong>.
              </li>
              <li>Nhân viên xác nhận, màn hình sẽ tự cập nhật.</li>
            </>
          )}
        </ol>

        {received ? (
          <div
            role="status"
            className="mt-7 flex items-center gap-3 rounded-2xl bg-sky-50 p-4 text-sky-900"
          >
            <span
              aria-hidden="true"
              className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-sky-700 border-t-transparent"
            />
            <span>
              <strong>Đã nhận tiền, đang chờ nhân viên xác nhận…</strong>
              <br />
              <span className="text-sm">
                Ngân hàng giả lập đã ghi nhận khoản chuyển. Không cần chuyển
                lại.
              </span>
            </span>
          </div>
        ) : isWallet ? (
          canTransfer && (
            <a
              href={mockBankPath}
              target="_blank"
              rel="noopener"
              className="mt-7 block w-full rounded-xl bg-amber-800 px-4 py-3 text-center font-bold text-white hover:bg-amber-900"
            >
              Mở ngân hàng giả lập
            </a>
          )
        ) : (
          <p
            role="status"
            className="mt-7 rounded-2xl bg-stone-50 p-4 text-sm text-stone-700"
          >
            Đang chờ nhân viên xác nhận thanh toán tại quầy…
          </p>
        )}
        {ownOrder.data && !ownOrder.isError && (
          <OrderCancellation order={ownOrder.data} serverNow={now} />
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
          >
            {error}
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
