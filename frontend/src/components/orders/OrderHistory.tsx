"use client";

import Link from "next/link";
import { useState } from "react";
import { useOrderData } from "@/hooks/useOrderData";
import type { DemoState } from "@/hooks/useOrderData";
import { formatPrice, isActive, isPaid } from "@/lib/orderUtils";
import { OrderShell } from "./OrderShell";
import { OrderCard, PickupTicket } from "./OrderParts";
import { Icon } from "./Icon";

export function OrderHistory({
  demo = false,
  demoState = "ready",
}: {
  demo?: boolean;
  demoState?: DemoState;
}) {
  const { state, retry } = useOrderData(demo, undefined, demoState);
  const [filter, setFilter] = useState("all");
  const orders = state.status === "ready" ? state.orders : [];
  const active = orders.filter((order) => isActive(order.status));
  const completed = orders.filter((order) => order.status === "COMPLETED");
  const filtered = orders.filter(
    (order) =>
      filter === "all" ||
      (filter === "active" && isActive(order.status)) ||
      (filter === "completed" && order.status === "COMPLETED") ||
      (filter === "other" &&
        ["CANCELLED", "PAYMENT_FAILED"].includes(order.status)),
  );
  const ticket = active.find((order) => isPaid(order.status));
  return (
    <OrderShell demo={demo}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">QUẢN LÝ ĐƠN HÀNG TẠI QUẦY</p>
          <h1>Đơn hàng của bạn</h1>
          <p className="muted">
            Mỗi ly cà phê, một chút niềm vui. Theo dõi đơn và nhận món tại quầy.
          </p>
        </div>
        {state.status === "ready" && (
          <dl className="order-stats">
            <div>
              <dt>Tổng đơn</dt>
              <dd>{orders.length.toString().padStart(2, "0")}</dd>
            </div>
            <div>
              <dt>Đang xử lý</dt>
              <dd>{active.length.toString().padStart(2, "0")}</dd>
            </div>
            <div>
              <dt>Đã thanh toán</dt>
              <dd>
                {formatPrice(
                  orders
                    .filter((order) => isPaid(order.status))
                    .reduce((sum, order) => sum + order.total, 0),
                )}
              </dd>
            </div>
          </dl>
        )}
      </div>
      {demo && (
        <div className="preview-toolbar">
          <span>
            <Icon name="receipt" size={18} />
            Xem thử giao diện task 9
          </span>
          <nav aria-label="Trạng thái xem thử">
            <Link href="/demo/orders">Có đơn</Link>
            <Link href="/demo/orders?state=empty">Trống</Link>
            <Link href="/demo/orders?state=loading">Đang tải</Link>
            <Link href="/demo/orders?state=error">Lỗi</Link>
            <Link href="/demo/orders/bl1042/confirmation">
              Xác nhận đơn
              <Icon name="arrow" size={13} />
            </Link>
          </nav>
        </div>
      )}
      {state.status === "loading" && (
        <div
          role="status"
          className="loading-list"
          aria-label="Đang tải đơn hàng"
        >
          <div className="skeleton" />
          <div className="skeleton" />
          <span>Đang tải đơn hàng của bạn…</span>
        </div>
      )}
      {state.status === "error" && (
        <section className="panel state-panel" role="alert">
          <span className="state-symbol">!</span>
          <h2>
            {state.unauthorized
              ? "Đăng nhập để xem đơn hàng"
              : "Chưa tải được đơn hàng"}
          </h2>
          <p>{state.message}</p>
          {state.unauthorized ? (
            <Link className="button button-primary" href="/login">
              Đăng nhập
            </Link>
          ) : demo ? (
            <Link className="button button-primary" href="/demo/orders">
              Thử lại
            </Link>
          ) : (
            <button className="button button-primary" onClick={retry}>
              Thử lại
            </button>
          )}
        </section>
      )}
      {state.status === "ready" && (
        <>
          <div className="filter-row">
            <div className="filter-tabs" role="group" aria-label="Lọc đơn hàng">
              {[
                ["all", `Tất cả (${orders.length})`],
                ["active", `Đang thực hiện (${active.length})`],
                ["completed", `Hoàn tất (${completed.length})`],
                ["other", "Thất bại / Đã hủy"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {!demo && (
              <button className="button button-quiet" onClick={retry}>
                <Icon name="refresh" size={17} />
                Làm mới
              </button>
            )}
          </div>
          {orders.length === 0 ? (
            <section className="panel state-panel">
              <span className="state-symbol">
                <Icon name="cup" size={32} />
              </span>
              <h2>Bạn chưa có đơn hàng nào</h2>
              <p>Những món đồ uống bạn đặt sẽ xuất hiện tại đây.</p>
              <Link className="button button-primary" href="/">
                Về trang chủ
              </Link>
            </section>
          ) : (
            <div className="history-grid">
              <div className="order-list">
                {filtered.length ? (
                  filtered.map((order) => (
                    <OrderCard key={order.id} order={order} demo={demo} />
                  ))
                ) : (
                  <section className="panel state-panel">
                    <h2>Không có đơn trong mục này</h2>
                    <button
                      className="button button-soft"
                      onClick={() => setFilter("all")}
                    >
                      Xem tất cả đơn
                    </button>
                  </section>
                )}
              </div>
              <aside>
                {ticket && <PickupTicket order={ticket} />}
                <section className="aside-note">
                  <p className="eyebrow">MỘT CHÚT LƯU Ý</p>
                  <h2>Cà phê ngon, nhận thật nhanh.</h2>
                  <p>
                    Kiểm tra trạng thái đơn trước khi đến quầy. Khi đơn sẵn
                    sàng, hãy xuất trình mã nhận nước cho nhân viên.
                  </p>
                  <div className="location-row">
                    <Icon name="cup" />
                    <span>BrewLite · Nhận đồ uống tại quầy</span>
                  </div>
                </section>
              </aside>
            </div>
          )}
        </>
      )}
    </OrderShell>
  );
}
