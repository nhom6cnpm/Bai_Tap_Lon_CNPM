import { getStoredToken } from "@/lib/auth";
import type { CartItem } from "@/store/useCart";

export interface CreateOrderResponse {
  message: string;
  orderId: string;
  total: number;
  status: "PENDING";
  createdAt: string;
  expiresAt: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function submitOrderApi(
  items: CartItem[],
): Promise<CreateOrderResponse> {
  const token = getStoredToken();
  if (!token) {
    throw new Error("Bạn chưa đăng nhập. Vui lòng đăng nhập để đặt hàng.");
  }

  // Only send what the backend needs; the backend recalculates prices
  const orderPayload = {
    items: items.map((item) => ({
      productId: item.productId,
      size: item.size,
      toppingIds: item.toppingIds,
      qty: item.qty,
    })),
  };

  const res = await fetch(`${BASE_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(orderPayload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    const message = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message;
    throw new Error(message || `Đặt hàng thất bại (mã lỗi ${res.status})`);
  }

  return data as CreateOrderResponse;
}
