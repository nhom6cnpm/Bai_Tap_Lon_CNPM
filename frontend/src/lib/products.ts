import type { Product } from '../types/product';

export class ProductNotFoundError extends Error {
  constructor() {
    super('Product not found');
    this.name = 'ProductNotFoundError';
  }
}

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  return configuredUrl ? configuredUrl.replace(/\/+$/, '') : 'http://localhost:3001';
}

function isProduct(value: unknown): value is Product {
  if (typeof value !== 'object' || value === null) return false;
  const product = value as Record<string, unknown>;
  return (
    typeof product.id === 'string' && product.id.length > 0 &&
    typeof product.name === 'string' && product.name.trim().length > 0 &&
    typeof product.price === 'number' && Number.isFinite(product.price) && product.price >= 0 &&
    typeof product.imageUrl === 'string' && product.imageUrl.trim().length > 0 &&
    typeof product.stock === 'number' && Number.isFinite(product.stock) && product.stock >= 0
  );
}

export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  const apiUrl = getApiBaseUrl();
  const response = await fetch(`${apiUrl}/products/${encodeURIComponent(id)}`, { signal, cache: 'no-store' });
  if (response.status === 404) throw new ProductNotFoundError();
  if (!response.ok) throw new Error(`Product request failed: ${response.status}`);

  let product: unknown;
  try {
    product = await response.json();
  } catch {
    throw new Error('Invalid product response');
  }

  if (!isProduct(product) || product.id !== id) {
    throw new Error('Invalid product response');
  }

  return {
    ...product,
    imageUrl: product.imageUrl.startsWith('/images/') ? product.imageUrl : '/images/product-placeholder.svg',
  };
}
