import type { ProductSize } from "@/lib/productOptions";

export const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "PAYMENT_FAILED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  size: ProductSize;
  toppingIds: string[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderBenefits {
  benefitsPolicyVersion: 0 | 1;
  pointsEarned: number;
  pointsReversed: number;
  pointsAwardedAt: string | null;
  pointsReversedAt: string | null;
}

export interface CancelRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  reason: string;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}
export interface OrderCancellation {
  canCancelImmediately: boolean;
  canRequestCancellation: boolean;
  cancelRequest: CancelRequest | null;
}

export interface Order extends OrderBenefits, OrderCancellation {
  id: string;
  status: OrderStatus;
  total: number;
  subtotal: number;
  discount: number;
  voucherCode: string | null;
  voucherTitle: string | null;
  createdAt: string;
  expiresAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  paymentMethod: "WALLET" | "CARD" | null;
  serverTime: string;
  canPay: boolean;
  items: OrderItem[];
}
