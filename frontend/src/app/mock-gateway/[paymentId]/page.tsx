'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { formatPrice } from '@/lib/formatPrice';
import { confirmGatewayPayment, getGatewayDetails, type GatewayDetails, type GatewayResult } from '@/lib/payments/api';

export default function MobileGatewayPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [details, setDetails] = useState<GatewayDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setDetails(await getGatewayDetails(paymentId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được phiên thanh toán.');
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadDetails(), 0);
    return () => window.clearTimeout(initial);
  }, [loadDetails]);

  async function confirm(result: GatewayResult) {
    if (busy || details?.status !== 'PENDING') return;
    setBusy(true);
    setError('');
    try {
      await confirmGatewayPayment(paymentId, result);
      setDetails(await getGatewayDetails(paymentId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xác nhận được thanh toán.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-md px-4 py-8 text-stone-900">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-widest text-amber-800">BrewLite Pay</p>
        <h1 className="mt-2 text-2xl font-bold">Xác nhận thanh toán</h1>
        {loading && <p role="status" className="mt-6 text-stone-600">Đang tải phiên thanh toán…</p>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {!loading && error && <button type="button" onClick={() => void loadDetails()} className="mt-4 font-semibold text-amber-800 underline">Thử lại</button>}
        {details && (
          <>
            <div className="mt-6 rounded-2xl bg-amber-50 p-5">
              <p className="text-sm text-stone-600">Mã đơn</p>
              <p className="mt-1 font-bold">{details.orderId}</p>
              <p className="mt-4 text-sm text-stone-600">Số tiền</p>
              <p className="mt-1 text-3xl font-bold text-amber-900">{formatPrice(details.amount)}</p>
              <p className="mt-4 text-sm text-stone-600">Phương thức: {details.method === 'WALLET' ? 'Ví điện tử' : 'Thẻ'}</p>
            </div>
            {details.status === 'PENDING' ? (
              <div className="mt-6 grid gap-3">
                <button type="button" disabled={busy} onClick={() => void confirm('SUCCESS')}
                  className="min-h-12 rounded-xl bg-amber-800 px-5 py-3 font-bold text-white disabled:opacity-50">
                  {busy ? 'Đang xử lý…' : 'Xác nhận trả'}
                </button>
                <button type="button" disabled={busy} onClick={() => void confirm('FAILED')}
                  className="min-h-12 rounded-xl border border-red-300 px-5 py-3 font-semibold text-red-800 disabled:opacity-50">Giả lập lỗi</button>
              </div>
            ) : (
              <div role="status" className={`mt-6 rounded-xl p-4 font-semibold ${details.status === 'SUCCESS' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {details.status === 'SUCCESS' ? 'Đã thanh toán thành công. Bạn có thể quay lại máy tính.' : 'Thanh toán thất bại. Hãy quay lại máy tính để thử lại.'}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
