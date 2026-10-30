import { clearAuth, getStoredToken } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/products";
import { OrderApiError, parseOrder } from "@/lib/orders/history";
import type { Order } from "@/types/order";

export type PreparationTarget = "PREPARING" | "READY" | "COMPLETED";
async function call(
  path: string,
  token: string,
  signal?: AbortSignal,
  status?: PreparationTarget,
): Promise<unknown> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: status ? "PATCH" : "GET",
    cache: "no-store",
    signal,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(status ? { "Content-Type": "application/json" } : {}),
    },
    ...(status ? { body: JSON.stringify({ status }) } : {}),
  });
  const data: unknown = await response.json().catch(() => null);
  if (signal?.aborted || getStoredToken() !== token)
    throw new DOMException("Tài khoản đã thay đổi.", "AbortError");
  if (!response.ok) {
    if (response.status === 401) clearAuth();
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? data.message
        : null;
    throw new OrderApiError(
      response.status,
      typeof message === "string"
        ? message
        : "Chưa cập nhật được đơn. Vui lòng thử lại.",
    );
  }
  return data;
}
export async function listPreparationOrders(
  token: string,
  signal?: AbortSignal,
): Promise<Order[]> {
  const data = await call(
    "/admin/orders?status=PAID,PREPARING,READY",
    token,
    signal,
  );
  if (!Array.isArray(data)) throw new Error("Danh sách đơn chưa hợp lệ.");
  return data.map(parseOrder);
}
export async function advancePreparation(
  id: string,
  target: PreparationTarget,
  token: string,
): Promise<Order> {
  return parseOrder(
    await call(
      `/admin/orders/${encodeURIComponent(id)}/status`,
      token,
      undefined,
      target,
    ),
  );
}
