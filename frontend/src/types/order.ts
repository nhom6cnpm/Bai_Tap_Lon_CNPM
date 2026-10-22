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
  size: string;
  toppings: string[];
  qty: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  code: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  pickupCode: string | null;
  paymentMethod: string | null;
  items: OrderItem[];
}
