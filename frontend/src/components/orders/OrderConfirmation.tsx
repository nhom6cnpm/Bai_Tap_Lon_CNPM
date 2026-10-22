"use client";

import Image from "next/image";
import Link from "next/link";
import { useOrderData } from "@/hooks/useOrderData";
import {
  formatDate,
  formatPrice,
  isPaid,
  paymentLabel,
  statusLabels,
} from "@/lib/orderUtils";
import { OrderShell } from "./OrderShell";
import {
  OrderItems,
  OrderProgress,
  PickupTicket,
  StatusBadge,
} from "./OrderParts";
import { Icon } from "./Icon";

export function OrderConfirmation({
  id,
  demo = false,
}: {
  id: string;
  demo?: boolean;
}) {
  const { state, retry } = useOrderData(demo, id);
  const order = state.status === "ready" ? state.orders[0] : undefined;
  const historyUrl = demo ? "/demo/orders" : "/orders";
  const title = !order
    ? ""
    : isPaid(order.status)
      ? order.status === "COMPLETED"
        ? "Đơn hàng đã hoàn tất!"
        : "Đặt hàng thành công!"
      : order.status === "PAYMENT_FAILED"
        ? "Thanh toán chưa thành công"
        : order.status === "CANCELLED"
          ? "Đơn hàng đã hủy"
          : "Đơn hàng đang chờ thanh toán";
  return (
    <OrderShell demo={demo}>
      <Link className="back-link" href={historyUrl}>
        ← Quay lại đơn hàng
      </Link>
      {state.status === "loading" && (
        <div className="panel state-panel" role="status">
          Đang tải thông tin đơn hàng…
        </div>
      )}
      {state.status === "error" && (
        <div className="panel state-panel" role="alert">
          <h1>Chưa thể xem đơn hàng</h1>
          <p>{state.message}</p>
          {state.unauthorized ? (
            <Link
              className="button button-primary"
              href={`/login?next=${encodeURIComponent(`/orders/${id}/confirmation`)}`}
            >
              Đăng nhập
            </Link>
          ) : (
            <button className="button button-primary" onClick={retry}>
              Thử lại
            </button>
          )}
        </div>
      )}
      {state.status === "ready" && !order && (
        <div className="panel state-panel">
          <h1>Không tìm thấy đơn hàng</h1>
          <Link className="button button-primary" href={historyUrl}>
            Xem lịch sử đơn
          </Link>
        </div>
      )}
      {order && (
        <div className="confirmation-content">
          <section
            className={`panel confirmation-hero ${!isPaid(order.status) ? "confirmation-unpaid" : ""}`}
          >
            <span className="confirmation-icon">
              {isPaid(order.status) ? <Icon name="check" size={38} /> : "!"}
            </span>
            <p className="eyebrow">BREWLITE COUNTER SERVICE</p>
            <h1>{title}</h1>
            <p className="muted">
              {order.status === "READY"
                ? "Đồ uống đã sẵn sàng. Mời bạn đến quầy nhận món."
                : order.status === "PREPARING"
                  ? "Barista đang chuẩn bị đồ uống của bạn. Một chút kiên nhẫn, một ly thật ngon."
                  : order.status === "PAID"
                    ? "Thanh toán đã được xác nhận. Đơn hàng đang chờ được chuẩn bị."
                    : order.status === "COMPLETED"
                      ? "Cảm ơn bạn đã ghé BrewLite. Hẹn gặp bạn ở ly cà phê tiếp theo!"
                      : "Bạn có thể theo dõi trạng thái hiện tại trong lịch sử đơn hàng."}
            </p>
            <div className="confirmation-badges">
              <span className="code-badge">Mã đơn: #{order.code}</span>
              <StatusBadge status={order.status} />
              <span className="method-badge">
                {paymentLabel(order.paymentMethod)}
              </span>
            </div>
          </section>
          <div className="confirmation-grid">
            <div className="confirmation-left">
              <PickupTicket order={order} />
              <section className="panel receipt-panel">
                <div className="section-heading">
                  <Icon name="receipt" />
                  <h2>Chi tiết đơn hàng</h2>
                  <span className="muted">
                    {order.items.reduce((sum, item) => sum + item.qty, 0)} phần
                  </span>
                </div>
                <OrderItems order={order} />
                <div className="ticket-divider" />
                <div className="total-row">
                  <span>
                    Tổng tiền đơn hàng
                    <small>
                      {isPaid(order.status)
                        ? "Đã thanh toán"
                        : "Chưa thanh toán"}
                    </small>
                  </span>
                  <strong>{formatPrice(order.total)}</strong>
                </div>
                <p className="receipt-date">
                  Đặt lúc {formatDate(order.createdAt)}
                </p>
              </section>
            </div>
            <aside>
              <section className="panel atmosphere-card">
                <div className="barista-image">
                  <Image
                    src="/images/task9/barista.jpg"
                    alt="Barista chuẩn bị cà phê tại quầy"
                    fill
                    sizes="(max-width: 760px) 100vw, 420px"
                  />
                </div>
                <div className="atmosphere-caption">
                  <Icon name="cup" size={18} />
                  Chăm chút trong từng ly cà phê
                </div>
                <div className="tip-card">
                  <p className="eyebrow">MẸO NHỎ NHẬN MÓN</p>
                  <h2>Giữ mã này khi đến quầy.</h2>
                  <p>
                    Mở màn hình này hoặc mục Đơn hàng để nhân viên đối chiếu mã
                    và giao đúng đồ uống của bạn.
                  </p>
                </div>
              </section>
              <section className="panel preparation-panel">
                <h2>Trạng thái hiện tại</h2>
                <p className="muted">{statusLabels[order.status]}</p>
                <OrderProgress status={order.status} />
                {!demo && (
                  <button
                    className="button button-soft full-width"
                    onClick={retry}
                  >
                    <Icon name="refresh" size={17} />
                    Cập nhật trạng thái
                  </button>
                )}
              </section>
              <div className="confirmation-links">
                <Link
                  className="button button-primary full-width"
                  href={historyUrl}
                >
                  <Icon name="receipt" size={18} />
                  Xem lịch sử đơn hàng
                </Link>
                <Link className="button button-soft full-width" href="/">
                  <Icon name="cup" size={18} />
                  Về trang chủ
                </Link>
                <button
                  className="button button-quiet full-width print-button"
                  onClick={() => window.print()}
                >
                  In thông tin đơn hàng
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}
    </OrderShell>
  );
}
