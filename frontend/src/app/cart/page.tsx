"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, getLineKey, selectTotalPrice, type CartItem } from "@/store/useCart";
import { useHydrated } from "@/hooks/useHydrated";
import { useAvailability } from "@/hooks/useAvailability";
import { formatPrice } from "@/lib/formatPrice";
import { toppingOptions } from "@/lib/productOptions";
import { getStoredToken } from "@/lib/auth";
import { submitOrderApi } from "@/lib/orders/orders";
import { getActiveCheckout, saveCheckout } from '@/lib/payments/storage';

const toppingLabel = (ids: string[]) =>
  ids.length
    ? ids
        .map((id) => toppingOptions.find((opt) => opt.id === id)?.name ?? id)
        .join(", ")
    : "Không topping";

const cartFingerprint = (items: CartItem[]) => JSON.stringify(items
  .map((item) => ({ key: getLineKey(item), qty: item.qty }))
  .sort((left, right) => left.key.localeCompare(right.key)));

export default function CartPage() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const total = useCart(selectTotalPrice);
  const setQty = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.removeItem);
  const router = useRouter();
  const availability = useAvailability(items, hydrated);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckout = async () => {
    setErrorMessage(null);

    // Not logged in yet: go to login, then come back to the cart
    if (!getStoredToken()) {
      router.push("/login?redirect=/cart");
      return;
    }

    const fingerprint = cartFingerprint(items);
    const activeOrder = getActiveCheckout(fingerprint);
    if (activeOrder) {
      router.push(`/checkout/${encodeURIComponent(activeOrder.orderId)}`);
      return;
    }

    setLoading(true);
    try {
      const latest = await availability.refetch();
      if (latest.isError || !latest.data) {
        throw new Error("Không kiểm tra được số ly còn bán. Vui lòng thử lại.");
      }
      if (!latest.data.available) {
        throw new Error(
          "Giỏ hàng vượt số ly còn bán. Vui lòng giảm số lượng hoặc đổi lựa chọn.",
        );
      }
      const data = await submitOrderApi(items);
      saveCheckout({ orderId: data.orderId, total: data.total, createdAt: data.createdAt, expiresAt: data.expiresAt, cartFingerprint: fingerprint });
      router.push(`/checkout/${encodeURIComponent(data.orderId)}`);
    } catch (err: unknown) {
      // Keep the cart unchanged so the user can try again
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Đã có lỗi xảy ra khi kết nối tới máy chủ.",
      );
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
            {items.map((item, index) => {
              const key = getLineKey(item);
              const stock = availability.data?.items[index]?.stock;
              return (
                <li
                  key={key}
                  className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:p-4"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                        <p className="text-sm text-stone-500">
                          {formatPrice(item.unitPrice)} / ly
                        </p>
                        {availability.data &&
                          !availability.isError &&
                          stock !== undefined && (
                            <p
                              className={`mt-1 text-sm ${item.qty > stock ? "font-semibold text-red-700" : "text-stone-600"}`}
                            >
                              Chỉ còn {stock} ly theo lựa chọn này
                              {item.qty > stock
                                ? " — vui lòng giảm số lượng"
                                : ""}
                            </p>
                          )}
                      </div>
                      <button
                        disabled={loading}
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
                          disabled={loading || item.qty <= 1}
                          aria-label="Giảm số lượng"
                          className="h-8 w-8 rounded-full border border-stone-300 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-medium">
                          {item.qty}
                        </span>
                        <button
                          disabled={
                            loading ||
                            availability.isPending ||
                            availability.isFetching ||
                            availability.isError ||
                            stock === undefined ||
                            item.qty >= Math.min(99, stock)
                          }
                          onClick={() => setQty(key, item.qty + 1)}
                          aria-label="Tăng số lượng"
                          className="h-8 w-8 rounded-full border border-stone-300 disabled:opacity-40"
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
            <div role="status" className="mb-4 text-sm text-stone-600">
              {availability.isPending
                ? "Đang kiểm tra số ly còn bán…"
                : availability.isError
                  ? "Không kiểm tra được nguyên liệu. Vui lòng thử lại."
                  : availability.data?.available
                    ? "Đủ nguyên liệu theo lựa chọn hiện tại."
                    : "Chưa đủ nguyên liệu cho toàn bộ giỏ hàng. Vui lòng điều chỉnh số lượng."}
              <p className="mt-1">
                Số ly của mỗi món đã tính phần nguyên liệu dành cho các món khác
                trong giỏ.
              </p>
              {availability.isError && (
                <button
                  type="button"
                  onClick={() => void availability.refetch()}
                  disabled={availability.isFetching}
                  className="mt-2 font-semibold underline"
                >
                  Thử kiểm tra lại
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Tổng tiền</span>
              <span className="text-amber-800">{formatPrice(total)}</span>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {errorMessage}
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
                disabled={
                  loading ||
                  availability.isPending ||
                  availability.isFetching ||
                  availability.isError ||
                  !availability.data?.available
                }
                className="flex-1 rounded-full bg-amber-700 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {loading ? 'Đang tạo đơn…' : `Đặt hàng · ${formatPrice(total)}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
