import { getApiBaseUrl } from "./products";
import type { ProductSize } from "./productOptions";

export interface AvailabilityLine {
  productId: string;
  size: ProductSize;
  toppingIds: readonly string[];
  qty: number;
}

export interface CartAvailability {
  available: boolean;
  items: (AvailabilityLine & { stock: number })[];
}

export async function getCartAvailability(
  items: readonly AvailabilityLine[],
  signal?: AbortSignal,
): Promise<CartAvailability> {
  const response = await fetch(`${getApiBaseUrl()}/products/availability`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    cache: "no-store",
    signal,
    body: JSON.stringify({ items }),
  });
  if (!response.ok) {
    throw new Error("Không kiểm tra được số ly còn bán. Vui lòng thử lại.");
  }
  return response.json() as Promise<CartAvailability>;
}
