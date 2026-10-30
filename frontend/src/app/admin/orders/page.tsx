"use client";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useHydrated } from "@/hooks/useHydrated";
import { useOrderClock } from "@/hooks/useOrderHistory";
import {
  listCancellationRequests,
  reviewCancellation,
} from "@/lib/orders/cancellation";
import { formatDate } from "@/lib/orderUtils";
import { formatPrice } from "@/lib/formatPrice";
import { OrderItems, StatusBadge } from "@/components/orders/OrderParts";
import PriceSummary from "@/components/PriceSummary";
import type { Order } from "@/types/order";

export default function AdminOrdersPage() {
  const { token, user } = useAuth();
  const hydrated = useHydrated();
  if (!hydrated) return <p className="p-8">Đang tải…</p>;
  if (!token)
    return (
      <section className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-bold">Trang dành cho nhân viên</h1>
        <Link
          href="/login?redirect=/admin/orders"
          className="mt-4 inline-block text-amber-800 underline"
        >
          Đăng nhập
        </Link>
      </section>
    );
  if (user?.role !== "ADMIN")
    return (
      <section className="p-8 text-center">
        <h1 className="text-2xl font-bold">Không có quyền truy cập</h1>
        <p>Chỉ nhân viên cửa hàng mới xem được trang này.</p>
      </section>
    );
  return <CancellationBoard key={token} token={token} />;
}

function CancellationBoard({ token }: { token: string }) {
  const [notice, setNotice] = useState("");
  const [sound, setSound] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const notify = useCallback(
    (rows: Order[]) => {
      const ids = rows.flatMap((row) =>
        row.cancelRequest ? [row.cancelRequest.id] : [],
      );
      const fresh = seen.current
        ? ids.filter((id) => !seen.current?.has(id))
        : [];
      seen.current = new Set(ids);
      if (!fresh.length) return;
      setNotice(`Có ${fresh.length} yêu cầu hủy mới.`);
      if (sound) {
        try {
          const audio = new AudioContext();
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          gain.gain.value = 0.1;
          oscillator.connect(gain).connect(audio.destination);
          oscillator.start();
          oscillator.stop(audio.currentTime + 0.2);
          oscillator.onended = () => void audio.close();
        } catch {
          /* Sound may be blocked until staff interact with the page. */
        }
      }
    },
    [sound],
  );
  const query = useQuery({
    queryKey: ["admin-cancellations", token],
    queryFn: async ({ signal }) => {
      const rows = await listCancellationRequests(token, signal);
      notify(rows);
      return rows;
    },
    refetchInterval: 4_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const now = useOrderClock(query.data?.[0]?.serverTime, query.dataUpdatedAt);
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8">
      <nav
        aria-label="Quản trị"
        className="mb-6 flex flex-wrap gap-3 text-sm font-semibold"
      >
        <Link
          href="/admin/payments"
          className="rounded-full border border-stone-200 px-4 py-2"
        >
          Thanh toán
        </Link>
        <Link
          href="/admin/orders"
          aria-current="page"
          className="rounded-full bg-amber-100 px-4 py-2 text-amber-900"
        >
          Đơn hàng
        </Link>
      </nav>
      <h1 className="text-2xl font-bold">Yêu cầu hủy đơn</h1>
      <p className="mt-2 text-sm text-stone-600">
        Xử lý yêu cầu hủy trước khi xác nhận thanh toán. Đơn chưa thanh toán vẫn
        tự hết hạn theo thời gian đã chốt.
      </p>
      <div className="my-4 flex flex-wrap items-center gap-3">
        <button
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          className="rounded-xl border border-stone-300 px-4 py-2 text-sm"
        >
          Cập nhật danh sách
        </button>
        <label className="text-sm">
          <input
            type="checkbox"
            checked={sound}
            onChange={(event) => setSound(event.target.checked)}
          />{" "}
          Âm báo yêu cầu mới
        </label>
      </div>
      {notice && (
        <div
          role="status"
          className="my-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm"
        >
          <span>{notice}</span>
          <button aria-label="Đóng thông báo" onClick={() => setNotice("")}>
            ✕
          </button>
        </div>
      )}
      {query.isPending && <p role="status">Đang tải yêu cầu…</p>}
      {query.isError && (
        <p role="alert" className="text-red-800">
          {query.error.message}
        </p>
      )}
      {!query.isError && query.data?.length === 0 && (
        <p className="rounded-2xl border border-stone-200 p-6">
          Không có yêu cầu hủy đang chờ.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {!query.isError &&
          query.data?.map((order) => (
            <ReviewCard
              key={order.cancelRequest?.id}
              order={order}
              token={token}
              serverNow={now}
            />
          ))}
      </div>
    </section>
  );
}

function ReviewCard({
  order,
  token,
  serverNow,
}: {
  order: Order;
  token: string;
  serverNow: number;
}) {
  const [note, setNote] = useState("");
  const client = useQueryClient();
  const request = order.cancelRequest!;
  const expired =
    ["PENDING", "PAYMENT_FAILED"].includes(order.status) &&
    Date.parse(order.expiresAt) <= serverNow;
  const action = useMutation({
    mutationFn: (approve: boolean) =>
      reviewCancellation(order.id, request.id, approve, note.trim(), token),
    onSettled: () => {
      void client.invalidateQueries({
        queryKey: ["admin-cancellations", token],
      });
      void client.invalidateQueries({ queryKey: ["admin-payments"] });
    },
  });
  function decide(approve: boolean) {
    if (action.isPending || expired) return;
    if (
      window.confirm(
        approve
          ? `Đồng ý hủy đơn ${order.id}?`
          : `Từ chối yêu cầu hủy đơn ${order.id}?`,
      )
    )
      action.mutate(approve);
  }
  return (
    <article className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <h2 className="break-all font-semibold">{order.id}</h2>
      <div className="mt-2">
        <StatusBadge order={order} />
      </div>
      <p className="mt-3 break-words text-sm">Lý do: {request.reason}</p>
      <p className="mt-1 text-xs text-stone-500">
        Yêu cầu lúc {formatDate(request.requestedAt)}
      </p>
      <OrderItems order={order} />
      <PriceSummary totals={order} />
      {order.status === "PAID" && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Đã ghi nhận {formatPrice(order.total)}. Hệ thống không tự hoàn tiền.
          Cần ghi chú cách xử lý tiền trước khi đồng ý hủy.
        </p>
      )}
      {expired && (
        <p role="status" className="mt-3 text-sm text-red-800">
          Đơn đã quá hạn thanh toán, đang chờ hệ thống đóng yêu cầu.
        </p>
      )}
      <label className="mt-4 block text-sm font-semibold">
        Ghi chú xử lý / lý do từ chối
        <textarea
          aria-label="Ghi chú xử lý / lý do từ chối"
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="mt-2 block w-full rounded-xl border border-stone-300 p-3 font-normal"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={
            action.isPending ||
            expired ||
            (order.status === "PAID" && !note.trim())
          }
          onClick={() => decide(true)}
          className="rounded-xl bg-amber-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Đồng ý hủy
        </button>
        <button
          disabled={action.isPending || expired || !note.trim()}
          onClick={() => decide(false)}
          className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50"
        >
          Từ chối hủy
        </button>
      </div>
      {action.error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {action.error.message}
        </p>
      )}
    </article>
  );
}
