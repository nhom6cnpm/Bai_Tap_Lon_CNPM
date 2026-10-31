"use client";

import { formatPrice } from "@/lib/formatPrice";
import PriceSummary from "@/components/PriceSummary";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrderClock, useOwnOrder } from "@/hooks/useOrderHistory";
import { formatDate, orderStatusLabel } from "@/lib/orderUtils";
import OrderRewards from "./OrderRewards";
import OrderCancellation from "./OrderCancellation";
import ReadyOrdersNotice from "./ReadyOrdersNotice";
import { useOrderRewardsSync } from "@/hooks/useRewardsProfile";
import { useClearPaidCart } from "@/hooks/useClearPaidCart";
import {
  LoginPrompt,
  OrderError,
  OrderItems,
  OrderLoading,
  OrderProgress,
  PaymentAction,
  StatusBadge,
  primaryButton,
  secondaryButton,
} from "./OrderParts";

export function OrderDetail({
  id,
  confirmation = false,
}: {
  id: string;
  confirmation?: boolean;
}) {
  const query = useOwnOrder(id);
  const router = useRouter();
  const order = query.data;
  useOrderRewardsSync(order && !query.isError ? [order] : []);
  // Paid while the customer was elsewhere: empty the cart it was ordered from
  useClearPaidCart(order && !query.isError ? [order] : undefined);
  const now = useOrderClock(order?.serverTime, query.dataUpdatedAt);
  useEffect(() => {
    if (
      confirmation &&
      query.authenticated &&
      order &&
      !query.isError &&
      !query.isFetching &&
      order.status !== "PAID"
    ) {
      router.replace(`/orders/${encodeURIComponent(id)}`);
    }
  }, [
    confirmation,
    id,
    order,
    query.authenticated,
    query.isError,
    query.isFetching,
    router,
  ]);
  const returnTo = `/orders/${encodeURIComponent(id)}${confirmation ? "/confirmation" : ""}`;
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-9">
      <ReadyOrdersNotice
        orders={query.authenticated && order && !query.isError ? [order] : []}
      />
      <Link
        href="/orders"
        className="mb-5 inline-block text-sm font-semibold text-amber-800 hover:underline"
      >
        ← Lịch sử đơn hàng
      </Link>
      {!query.hydrated ? (
        <OrderLoading />
      ) : !query.authenticated ? (
        <LoginPrompt returnTo={returnTo} />
      ) : query.isPending ? (
        <OrderLoading />
      ) : query.isError ? (
        <OrderError
          error={query.error}
          retry={() => void query.refetch()}
          fetching={query.isFetching}
        />
      ) : order && confirmation && order.status !== "PAID" ? (
        <p role="status">Đang mở chi tiết đơn hàng…</p>
      ) : (
        order && (
          <>
            {confirmation && (
              <div className="mb-6 rounded-3xl border border-green-200 bg-white px-5 py-8 text-center">
                <span aria-hidden="true" className="text-4xl text-green-700">
                  ✓
                </span>
                <h1 className="mt-3 text-2xl font-bold text-stone-900 sm:text-3xl">
                  Đặt hàng thành công!
                </h1>
                <p className="mt-3 font-semibold text-green-800">
                  Thanh toán đã được xác nhận · PAID
                </p>
                <p className="mt-2 text-stone-600">
                  Cửa hàng đã nhận đơn. Theo dõi tiến trình để biết khi đồ uống
                  sẵn sàng.
                </p>
                <Link href="/menu" className={`${primaryButton} mt-5`}>
                  Về trang chủ
                </Link>
              </div>
            )}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
                {!confirmation && (
                  <h1 className="mb-4 text-2xl font-bold">Chi tiết đơn hàng</h1>
                )}
                <p className="text-xs text-stone-500">MÃ ĐƠN HÀNG</p>
                <p className="mt-1 break-all font-semibold text-stone-900">
                  {order.id}
                </p>
                <div className="mt-3">
                  <StatusBadge order={order} />
                </div>
                <p className="mt-3 text-sm text-stone-500">
                  Đặt lúc {formatDate(order.createdAt)}
                </p>
                <div className="mt-4 border-t border-stone-100">
                  <OrderItems order={order} />
                </div>
                <PriceSummary totals={order} />
                <OrderRewards order={order} />
                <p className="mt-3 text-sm text-stone-600">
                  Phương thức:{" "}
                  {order.paymentMethod === "WALLET"
                    ? "Ví điện tử"
                    : order.paymentMethod === "CARD"
                      ? "Thẻ"
                      : "Chưa có thông tin thanh toán"}
                </p>
              </div>
              <aside className="min-w-0 space-y-4">
                <OrderCancellation
                  order={order}
                  serverNow={now}
                  disabled={query.isFetching}
                />
                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <h2 className="font-bold text-stone-900">
                    Trạng thái đơn hàng
                  </h2>
                  <p className="my-3 text-sm text-stone-600">
                    {orderStatusLabel(order)}
                  </p>
                  <OrderProgress order={order} />
                  {order.cancelledAt && (
                    <p className="mt-3 text-sm text-stone-500">
                      Hủy lúc {formatDate(order.cancelledAt)}
                    </p>
                  )}
                  {order.refundedAmount > 0 && (
                    <p
                      role="status"
                      className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-900"
                    >
                      Đã hoàn {formatPrice(order.refundedAmount)} về tài khoản
                      của bạn (ngân hàng giả lập).
                    </p>
                  )}
                  <button
                    onClick={() => void query.refetch()}
                    disabled={query.isFetching}
                    className={`${secondaryButton} mt-4 w-full`}
                  >
                    Cập nhật trạng thái
                  </button>
                </div>
                {(order.status === "PENDING" ||
                  order.status === "PAYMENT_FAILED") && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <PaymentAction order={order} serverNow={now} />
                  </div>
                )}
                {["PAID", "PREPARING", "READY"].includes(order.status) && (
                  <div className="rounded-2xl border border-stone-200 bg-white p-5">
                    <h2 className="font-bold">Nhận đồ uống tại quầy</h2>
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      {order.status === "READY"
                        ? "Đồ uống đã sẵn sàng, mời bạn ra quầy. Xuất trình mã đơn để nhân viên đối chiếu."
                        : order.status === "PREPARING"
                          ? "Nhân viên đang pha đồ uống của bạn. Màn hình sẽ cập nhật khi món sẵn sàng."
                          : "Cửa hàng đã nhận đơn. Bạn có thể theo dõi tiến trình pha chế tại đây."}
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </>
        )
      )}
    </section>
  );
}
