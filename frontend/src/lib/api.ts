import type { Product } from '@/types/product';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Không tải được dữ liệu (mã lỗi ${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchProducts(): Promise<Product[]> {
  const raw = await apiGet<Product[] | { data: Product[] }>('/products');
  const list = Array.isArray(raw) ? raw : (raw?.data ?? []);
  return list.map((p) => ({ ...p, id: String(p.id) }));
}