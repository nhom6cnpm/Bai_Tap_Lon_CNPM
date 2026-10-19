'use client';
import Link from 'next/link';
import { useProducts } from '@/hooks/useProducts';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';

const NAV = [
  { label: 'Menu', href: '/menu' },
  { label: 'Giỏ hàng', href: '/cart' },
  { label: 'Đơn hàng', href: '/orders' },
];

export default function MenuPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useProducts();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/menu" className="text-xl font-bold text-amber-800">
            BrewLite
          </Link>
          <nav className="flex gap-1 text-sm sm:gap-3">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3 py-1.5 font-medium ${
                  n.href === '/menu' ? 'bg-amber-100 text-amber-900' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <p className="mb-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Nhận đồ uống tại quầy — không có phí giao hàng.
        </p>

        <h1 className="mb-4 text-2xl font-bold">Menu</h1>

        {/* Loading */}
        {isLoading && (
          <div
            className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
            aria-busy="true"
            aria-label="Đang tải sản phẩm"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="font-semibold text-red-800">Không tải được menu</p>
            <p className="mt-1 text-sm text-red-700">
              {error instanceof Error ? error.message : 'Đã có lỗi xảy ra, vui lòng thử lại.'}
            </p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-4 rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {isFetching ? 'Đang thử lại…' : 'Thử lại'}
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && data && data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <p className="text-4xl">☕</p>
            <p className="mt-2 font-semibold">Hiện chưa có sản phẩm nào</p>
            <p className="text-sm text-stone-500">Vui lòng quay lại sau nhé.</p>
          </div>
        )}

        {/* Danh sách sản phẩm */}
        {!isLoading && !isError && data && data.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}