import { clearAuth, getStoredToken } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/products";
import {
  ORDER_STATUSES,
  type Order,
  type OrderBenefits,
  type OrderItem,
  type OrderCancellation,
} from "@/types/order";

export class OrderApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OrderApiError";
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const date = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const money = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function isItem(value: unknown): value is OrderItem {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.productId === "string" &&
    typeof value.name === "string" &&
    (value.imageUrl === null || typeof value.imageUrl === "string") &&
    ["S", "M", "L"].includes(String(value.size)) &&
    Array.isArray(value.toppingIds) &&
    value.toppingIds.every((id) => typeof id === "string") &&
    typeof value.qty === "number" &&
    Number.isSafeInteger(value.qty) &&
    value.qty > 0 &&
    money(value.unitPrice) &&
    money(value.lineTotal)
  );
}
type OrderWire = Omit<
  Order,
  | keyof OrderBenefits
  | keyof OrderCancellation
  | "refundedAmount"
  | "transferReceived"
> &
  Partial<
    OrderBenefits &
      OrderCancellation &
      Pick<Order, "refundedAmount" | "transferReceived">
  >;
function validCancellation(value: Record<string, unknown>): boolean {
  if (
    value.canCancelImmediately === undefined &&
    value.canRequestCancellation === undefined &&
    value.cancelRequest === undefined
  )
    return true;
  if (
    typeof value.canCancelImmediately !== "boolean" ||
    typeof value.canRequestCancellation !== "boolean" ||
    (value.canCancelImmediately && value.canRequestCancellation)
  )
    return false;
  const request = value.cancelRequest;
  if (request === null) return true;
  return (
    record(request) &&
    typeof request.id === "string" &&
    !!request.id &&
    ["PENDING", "APPROVED", "REJECTED", "EXPIRED"].includes(
      String(request.status),
    ) &&
    typeof request.reason === "string" &&
    !!request.reason.trim() &&
    date(request.requestedAt) &&
    (request.reviewedAt === null || date(request.reviewedAt)) &&
    (request.reviewedBy === null || typeof request.reviewedBy === "string") &&
    (request.reviewNote === null || typeof request.reviewNote === "string") &&
    (request.status !== "PENDING" ||
      (request.reviewedAt === null &&
        !value.canCancelImmediately &&
        !value.canRequestCancellation)) &&
    (request.status === "PENDING" || date(request.reviewedAt))
  );
}
const benefitKeys = [
  "benefitsPolicyVersion",
  "pointsEarned",
  "pointsReversed",
  "pointsAwardedAt",
  "pointsReversedAt",
] as const;
function validBenefits(value: Record<string, unknown>): boolean {
  if (benefitKeys.every((key) => value[key] === undefined)) return true;
  return (
    (value.benefitsPolicyVersion === 0 || value.benefitsPolicyVersion === 1) &&
    money(value.pointsEarned) &&
    money(value.pointsReversed) &&
    (value.pointsAwardedAt === null || date(value.pointsAwardedAt)) &&
    (value.pointsReversedAt === null || date(value.pointsReversedAt)) &&
    (value.pointsEarned === 0 || date(value.pointsAwardedAt)) &&
    (value.pointsReversed === 0 ||
      (date(value.pointsAwardedAt) && date(value.pointsReversedAt)))
  );
}
function isOrder(value: unknown): value is OrderWire {
  return (
    record(value) &&
    validBenefits(value) &&
    validCancellation(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    ORDER_STATUSES.some((status) => status === value.status) &&
    money(value.total) &&
    money(value.subtotal) &&
    money(value.discount) &&
    value.total === (value.subtotal as number) - (value.discount as number) &&
    (value.voucherCode === null || typeof value.voucherCode === "string") &&
    (value.voucherTitle === null || typeof value.voucherTitle === "string") &&
    date(value.createdAt) &&
    date(value.expiresAt) &&
    date(value.serverTime) &&
    (value.cancelledAt === null || date(value.cancelledAt)) &&
    (value.cancelReason === null || typeof value.cancelReason === "string") &&
    (value.paymentMethod === null ||
      value.paymentMethod === "CARD" ||
      value.paymentMethod === "WALLET") &&
    typeof value.canPay === "boolean" &&
    (value.refundedAmount === undefined || money(value.refundedAmount)) &&
    (value.transferReceived === undefined ||
      typeof value.transferReceived === "boolean") &&
    Array.isArray(value.items) &&
    value.items.every(isItem)
  );
}

function withBenefits(order: OrderWire): Order {
  return {
    ...order,
    benefitsPolicyVersion: order.benefitsPolicyVersion ?? 0,
    pointsEarned: order.pointsEarned ?? 0,
    pointsReversed: order.pointsReversed ?? 0,
    pointsAwardedAt: order.pointsAwardedAt ?? null,
    pointsReversedAt: order.pointsReversedAt ?? null,
    canCancelImmediately: order.canCancelImmediately ?? false,
    canRequestCancellation: order.canRequestCancellation ?? false,
    cancelRequest: order.cancelRequest ?? null,
    refundedAmount: order.refundedAmount ?? 0,
    transferReceived: order.transferReceived ?? false,
  };
}

async function readOrders(
  path: string,
  signal?: AbortSignal,
  token: string | null = getStoredToken(),
): Promise<unknown> {
  if (!token)
    throw new OrderApiError(401, "Vui lòng đăng nhập để xem đơn hàng.");
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    signal,
    cache: "no-store",
  });
  if (signal?.aborted || getStoredToken() !== token)
    throw new DOMException("Tài khoản đã thay đổi.", "AbortError");
  if (!response.ok) {
    if (response.status === 401 && getStoredToken() === token) clearAuth();
    throw new OrderApiError(
      response.status,
      response.status === 401
        ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
        : response.status === 404
          ? "Không tìm thấy đơn hàng của bạn."
          : "Không tải được đơn hàng. Vui lòng thử lại.",
    );
  }
  const data: unknown = await response.json();
  if (signal?.aborted || getStoredToken() !== token)
    throw new DOMException("Tài khoản đã thay đổi.", "AbortError");
  return data;
}

export async function getMyOrders(
  signal?: AbortSignal,
  token: string | null = getStoredToken(),
): Promise<Order[]> {
  const data = await readOrders("/orders/me", signal, token);
  if (!Array.isArray(data) || !data.every(isOrder))
    throw new Error("Dữ liệu đơn hàng chưa hợp lệ. Vui lòng thử lại.");
  return data.map(withBenefits);
}

export async function getMyOrder(
  id: string,
  signal?: AbortSignal,
  token: string | null = getStoredToken(),
): Promise<Order> {
  const data = await readOrders(
    `/orders/${encodeURIComponent(id)}`,
    signal,
    token,
  );
  if (!isOrder(data) || data.id !== id)
    throw new Error("Dữ liệu đơn hàng chưa hợp lệ. Vui lòng thử lại.");
  return withBenefits(data);
}

export function parseOrder(value: unknown): Order {
  if (!isOrder(value))
    throw new Error("Dữ liệu đơn hàng chưa hợp lệ. Vui lòng thử lại.");
  return withBenefits(value);
}
