"use client";
import Link from "next/link";
import { useState } from "react";
import { useOrderClock, useOrderHistory } from "@/hooks/useOrderHistory";
import { isActive } from "@/lib/orderUtils";
import { useOrderRewardsSync } from "@/hooks/useRewardsProfile";
import {
  LoginPrompt,
  OrderCard,
  OrderError,
  OrderLoading,
  primaryButton,
  secondaryButton,
} from "./OrderParts";

export function OrderHistory() {
  const query = useOrderHistory();
  const [filter, setFilter] = useState("all");
  const orders = query.data ?? [];
  useOrderRewardsSync(query.authenticated && !query.isError ? orders : []);
  const now = useOrderClock(orders[0]?.serverTime, query.dataUpdatedAt);
  const completed = orders.filter(
    (order) => order.status === "COMPLETED",
  ).length;
  const active = orders.filter((order) => isActive(order.status)).length;
  const filtered = orders.filter(
    (order) =>
      filter === "all" ||
      (filter === "active" && isActive(order.status)) ||
      (filter === "completed" && order.status === "COMPLETED") ||
      (filter === "other" &&
        ["CANCELLED", "PAYMENT_FAILED"].includes(order.status)),
  );
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-9">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">
            Đơn hàng của bạn
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Theo dõi đơn, thanh toán và nhận đồ uống tại quầy.
          </p>
        </div>
        {query.authenticated && (
          <button
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className={secondaryButton}
          >
            Làm mới
          </button>
        )}
      </div>
      {!query.hydrated ? (
        <OrderLoading />
      ) : !query.authenticated ? (
        <LoginPrompt returnTo="/orders" />
      ) : query.isPending ? (
        <OrderLoading />
      ) : query.isError ? (
        <OrderError
          error={query.error}
          retry={() => void query.refetch()}
          fetching={query.isFetching}
        />
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
            {[
              ["Tổng đơn", orders.length],
              ["Đang thực hiện", active],
              ["Hoàn tất", completed],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4"
              >
                <dt className="text-xs text-stone-500 sm:text-sm">{label}</dt>
                <dd className="mt-1 text-2xl font-bold text-amber-900">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div
            role="group"
            aria-label="Lọc đơn hàng"
            className="mb-5 flex flex-wrap gap-2"
          >
            {[
              ["all", "Tất cả"],
              ["active", "Đang thực hiện"],
              ["completed", "Hoàn tất"],
              ["other", "Thất bại / Đã hủy"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={filter === value ? primaryButton : secondaryButton}
              >
                {label}
              </button>
            ))}
          </div>
          {!orders.length ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
              <h2 className="text-xl font-bold">Bạn chưa có đơn hàng nào</h2>
              <p className="mt-3 text-sm text-stone-600">
                Chọn món trong thực đơn để bắt đầu.
              </p>
              <Link href="/menu" className={`${primaryButton} mt-6`}>
                Về thực đơn
              </Link>
            </div>
          ) : !filtered.length ? (
            <p className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-600">
              Không có đơn trong mục này.
            </p>
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {filtered.map((order) => (
                <OrderCard key={order.id} order={order} serverNow={now} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
