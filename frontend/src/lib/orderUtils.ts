import type { OrderStatus } from "@/types/order";

export const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PAYMENT_FAILED: "Thanh toán thất bại",
  PREPARING: "Đang pha chế",
  READY: "Sẵn sàng nhận",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};

export function isPaid(status: OrderStatus) {
  return ["PAID", "PREPARING", "READY", "COMPLETED"].includes(status);
}

export function isActive(status: OrderStatus) {
  return ["PENDING", "PAID", "PREPARING", "READY"].includes(status);
}

export function formatPrice(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

export function paymentLabel(method: string | null) {
  if (method === "WALLET") return "Ví điện tử";
  if (method === "CARD") return "Thẻ ngân hàng";
  return method || "Chưa chọn phương thức";
}
