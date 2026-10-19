import Link from 'next/link';
import type { Product } from '@/types/product';
import { formatPrice } from '@/lib/formatPrice';

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/menu/${product.id}`}
      className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-amber-700"
    >
      <div className="aspect-square w-full bg-stone-100">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">☕</div>
        )}
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="line-clamp-1 font-semibold text-stone-900">{product.name}</h3>
        <p className="mt-1 font-medium text-amber-800">{formatPrice(product.price)}</p>
      </div>
    </Link>
  );
}