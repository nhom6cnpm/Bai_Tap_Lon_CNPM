'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { formatPrice } from '@/lib/formatPrice';
import { listAdminPayments, reviewPayment, type AdminPayment, type AdminPaymentFilter } from '@/lib/admin/payments';
import { PaymentApiError, type PaymentStatus } from '@/lib/payments/api';

// Polling (no WebSocket/SSE): ask the backend again every few seconds
const POLL_INTERVAL_MS = 4000;
const TOAST_MS = 6000;
const BASE_TITLE = 'Xác nhận thanh toán · BrewLite';

const STATUS_LABEL: Record<PaymentStatus, { text: string; className: string }> = {
  PENDING: { text: 'Chưa báo chuyển tiền', className: 'bg-stone-100 text-stone-700' },
  CUSTOMER_REPORTED: { text: 'Khách báo đã chuyển', className: 'bg-sky-100 text-sky-900' },
  SUCCESS: { text: 'Đã xác nhận', className: 'bg-green-100 text-green-800' },
  FAILED: { text: 'Đã từ chối', className: 'bg-red-100 text-red-800' },
};

interface Toast {
  id: string;
  text: string;
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
    oscillator.onended = () => void ctx.close();
  } catch {
    // Browsers may block sound until the page has been clicked once
  }
}

function formatTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatRemaining(expiresAt: string | null, now: number | null): string {
  if (!expiresAt || now === null) return '—';
  const ms = Date.parse(expiresAt) - now;
  if (!Number.isFinite(ms)) return '—';
  if (ms <= 0) return 'Quá hạn';
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function AdminPaymentsBoard() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AdminPaymentFilter>('ACTIVE');
  const [orderSearch, setOrderSearch] = useState(() => searchParams.get('orderId') ?? '');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const seenReported = useRef<Set<string> | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, []);

  const pushToast = useCallback((text: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, text }]);
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), TOAST_MS);
  }, []);

  // Detect customers who just pressed "Tôi đã chuyển tiền" since the last poll
  const notifyNewReports = useCallback((rows: AdminPayment[]) => {
    const reported = rows.filter((row) => row.status === 'CUSTOMER_REPORTED');
    if (seenReported.current === null) {
      seenReported.current = new Set(reported.map((row) => row.paymentId));
      return;
    }
    const fresh = reported.filter((row) => !seenReported.current?.has(row.paymentId));
    fresh.forEach((row) => {
      seenReported.current?.add(row.paymentId);
      pushToast(`Đơn ${row.orderId} báo đã chuyển ${formatPrice(row.amount)}`);
    });
    if (fresh.length > 0) playBeep();
  }, [pushToast]);

  const query = useQuery({
    queryKey: ['admin-payments', filter, orderSearch.trim()],
    queryFn: async () => {
      const rows = await listAdminPayments(filter, orderSearch);
      notifyNewReports(rows);
      return rows;
    },
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    retry: false,
  });

  const rows = query.data ?? [];
  const waitingCount = rows.filter((row) => row.status === 'CUSTOMER_REPORTED').length;

  // Waiting count in the browser tab, visible even when staff are on another tab
  useEffect(() => {
    document.title = waitingCount > 0 ? `(${waitingCount}) ${BASE_TITLE}` : BASE_TITLE;
  }, [waitingCount]);
  useEffect(() => () => { document.title = 'BrewLite'; }, []);

  const review = useMutation({
    mutationFn: ({ paymentId, decision, note }: { paymentId: string; decision: 'confirm' | 'reject'; note?: string }) =>
      reviewPayment(paymentId, decision, note),
    onMutate: () => setActionError(''),
    onSuccess: (payment, variables) => {
      pushToast(variables.decision === 'confirm'
        ? `Đã xác nhận đơn ${payment.orderId} → PAID`
        : `Đã từ chối đơn ${payment.orderId} → PAYMENT_FAILED`);
    },
    onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Không xử lý được thanh toán.'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['admin-payments'] }),
  });

  function handleConfirm(row: AdminPayment) {
    if (window.confirm(`Xác nhận đã nhận ${formatPrice(row.amount)} cho đơn ${row.orderId}?`)) {
      review.mutate({ paymentId: row.paymentId, decision: 'confirm' });
    }
  }

  function handleReject(row: AdminPayment) {
    const note = window.prompt(`Từ chối thanh toán đơn ${row.orderId}?\nLý do (khách sẽ thấy):`, 'Chưa nhận được tiền');
    if (note !== null) review.mutate({ paymentId: row.paymentId, decision: 'reject', note });
  }

  const loadError = query.error;
  const forbidden = loadError instanceof PaymentApiError && loadError.status === 403;
  const expired = loadError instanceof PaymentApiError && loadError.status === 401;

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-800">Quản trị</p>
          <h1 className="mt-1 text-3xl font-bold text-stone-900">Xác nhận thanh toán</h1>
          <p className="mt-1 text-sm text-stone-600">Tự làm mới mỗi {POLL_INTERVAL_MS / 1000} giây · {waitingCount} khách đang chờ xác nhận</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
            placeholder="Tìm mã đơn (ORD-…)"
            aria-label="Tìm theo mã đơn"
            className="w-52 rounded-xl border border-stone-300 px-3 py-2 text-sm focus:outline-2 focus:outline-amber-800"
          />
          {(['ACTIVE', 'ALL'] as const).map((option) => (
            <button key={option} type="button" onClick={() => setFilter(option)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === option ? 'bg-amber-800 text-white' : 'border border-stone-300 text-stone-700 hover:bg-stone-100'}`}>
              {option === 'ACTIVE' ? 'Đang chờ' : 'Tất cả'}
            </button>
          ))}
        </div>
      </div>

      {actionError && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}

      <div className="mt-6">
        {query.isPending ? (
          <p className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-600">Đang tải danh sách thanh toán…</p>
        ) : loadError && rows.length === 0 ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-white p-8 text-center">
            <p className="font-semibold text-red-800">
              {forbidden ? 'Tài khoản này không có quyền quản trị.' : expired ? 'Phiên đăng nhập đã hết hạn.' : loadError.message}
            </p>
            {expired && <Link href="/login?redirect=/admin/payments" className="mt-3 inline-block font-semibold text-amber-800 underline">Đăng nhập lại</Link>}
            {!forbidden && !expired && (
              <button type="button" onClick={() => void query.refetch()} className="mt-3 font-semibold text-amber-800 underline">Thử lại</button>
            )}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-600">
            {orderSearch.trim() ? `Không có thanh toán nào cho đơn “${orderSearch.trim()}”.` : 'Không có thanh toán chờ xác nhận.'}
          </p>
        ) : (
          <ul className="grid gap-3">
            {rows.map((row) => {
              const label = STATUS_LABEL[row.status];
              const active = row.status === 'PENDING' || row.status === 'CUSTOMER_REPORTED';
              const busy = review.isPending && review.variables?.paymentId === row.paymentId;
              return (
                <li key={row.paymentId}
                  className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${row.status === 'CUSTOMER_REPORTED' ? 'border-sky-300 ring-1 ring-sky-200' : 'border-stone-200'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-stone-900">{row.orderId}</p>
                      <p className="truncate text-sm text-stone-600">{row.customerEmail ?? 'Khách hàng'} · {row.itemCount} món</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${label.className}`}>{label.text}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
                    <div><dt className="text-stone-500">Số tiền</dt><dd className="font-bold text-amber-900">{formatPrice(row.amount)}</dd></div>
                    <div><dt className="text-stone-500">Phương thức</dt><dd>{row.method === 'WALLET' ? 'Chuyển khoản / Ví' : 'Thẻ tại quầy'}</dd></div>
                    <div><dt className="text-stone-500">Tạo lúc</dt><dd>{formatTime(row.createdAt)}</dd></div>
                    <div><dt className="text-stone-500">Khách báo lúc</dt><dd>{formatTime(row.reportedAt)}</dd></div>
                    <div><dt className="text-stone-500">{active ? 'Còn lại' : 'Trạng thái đơn'}</dt><dd>{active ? formatRemaining(row.expiresAt, now) : row.orderStatus ?? '—'}</dd></div>
                  </dl>
                  {row.reviewNote && <p className="mt-2 text-sm text-stone-600">Ghi chú: {row.reviewNote}</p>}
                  {active && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleConfirm(row)} disabled={busy}
                        className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">
                        {busy && review.variables?.decision === 'confirm' ? 'Đang xác nhận…' : 'Xác nhận đã nhận tiền'}
                      </button>
                      <button type="button" onClick={() => handleReject(row)} disabled={busy}
                        className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50">
                        {busy && review.variables?.decision === 'reject' ? 'Đang từ chối…' : 'Từ chối'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div aria-live="polite" className="fixed bottom-4 right-4 z-20 grid w-[min(22rem,calc(100vw-2rem))] gap-2">
        {toasts.map((toast) => (
          <p key={toast.id} className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-lg">{toast.text}</p>
        ))}
      </div>
    </section>
  );
}

function AdminGate() {
  const { user, isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (!mounted) return <p className="mx-auto max-w-6xl px-4 py-12 text-stone-600">Đang tải…</p>;
  if (!isAuthenticated) {
    return (
      <section className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Trang dành cho nhân viên</h1>
        <p className="mt-3 text-stone-600">Vui lòng đăng nhập bằng tài khoản quản trị.</p>
        <Link href="/login?redirect=/admin/payments" className="mt-6 inline-block rounded-full bg-amber-800 px-6 py-3 font-semibold text-white">Đăng nhập</Link>
      </section>
    );
  }
  if (user?.role !== 'ADMIN') {
    return (
      <section className="mx-auto max-w-xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold">Không có quyền truy cập</h1>
        <p className="mt-3 text-stone-600">Chỉ nhân viên cửa hàng mới xem được trang này.</p>
        <Link href="/menu" className="mt-6 inline-block font-semibold text-amber-800 underline">Về Menu</Link>
      </section>
    );
  }
  return <AdminPaymentsBoard />;
}

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-6xl px-4 py-12 text-stone-600">Đang tải…</p>}>
      <AdminGate />
    </Suspense>
  );
}
