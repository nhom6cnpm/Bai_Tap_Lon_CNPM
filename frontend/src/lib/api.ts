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

// Chuẩn hoá dữ liệu backend -> kiểu Product của FE
function normalizeProduct(raw: Record<string, unknown>): Product {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    price: Number(raw.price ?? 0),
    imageUrl: (raw.imageUrl ?? raw.image ?? raw.image_url ?? null) as string | null,
    description: raw.description ? String(raw.description) : undefined,
  };
}

export async function fetchProducts(): Promise<Product[]> {
  const raw = await apiGet<unknown>('/products');
  const list = Array.isArray(raw)
    ? raw
    : ((raw as { data?: unknown[] })?.data ?? []);
  return (list as Record<string, unknown>[]).map(normalizeProduct);
}

export async function fetchProduct(id: string): Promise<Product> {
  const raw = await apiGet<Record<string, unknown>>(`/products/${id}`);
  const item = (raw?.data ?? raw) as Record<string, unknown>;
  return normalizeProduct(item);
}