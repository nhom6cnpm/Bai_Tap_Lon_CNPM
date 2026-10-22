'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { formatPrice } from '../../../lib/formatPrice';
import { calculateUnitPrice, sizeOptions, toppingOptions, type ProductSize, type ToppingId } from '../../../lib/productOptions';
import { getProduct, ProductNotFoundError } from '../../../lib/products';
import type { Product } from '../../../types/product';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#173c32]';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <main className="min-h-[80vh] bg-[#f8f5ed] px-4 py-7 text-[#173c32] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className={`mb-6 inline-flex items-center gap-2 text-sm font-semibold hover:underline ${focusRing}`}>
          <span aria-hidden="true">←</span> Quay lại thực đơn
        </Link>
        <ProductDetails key={id} id={id} />
      </div>
    </main>
  );
}

function ProductDetails({ id }: { id: string }) {
  const { data: product, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ['products', id],
    queryFn: ({ signal }) => getProduct(id, signal),
    staleTime: 30_000,
    retry: false,
  });

  if (isPending) return <ProductSkeleton />;
  if (!product) {
    const isMissing = error instanceof ProductNotFoundError;
    return (
      <section className="rounded-3xl border border-[#dce1d8] bg-white px-6 py-16 text-center" aria-labelledby="product-error">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#90663e]">BrewLite</p>
        <h1 id="product-error" className="text-2xl font-bold">{isMissing ? 'Sản phẩm không tồn tại' : 'Không tải được thông tin món'}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#64716a]">
          {isMissing ? 'Món này không có trong thực đơn. Vui lòng chọn món khác.' : 'Vui lòng kiểm tra kết nối và thử lại.'}
        </p>
        {isMissing ? (
          <Link href="/" className={`mt-6 inline-block rounded-xl bg-[#173c32] px-6 py-3 font-semibold text-white ${focusRing}`}>Về thực đơn</Link>
        ) : (
          <button type="button" onClick={() => void refetch()} disabled={isFetching}
            className={`mt-6 rounded-xl bg-[#173c32] px-6 py-3 font-semibold text-white disabled:opacity-50 ${focusRing}`}>
            {isFetching ? 'Đang thử lại…' : 'Thử lại'}
          </button>
        )}
      </section>
    );
  }
  return (
    <>
      {error && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Chưa cập nhật được thông tin món. Vui lòng thử lại trước khi chọn món.</p>}
      <ProductOptions key={product.id} product={product} isRefreshing={isFetching} hasRefreshError={Boolean(error)} onRetry={() => void refetch()} />
    </>
  );
}

function ProductSkeleton() {
  return (
    <section aria-busy="true" aria-label="Đang tải thông tin món" className="overflow-hidden rounded-3xl border border-[#dce1d8] bg-white md:grid md:grid-cols-[42%_58%]">
      <div aria-hidden="true" className="aspect-[4/3] animate-pulse bg-[#e6e5dc] motion-reduce:animate-none md:aspect-auto md:min-h-[600px]" />
      <div aria-hidden="true" className="space-y-6 p-6 sm:p-9">
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-[#eceee8] motion-reduce:animate-none" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-[#eceee8] motion-reduce:animate-none" />
        <div className="h-24 animate-pulse rounded-2xl bg-[#eceee8] motion-reduce:animate-none" />
        <div className="h-32 animate-pulse rounded-2xl bg-[#eceee8] motion-reduce:animate-none" />
        <div className="h-14 animate-pulse rounded-xl bg-[#eceee8] motion-reduce:animate-none" />
      </div>
      <span className="sr-only">Đang tải thông tin món…</span>
    </section>
  );
}

function ProductOptions({ product, isRefreshing, hasRefreshError, onRetry }: {
  product: Product;
  isRefreshing: boolean;
  hasRefreshError: boolean;
  onRetry: () => void;
}) {
  const [size, setSize] = useState<ProductSize>('S');
  const [toppingIds, setToppingIds] = useState<ToppingId[]>([]);
  const [requestedQuantity, setRequestedQuantity] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);
  const [message, setMessage] = useState('');
  const safeImageUrl = product.imageUrl?.startsWith('/images/') ? product.imageUrl : '/images/product-placeholder.svg';
  const isInStock = product.stock > 0;
  const quantity = Math.min(requestedQuantity, Math.max(1, product.stock));
  const unitPrice = calculateUnitPrice(product.price, size, toppingIds);
  const totalPrice = unitPrice * quantity;
  const isUnavailable = !isInStock || isRefreshing || hasRefreshError;

  function toggleTopping(toppingId: ToppingId) {
    setToppingIds((previous) => previous.includes(toppingId)
      ? previous.filter((value) => value !== toppingId)
      : [...previous, toppingId]);
    setMessage('');
  }

  function confirmSelection() {
    if (isUnavailable) return;
    const toppingNames = toppingOptions.filter((option) => toppingIds.includes(option.id)).map((option) => option.name).join(', ');
    // Sprint 1 confirmation only. Replace with the Task 5 cart store in Sprint 2.
    setMessage(`Đã xác nhận ${quantity} ly ${product.name}, size ${size}${toppingNames ? `, ${toppingNames}` : ', không topping'}. Thành tiền: ${formatPrice(totalPrice)}.`);
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#dce1d8] bg-white shadow-[0_12px_40px_#173c3208] md:grid md:grid-cols-[42%_58%]" aria-labelledby="product-name">
      <div className="relative aspect-[4/3] bg-[#e9e4d9] md:aspect-auto md:min-h-[650px]">
        <Image src={imageFailed ? '/images/product-placeholder.svg' : safeImageUrl}
          alt={imageFailed ? `Chưa có ảnh cho ${product.name}` : product.name}
          fill loading="eager" sizes="(max-width: 767px) 100vw, 42vw" className="object-cover"
          onError={() => setImageFailed(true)} />
        <span className="absolute top-5 left-5 rounded-full bg-white/95 px-4 py-2 text-xs font-bold tracking-wide shadow-sm">BREWLITE · NHẬN TẠI QUẦY</span>
        {imageFailed && <span className="absolute bottom-5 left-5 rounded-lg bg-white/95 px-3 py-2 text-sm">Ảnh món đang được cập nhật</span>}
      </div>
      <div className="p-5 sm:p-8 lg:p-10">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4 border-b border-[#e9ece4] pb-6">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.18em] text-[#90663e]">CHỌN MÓN THEO CÁCH CỦA BẠN</p>
            <h1 id="product-name" className="text-3xl font-bold tracking-tight sm:text-4xl">{product.name}</h1>
            <p className={`mt-3 text-sm ${isInStock ? 'text-[#64716a]' : 'font-semibold text-red-700'}`}>
              {isInStock ? `Còn ${product.stock} ly · Pha chế sau khi đặt` : 'Món hiện đã hết hàng'}
            </p>
          </div>
          <div className="sm:text-right"><p className="text-xs text-[#64716a]">Giá gốc</p><p className="mt-1 text-2xl font-bold">{formatPrice(product.price)}</p></div>
        </div>

        <fieldset className="mb-7 disabled:opacity-60" disabled={!isInStock}>
          <legend className="mb-3 font-bold">Chọn kích cỡ <span className="text-sm font-normal text-[#64716a]">(Size)</span></legend>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {sizeOptions.map((option) => (
              <label key={option.id} className={`relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-4 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-[#173c32] ${size === option.id ? 'border-[#173c32] bg-[#173c32] text-white' : 'border-[#dce1d8] bg-white hover:bg-[#f3f5ef]'}`}>
                <input type="radio" name="size" value={option.id} checked={size === option.id} className="sr-only"
                  onChange={() => { setSize(option.id); setMessage(''); }} />
                <span className="text-lg font-bold">Size {option.id}</span>
                <span className="text-xs sm:text-sm">{option.price === 0 ? 'Chuẩn (0đ)' : `+${formatPrice(option.price)}`}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-7 disabled:opacity-60" disabled={!isInStock}>
          <legend className="mb-3 font-bold">Topping thêm <span className="text-sm font-normal text-[#64716a]">(+5.000đ / loại)</span></legend>
          <div className="space-y-2">
            {toppingOptions.map((option) => (
              <label key={option.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${toppingIds.includes(option.id) ? 'border-[#799486] bg-[#f3f6ef]' : 'border-[#dce1d8]'}`}>
                <input type="checkbox" checked={toppingIds.includes(option.id)} onChange={() => toggleTopping(option.id)}
                  className={`size-4 shrink-0 accent-[#173c32] ${focusRing}`} />
                <span className="flex-1 text-sm sm:text-base">{option.name}</span><span className="text-sm font-semibold">+{formatPrice(option.price)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mb-6 flex items-center justify-between gap-3">
          <span className="font-semibold">Số lượng ly</span>
          <div className="flex items-center rounded-xl border border-[#dce1d8]">
            <button type="button" aria-label="Giảm số lượng" disabled={!isInStock || quantity <= 1}
              onClick={() => { setRequestedQuantity(quantity - 1); setMessage(''); }}
              className={`size-11 rounded-l-xl text-xl hover:bg-[#f3f5ef] disabled:opacity-30 ${focusRing}`}>−</button>
            <output aria-label="Số lượng" className="min-w-10 text-center font-bold">{quantity}</output>
            <button type="button" aria-label="Tăng số lượng" disabled={!isInStock || quantity >= product.stock}
              onClick={() => { setRequestedQuantity(quantity + 1); setMessage(''); }}
              className={`size-11 rounded-r-xl text-xl hover:bg-[#f3f5ef] disabled:opacity-30 ${focusRing}`}>+</button>
          </div>
        </div>

        <div aria-live="polite" aria-atomic="true" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f5f4ed] p-4 text-sm">
          <span>Đơn giá 1 ly: <strong>{formatPrice(unitPrice)}</strong></span>
          <span>Thành tiền: <strong className="ml-1 text-xl text-[#90663e]">{formatPrice(totalPrice)}</strong></span>
        </div>
        <button type="button" disabled={isUnavailable} onClick={confirmSelection}
          className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#173c32] px-4 py-3 font-bold text-white transition-colors hover:bg-[#245244] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}>
          {!isInStock ? 'Món đã hết hàng' : isRefreshing ? 'Đang cập nhật…' : `Thêm vào giỏ hàng · ${formatPrice(totalPrice)}`}
        </button>
        {hasRefreshError && <button type="button" onClick={onRetry} disabled={isRefreshing} className={`mt-3 text-sm font-semibold underline ${focusRing}`}>Thử tải lại thông tin món</button>}
        <p role="status" className="mt-3 min-h-10 text-sm leading-6 text-[#365e48]">{message}</p>
      </div>
    </section>
  );
}
