import { parseOrder } from "@/lib/orders/history";
import { isRecord } from "@/lib/payments/api";
import type { Order, OrderStatus } from "@/types/order";
import type { BankTransaction } from "./payments";
import { adminGet } from "./request";

export interface AdminOrder extends Order {
  customerEmail: string | null;
}
export interface AdminOrderPage {
  items: AdminOrder[];
  total: number;
  page: number;
  pageSize: number;
}
export interface AdminPaymentRecord {
  paymentId: string;
  method: "WALLET" | "CARD";
  status: string;
  amount: number;
  createdAt: string | null;
  receivedAt: string | null;
  reviewedAt: string | null;
  reviewedByEmail: string | null;
  reviewNote: string | null;
}
export interface AdminOrderDetail extends AdminOrder {
  cancelReviewedByEmail: string | null;
  payments: AdminPaymentRecord[];
  bankTransactions: BankTransaction[];
}

const text = (value: unknown) => (typeof value === "string" ? value : null);
const withEmail = (value: unknown): AdminOrder => ({
  ...parseOrder(value),
  customerEmail: isRecord(value) ? text(value.customerEmail) : null,
});

export async function listAdminOrders(
  filters: { status?: OrderStatus | ""; q?: string; page: number },
  token: string,
  signal?: AbortSignal,
): Promise<AdminOrderPage> {
  const params = new URLSearchParams({ page: String(filters.page) });
  if (filters.status) params.set("status", filters.status);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  const data = await adminGet(
    `/admin/orders/history?${params.toString()}`,
    token,
    signal,
  );
  if (!isRecord(data) || !Array.isArray(data.items))
    throw new Error("Danh sách đơn không hợp lệ.");
  return {
    items: data.items.map(withEmail),
    total: typeof data.total === "number" ? data.total : 0,
    page: typeof data.page === "number" ? data.page : 1,
    pageSize: typeof data.pageSize === "number" ? data.pageSize : 20,
  };
}

export async function getAdminOrderDetail(
  id: string,
  token: string,
  signal?: AbortSignal,
): Promise<AdminOrderDetail> {
  const data = await adminGet(
    `/admin/orders/${encodeURIComponent(id)}/detail`,
    token,
    signal,
  );
  if (!isRecord(data)) throw new Error("Chi tiết đơn không hợp lệ.");
  return {
    ...withEmail(data),
    cancelReviewedByEmail: text(data.cancelReviewedByEmail),
    payments: (Array.isArray(data.payments) ? data.payments : [])
      .filter(isRecord)
      .map((row) => ({
        paymentId: String(row.paymentId),
        method: row.method === "CARD" ? "CARD" : "WALLET",
        status: String(row.status),
        amount: typeof row.amount === "number" ? row.amount : 0,
        createdAt: text(row.createdAt),
        receivedAt: text(row.receivedAt),
        reviewedAt: text(row.reviewedAt),
        reviewedByEmail: text(row.reviewedByEmail),
        reviewNote: text(row.reviewNote),
      })),
    bankTransactions: (Array.isArray(data.bankTransactions)
      ? data.bankTransactions
      : []
    )
      .filter(isRecord)
      .map((row) => ({
        id: String(row.id),
        type: row.type === "REFUND" ? "REFUND" : "IN",
        amount: typeof row.amount === "number" ? row.amount : 0,
        orderId: String(row.orderId),
        paymentId: text(row.paymentId),
        content: String(row.content),
        createdAt: String(row.createdAt),
      })),
  };
}
