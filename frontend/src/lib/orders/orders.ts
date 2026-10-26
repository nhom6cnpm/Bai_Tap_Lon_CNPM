import { getStoredToken } from './auth';

export async function submitOrderApi(items: any[]) {
  const token = getStoredToken();
  if (!token) {
    throw new Error('Bạn chưa đăng nhập. Vui lòng đăng nhập để đặt hàng.');
  }

  const orderPayload = {
    items: items.map((item) => ({
      productId: item.productId,
      size: item.size,
      toppingIds: item.toppingIds,
      qty: item.qty,
    })),
  };

  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const res = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(orderPayload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Đặt hàng thất bại (Mã lỗi: ${res.status})`);
  }

  return data;
}
