import { getStoredToken } from "@/lib/auth";

export type PaymentMethod = "WALLET" | "CARD";
// CUSTOMER_REPORTED = khách đã bấm "Tôi đã chuyển tiền", chờ nhân viên xác nhận
export type PaymentStatus =
  "PENDING" | "CUSTOMER_REPORTED" | "SUCCESS" | "FAILED";
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PAYMENT_FAILED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export interface PaymentDetails {
  paymentId: string;
  orderId: string;
  status: PaymentStatus;
  amount: number;
  method: PaymentMethod;
  orderStatus: OrderStatus | null;
  reportedAt: string | null;
  reviewNote: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  serverTime: string;
}

export class PaymentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaymentApiError";
  }
}

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3001"
).replace(/\/+$/, "");

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readErrorMessage(data: unknown, fallback: string): string {
  if (!isRecord(data)) return fallback;
  const message = data.message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message))
    return (
      message
        .filter((part): part is string => typeof part === "string")
        .join(", ") || fallback
    );
  return fallback;
}

export async function readResponse(
  response: Response,
  fallback: string,
): Promise<unknown> {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new PaymentApiError(
      readErrorMessage(data, fallback),
      response.status,
    );
  return data;
}

export function requireToken(): string {
  const token = getStoredToken();
  if (!token) throw new PaymentApiError("Vui lòng đăng nhập để tiếp tục.", 401);
  return token;
}

const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "PENDING",
  "CUSTOMER_REPORTED",
  "SUCCESS",
  "FAILED",
];
const ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING",
  "PAID",
  "PAYMENT_FAILED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

const optionalString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/** Validates the payment view returned by every payment endpoint. */
export function parsePayment(data: unknown): PaymentDetails {
  if (
    !isRecord(data) ||
    typeof data.paymentId !== "string" ||
    typeof data.orderId !== "string" ||
    typeof data.amount !== "number" ||
    !Number.isSafeInteger(data.amount) ||
    data.amount < 0 ||
    typeof data.serverTime !== "string" ||
    !Number.isFinite(Date.parse(data.serverTime)) ||
    !PAYMENT_STATUSES.includes(data.status as PaymentStatus) ||
    (data.method !== "WALLET" && data.method !== "CARD")
  ) {
    throw new Error("Phản hồi thanh toán không đúng định dạng.");
  }
  return {
    paymentId: data.paymentId,
    orderId: data.orderId,
    amount: data.amount,
    status: data.status as PaymentStatus,
    method: data.method,
    orderStatus: ORDER_STATUSES.includes(data.orderStatus as OrderStatus)
      ? (data.orderStatus as OrderStatus)
      : null,
    reportedAt: optionalString(data.reportedAt),
    reviewNote: optionalString(data.reviewNote),
    createdAt: optionalString(data.createdAt),
    expiresAt: optionalString(data.expiresAt),
    serverTime: data.serverTime,
  };
}

function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${requireToken()}`,
    ...extra,
  };
}

export async function createPayment(
  orderId: string,
  method: PaymentMethod,
  idempotencyKey: string,
): Promise<PaymentDetails> {
  const response = await fetch(`${API_URL}/payments`, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    }),
    body: JSON.stringify({ orderId, method }),
  });
  return parsePayment(
    await readResponse(
      response,
      "Không tạo được phiên thanh toán. Vui lòng thử lại.",
    ),
  );
}

export async function getPayment(paymentId: string): Promise<PaymentDetails> {
  const response = await fetch(
    `${API_URL}/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: authHeaders(),
      cache: "no-store",
    },
  );
  return parsePayment(
    await readResponse(response, "Không kiểm tra được trạng thái thanh toán."),
  );
}

/** "Tôi đã chuyển tiền": only notifies staff, the order is not paid yet. */
export async function reportPaid(paymentId: string): Promise<PaymentDetails> {
  const response = await fetch(
    `${API_URL}/payments/${encodeURIComponent(paymentId)}/report-paid`,
    {
      method: "POST",
      headers: authHeaders(),
    },
  );
  return parsePayment(
    await readResponse(response, "Không gửi được thông báo. Vui lòng thử lại."),
  );
}
