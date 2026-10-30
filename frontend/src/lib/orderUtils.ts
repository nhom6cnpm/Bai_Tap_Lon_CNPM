import type { Order, OrderStatus } from "@/types/order";
import { toppingOptions } from "./productOptions";

export const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PAYMENT_FAILED: "Thanh toán thất bại",
  PREPARING: "Đang pha chế",
  READY: "Sẵn sàng nhận",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
};
export const isActive = (status: OrderStatus) =>
  ["PENDING", "PAID", "PREPARING", "READY"].includes(status);
export const isPaid = (status: OrderStatus) =>
  ["PAID", "PREPARING", "READY", "COMPLETED"].includes(status);
export function orderStatusLabel(order: Order): string {
  if (order.status === "CANCELLED" && order.cancelReason === "PAYMENT_TIMEOUT")
    return "Đã hủy — quá hạn thanh toán";
  if (order.status === "CANCELLED" && order.cancelReason === "USER_CANCELLED")
    return "Đã hủy theo yêu cầu";
  return statusLabels[order.status];
}
export function canPay(order: Order, serverNow: number): boolean {
  return (
    order.canPay &&
    ["PENDING", "PAYMENT_FAILED"].includes(order.status) &&
    Date.parse(order.expiresAt) > serverNow
  );
}
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
export const toppingLabel = (ids: string[]) =>
  ids.length
    ? ids
        .map(
          (id) => toppingOptions.find((option) => option.id === id)?.name ?? id,
        )
        .join(" · ")
    : "Không topping";
export function formatRemaining(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
