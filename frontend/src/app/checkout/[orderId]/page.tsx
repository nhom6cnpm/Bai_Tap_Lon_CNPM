'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { formatPrice } from '@/lib/formatPrice';
import { getStoredToken } from '@/lib/auth';
import { createPayment, type PaymentMethod } from '@/lib/payments/api';
import { getCheckoutDeadlineMs } from '@/lib/payments/timeout';
import {
  getAttempt,
  getCheckout,
  saveAttempt,
  savePaymentSession,
  type CheckoutSnapshot,
} from '@/lib/payments/storage';

function newIdempotencyKey(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function CheckoutPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('WALLET');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const requestInFlight = useRef(false);

  useEffect(() => {
    const update = () => {
      setSnapshot(getCheckout(orderId));
      setLoaded(true);
      setNow(Date.now());
    };
    const initial = window.setTimeout(update, 0);
    const updateClock = () => setNow(Date.now());
    const timer = window.setInterval(updateClock, 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [orderId]);

  const remaining = snapshot && now !== null ? getCheckoutDeadlineMs(snapshot) - now : null;
  const expired = remaining !== null && remaining <= 0;

  async function handlePayment() {
    if (!snapshot || expired || requestInFlight.current) return;
    if (!getStoredToken()) {
      router.push(`/login?redirect=${encodeURIComponent(`/checkout/${orderId}`)}`);
      return;
    }

    const activeAttempt = (['WALLET', 'CARD'] as const)
      .map((option) => getAttempt(orderId, option))
      .find((attempt) => attempt?.paymentId);
    if (activeAttempt?.paymentId) {
      router.push(`/pay/${encodeURIComponent(activeAttempt.paymentId)}`);
      return;
    }

    requestInFlight.current = true;
    setPending(true);
    setError('');
    const previousAttempt = getAttempt(orderId, method);
    const idempotencyKey = previousAttempt?.idempotencyKey || newIdempotencyKey();
    saveAttempt({ orderId, method, idempotencyKey });
    try {
      const payment = await createPayment(orderId, method, idempotencyKey);
      saveAttempt({ orderId, method, idempotencyKey, paymentId: payment.paymentId });
      savePaymentSession({
        paymentId: payment.paymentId,
        orderId,
        method,
        amount: snapshot.total,
        startedAt: Date.now(),
      });
      router.push(`/pay/${encodeURIComponent(payment.paymentId)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tạo được phiên thanh toán. Vui lòng thử lại.');
    } finally {
      requestInFlight.current = false;
      setPending(false);
    }
  }

  if (!loaded) return <p className="mx-auto max-w-2xl px-4 py-12 text-stone-600">Đang tải thông tin đơn hàng…</p>;
  if (!snapshot) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Không tìm thấy thông tin đơn hàng</h1>
        <p className="mt-3 text-stone-600">Vui lòng quay lại giỏ hàng để tiếp tục.</p>
        <Link href="/cart" className="mt-6 inline-block rounded-full bg-amber-800 px-6 py-3 font-semibold text-white">Về giỏ hàng</Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 text-stone-900 sm:py-12">
      <Link href="/cart" className="text-sm font-semibold text-amber-800 hover:underline">← Giỏ hàng</Link>
      <div className="mt-5 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-800">BrewLite · Thanh toán</p>
        <h1 className="mt-2 text-3xl font-bold">Chọn cách thanh toán</h1>
        <p className="mt-2 text-stone-600">Mã đơn: <strong className="text-stone-900">{orderId}</strong></p>

        <div className="mt-6 flex items-center justify-between rounded-2xl bg-amber-50 p-5">
          <span className="font-medium">Tổng tiền đơn hàng</span>
          <strong className="text-2xl text-amber-900">{formatPrice(snapshot.total)}</strong>
        </div>
        <p role="status" className={`mt-4 text-sm font-semibold ${expired ? 'text-red-700' : 'text-stone-600'}`}>
          {expired ? 'Đơn đã hết hạn, vui lòng đặt lại.' : `Vui lòng thanh toán trong ${remaining === null ? '--:--' : formatRemaining(remaining)}`}
        </p>

        {!expired && (
          <fieldset className="mt-7">
            <legend className="font-semibold">Phương thức</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {([
                { id: 'WALLET', title: 'Ví điện tử', detail: 'Quét QR và xác nhận trên điện thoại' },
                { id: 'CARD', title: 'Thẻ', detail: 'Dùng số thẻ giả để mô phỏng' },
              ] as const).map((option) => (
                <label key={option.id} className={`cursor-pointer rounded-2xl border p-4 focus-within:outline-2 focus-within:outline-amber-800 ${method === option.id ? 'border-amber-800 bg-amber-50' : 'border-stone-200'}`}>
                  <input type="radio" name="payment-method" value={option.id} checked={method === option.id}
                    onChange={() => setMethod(option.id)} className="mr-2 accent-amber-800" />
                  <span className="font-semibold">{option.title}</span>
                  <span className="mt-2 block text-sm text-stone-600">{option.detail}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <button type="button" onClick={() => void handlePayment()} disabled={pending || expired}
          className="mt-7 w-full rounded-xl bg-amber-800 px-5 py-3 font-bold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? 'Đang tạo phiên thanh toán…' : `Thanh toán · ${formatPrice(snapshot.total)}`}
        </button>
      </div>
    </section>
  );
}
