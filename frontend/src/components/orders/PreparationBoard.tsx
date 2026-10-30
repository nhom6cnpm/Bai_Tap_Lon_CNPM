"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  advancePreparation,
  listPreparationOrders,
  type PreparationTarget,
} from "@/lib/admin/orders";
import { formatDate } from "@/lib/orderUtils";
import { formatPrice } from "@/lib/formatPrice";
import type { Order } from "@/types/order";
import { OrderItems } from "./OrderParts";

const columns = [
  {
    status: "PAID",
    label: "Chờ pha",
    action: "Bắt đầu pha",
    next: "PREPARING",
  },
  { status: "PREPARING", label: "Đang pha", action: "Pha xong", next: "READY" },
  {
    status: "READY",
    label: "Sẵn sàng nhận",
    action: "Khách đã nhận",
    next: "COMPLETED",
  },
] as const;

export default function PreparationBoard({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["admin-preparation", token],
    queryFn: ({ signal }) => listPreparationOrders(token, signal),
    refetchInterval: 4_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  return (
    <section
      aria-label="Bảng pha chế"
      className="mt-8 border-t border-stone-200 pt-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Bảng pha chế</h2>
          <p className="mt-1 text-sm text-stone-600">
            Cập nhật khi bắt đầu pha, pha xong và giao món cho khách.
          </p>
        </div>
        <button
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          className="rounded-xl border border-stone-300 px-4 py-2 text-sm"
        >
          Cập nhật bảng pha chế
        </button>
      </div>
      {query.isPending && <p role="status">Đang tải bảng pha chế…</p>}
      {query.isError && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
        >
          {query.error.message}
        </p>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {columns.map((column) => {
          const orders = query.isError
            ? []
            : (query.data?.filter((order) => order.status === column.status) ??
              []);
          return (
            <section
              key={column.status}
              aria-label={column.label}
              className="min-w-0 rounded-2xl bg-stone-50 p-3"
            >
              <h3 className="mb-3 flex items-center justify-between gap-2 font-bold text-stone-800">
                {column.label}
                <span className="rounded-full bg-white px-2 py-1 text-xs">
                  {orders.length}
                </span>
              </h3>
              <div className="space-y-3">
                {orders.map((order) => (
                  <PreparationCard
                    key={order.id}
                    order={order}
                    token={token}
                    target={column.next}
                    actionLabel={column.action}
                  />
                ))}
              </div>
              {!query.isPending && !query.isError && !orders.length && (
                <p className="p-3 text-sm text-stone-500">Chưa có đơn.</p>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function PreparationCard({
  order,
  token,
  target,
  actionLabel,
}: {
  order: Order;
  token: string;
  target: PreparationTarget;
  actionLabel: string;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => advancePreparation(order.id, target, token),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["admin-preparation", token] });
      void client.invalidateQueries({
        queryKey: ["admin-cancellations", token],
      });
      void client.invalidateQueries({ queryKey: ["orders"] });
    },
  });
  const blocked = order.cancelRequest?.status === "PENDING";
  return (
    <article
      aria-label={`Đơn ${order.id}`}
      className="min-w-0 rounded-xl border border-stone-200 bg-white p-3 shadow-sm"
    >
      <h4 className="break-all text-sm font-bold text-stone-900">{order.id}</h4>
      <p className="mt-1 text-xs text-stone-500">
        Đặt lúc {formatDate(order.createdAt)}
      </p>
      <OrderItems order={order} />
      {order.discount > 0 && (
        <p className="mb-2 text-xs text-green-800">
          Voucher {order.voucherCode}: −{formatPrice(order.discount)}
        </p>
      )}
      <p className="flex flex-wrap justify-between gap-2 text-sm">
        <span>Đã thanh toán</span>
        <strong className="text-amber-900">{formatPrice(order.total)}</strong>
      </p>
      {blocked && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Đang chờ duyệt hủy.{" "}
          <a href="#cancel-requests" className="font-semibold underline">
            Xử lý yêu cầu hủy
          </a>{" "}
          trước khi pha.
        </p>
      )}
      <button
        disabled={blocked || mutation.isPending}
        onClick={() => {
          if (
            target !== "COMPLETED" ||
            window.confirm(`Xác nhận khách đã nhận đủ món của đơn ${order.id}?`)
          )
            mutation.mutate();
        }}
        className="mt-3 w-full rounded-xl bg-amber-800 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {mutation.isPending ? "Đang cập nhật…" : actionLabel}
      </button>
      {mutation.error && (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {mutation.error.message}
        </p>
      )}
    </article>
  );
}
