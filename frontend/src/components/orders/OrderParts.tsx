"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Order, OrderStatus } from "@/types/order";
import {
  formatDate,
  formatPrice,
  isPaid,
  paymentLabel,
  statusLabels,
} from "@/lib/orderUtils";
import { Icon } from "./Icon";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <i />
      {statusLabels[status]}
    </span>
  );
}

export function OrderItems({ order }: { order: Order }) {
  return (
    <ul className="order-items">
      {order.items.map((item) => (
        <li key={item.id}>
          <span className="item-art">
            {["3", "4"].includes(item.productId) ? (
              <Image
                src={`/images/task9/${item.productId === "3" ? "cappuccino" : "peach-tea"}.jpg`}
                alt=""
                fill
                sizes="48px"
              />
            ) : (
              <Icon name="cup" size={25} />
            )}
          </span>
          <div className="item-description">
            <strong>
              {item.qty}× {item.name}
            </strong>
            <span>
              Size {item.size}
              {item.toppings.length > 0
                ? ` · ${item.toppings.join(" · ")}`
                : ""}
            </span>
          </div>
          <strong className="item-price">{formatPrice(item.lineTotal)}</strong>
        </li>
      ))}
    </ul>
  );
}

export function OrderProgress({ status }: { status: OrderStatus }) {
  const step = {
    PENDING: -1,
    PAYMENT_FAILED: -1,
    CANCELLED: -1,
    PAID: 0,
    PREPARING: 1,
    READY: 2,
    COMPLETED: 3,
  }[status];
  if (step < 0)
    return (
      <p className="muted">
        {status === "CANCELLED"
          ? "Đơn hàng đã hủy."
          : "Đơn hàng chưa được thanh toán thành công."}
      </p>
    );
  return (
    <ol className="order-progress" aria-label="Tiến trình đơn hàng">
      {["Tiếp nhận", "Đang pha chế", "Sẵn sàng nhận", "Hoàn tất"].map(
        (label, index) => (
          <li
            key={label}
            className={step >= index ? "reached" : ""}
            aria-current={step === index ? "step" : undefined}
          >
            <span>
              {step > index ? <Icon name="check" size={14} /> : index + 1}
            </span>
            {label}
          </li>
        ),
      )}
    </ol>
  );
}

export function PickupTicket({ order }: { order: Order }) {
  const [notice, setNotice] = useState("");
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(
        `${order.code} · ${order.pickupCode}`,
      );
      setNotice("Đã sao chép mã nhận nước.");
    } catch {
      setNotice("Chưa sao chép được. Bạn có thể đọc mã bên trên tại quầy.");
    }
  }
  return (
    <section className="panel pickup-ticket" aria-label="Thẻ nhận tại quầy">
      <div className="section-heading">
        <Icon name="receipt" />
        <h2>Thẻ nhận tại quầy</h2>
        <StatusBadge status={order.status} />
      </div>
      <div className="pickup-number">
        <span>MÃ SỐ LẤY NƯỚC</span>
        <strong>{order.pickupCode || "Chưa cấp mã"}</strong>
        <small>Đơn hàng #{order.code}</small>
      </div>
      <div className="location-row">
        <Icon name="pin" />
        <div>
          <strong>Quầy BrewLite</strong>
          <p>Xuất trình mã đơn và mã nhận nước cho nhân viên tại quầy.</p>
        </div>
      </div>
      <div className="ticket-divider" />
      <OrderProgress status={order.status} />
      {order.pickupCode && isPaid(order.status) && (
        <button
          className="button button-primary full-width"
          onClick={() => void copyCode()}
        >
          <Icon name="share" size={18} />
          Sao chép mã nhận nước
        </button>
      )}
      <p className="action-notice" role="status">
        {notice}
      </p>
    </section>
  );
}

export function OrderCard({ order, demo }: { order: Order; demo: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = `details-${order.id}`;
  return (
    <article
      className={`panel order-card ${["PAID", "PREPARING", "READY"].includes(order.status) ? "order-highlight" : ""}`}
    >
      <div className="order-card-heading">
        <span className="order-symbol">
          <Icon name="cup" size={26} />
        </span>
        <div>
          <h2>#{order.code}</h2>
          <time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time>
        </div>
        <div className="order-card-total">
          <StatusBadge status={order.status} />
          <strong>{formatPrice(order.total)}</strong>
        </div>
      </div>
      <OrderItems order={order} />
      <div className="order-actions">
        <button
          className="button button-primary"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded(!expanded)}
        >
          <Icon name="receipt" size={17} />
          {expanded ? "Thu gọn" : "Xem chi tiết"}
        </button>
        <Link
          className="button button-soft"
          href={`${demo ? "/demo" : ""}/orders/${order.id}/confirmation`}
        >
          Xem đơn hàng
          <Icon name="arrow" size={15} />
        </Link>
        <span className="payment-note">
          {isPaid(order.status) ? "Đã thanh toán" : "Chưa thanh toán"} ·{" "}
          {paymentLabel(order.paymentMethod)}
        </span>
      </div>
      {expanded && (
        <div id={detailsId} className="expanded-details">
          <h3>Chi tiết đơn & tiến trình nhận món</h3>
          <OrderProgress status={order.status} />
          <div className="total-row">
            <span>Tổng tiền đơn hàng</span>
            <strong>{formatPrice(order.total)}</strong>
          </div>
        </div>
      )}
    </article>
  );
}
