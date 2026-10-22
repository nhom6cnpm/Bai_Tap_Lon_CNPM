import type { Order } from "@/types/order";

export const ACCESS_TOKEN_KEY = "brewlite.accessToken";
const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const token = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "Không thể tải dữ liệu. Vui lòng thử lại.";
    if (response.status === 401) {
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      message =
        path === "/auth/login"
          ? "Email hoặc mật khẩu không chính xác."
          : "Vui lòng đăng nhập để xem đơn hàng của bạn.";
    } else if (response.status === 404)
      message = "Không tìm thấy đơn hàng của bạn.";
    else if (response.status === 409) message = "Email đã được đăng ký.";
    else if (response.status === 400)
      message = "Thông tin chưa hợp lệ. Kiểm tra email và mật khẩu.";
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export const getMyOrders = (signal?: AbortSignal) =>
  apiRequest<Order[]>("/orders/me", { signal });
export const getMyOrder = (id: string, signal?: AbortSignal) =>
  apiRequest<Order>(`/orders/${encodeURIComponent(id)}`, { signal });
