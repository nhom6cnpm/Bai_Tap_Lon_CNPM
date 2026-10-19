'use client';
import { useProducts } from '@/hooks/useProducts';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/ProductCardSkeleton';

const GRID = 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3';

export default function MenuPage() {
  const { data, isLoading, isError, refetch, isFetching } = useProducts();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <p className="mb-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Nhận đồ uống tại quầy — không có phí giao hàng.
      </p>

      <h1 className="mb-4 text-2xl font-bold">Menu</h1>

      {/* Đang tải */}
      {isLoading && (
        <div className={GRID} aria-busy="true" aria-label="Đang tải thực đơn">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Lỗi API */}
      {isError && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-800">Không tải được thực đơn, thử lại</p>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-4 rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {isFetching ? 'Đang thử lại…' : 'Thử lại'}
          </button>
        </div>
      )}

      {/* Không có món */}
      {!isLoading && !isError && data && data.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-4xl">☕</p>
          <p className="mt-2 font-semibold">Chưa có món nào</p>
        </div>
      )}

      {/* Danh sách */}
      {!isLoading && !isError && data && data.length > 0 && (
        <div className={GRID}>
          {data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}