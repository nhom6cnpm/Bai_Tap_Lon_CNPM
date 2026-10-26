'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart, getLineKey, selectTotalPrice } from '@/store/useCart';
import { useHydrated } from '@/hooks/useHydrated';
import { formatPrice } from '@/lib/formatPrice';
import { submitOrderApi } from '@/lib/order';

const TOPPING_NAMES: Record<string, string> = {
  kem: 'Kem',
  'tran-chau': 'Trân châu',
};

const toppingLabel = (ids: string[]) =>
  ids.length ? ids.map((id) => TOPPING_NAMES[id] ?? id).join(', ') : 'Không topping';

export default function CartPage() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const total = useCart(selectTotalPrice);
  const setQty = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.removeItem);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCheckout = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const data = await submitOrderApi(items);
      setSuccessMessage(`Đặt hàng thành công! Mã đơn hàng của bạn: ${data.orderId || data.id}`);
      useCart.getState().clear();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Đã có lỗi xảy ra khi kết nối tới máy chủ.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Giỏ hàng</h1>

      {!hydrated && <p className="text-stone-500">Đang tải giỏ hàng…</p>}

      {hydrated && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <p className="text-4xl">🛒</p>
          <p className="mt-2 font-semibold">Giỏ hàng trống</p>
          <Link
            href="/menu"
            className="mt-4 inline-block rounded-full bg-amber-700 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-800"
          >
            Về Menu
          </Link>
        </div>
      )}

      {hydrated && items.length > 0 && (
        <>
          <ul className="space-y-3">
            {items.map((item) => {
              const key = getLineKey(item);
              return (
                <li
                  key={key}
                  className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:p-4"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-20 w-20 shrink-0 rounded-xl bg-stone-100 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold">{item.name}</h2>
                        <p className="text-sm text-stone-600">
                          Size {item.size} · {toppingLabel(item.toppingIds)}
                        </p>
                        <p className="text-sm text-stone-500">{formatPrice(item.unitPrice)} / ly</p>
                      </div>
                      <button
                        onClick={() => removeItem(key)}
                        className="shrink-0 text-sm font-medium text-red-700 hover:underline"
                      >
                        Xóa
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setQty(key, item.qty - 1)}
                          disabled={item.qty <= 1}
                          aria-label="Giảm số lượng"
                          className="h-8 w-8 rounded-full border border-stone-300 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-medium">{item.qty}</span>
                        <button
                          onClick={() => setQty(key, item.qty + 1)}
                          aria-label="Tăng số lượng"
                          className="h-8 w-8 rounded-full border border-stone-300"
                        >
                          +
                        </button>
                      </div>
                      <p className="font-semibold text-amber-800">
                        {formatPrice(item.unitPrice * item.qty)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Tổng tiền</span>
              <span className="text-amber-800">{formatPrice(total)}</span>
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            {successMessage && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 font-semibold">
                {successMessage}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/menu"
                className="rounded-full border border-stone-300 px-5 py-2 text-center text-sm font-semibold hover:bg-stone-100"
              >
                Tiếp tục mua
              </Link>
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="flex-1 rounded-full bg-amber-700 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {loading ? 'Đang xử lý...' : 'Đặt hàng'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
