'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useProduct } from '@/hooks/useProduct';
import { formatPrice } from '@/lib/formatPrice';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: product, isLoading, isError } = useProduct(params.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/menu" className="text-sm font-medium text-amber-800 hover:underline">
        ← Quay lại menu
      </Link>

      {isLoading && <p className="mt-6 text-stone-500">Đang tải…</p>}
      {isError && (
        <p role="alert" className="mt-6 text-red-700">
          Không tìm thấy sản phẩm hoặc có lỗi khi tải.
        </p>
      )}

      {product && (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="aspect-square overflow-hidden rounded-2xl bg-stone-100">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl">☕</div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="mt-2 text-xl font-semibold text-amber-800">{formatPrice(product.price)}</p>
            {product.description && <p className="mt-3 text-stone-600">{product.description}</p>}
          </div>
        </div>
      )}
    </main>
  );
}