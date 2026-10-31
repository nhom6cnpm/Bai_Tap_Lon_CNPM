import { clearAuth, getStoredToken } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/products";
import { OrderApiError } from "@/lib/orders/history";

/** GET a staff API with the given token; 401 logs out, other errors throw. */
export async function adminGet(
  path: string,
  token: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    signal,
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const data: unknown = await response.json().catch(() => null);
  if (signal?.aborted || getStoredToken() !== token)
    throw new DOMException("Tài khoản đã thay đổi.", "AbortError");
  if (!response.ok) {
    if (response.status === 401) clearAuth();
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? (data as { message: unknown }).message
        : null;
    throw new OrderApiError(
      response.status,
      typeof message === "string" ? message : "Không tải được dữ liệu.",
    );
  }
  return data;
}
