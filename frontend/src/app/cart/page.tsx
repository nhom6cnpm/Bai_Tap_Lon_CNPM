"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, getLineKey, selectTotalPrice } from "@/store/useCart";
import { useHydrated } from "@/hooks/useHydrated";
import { useAvailability } from "@/hooks/useAvailability";
import { formatPrice } from "@/lib/formatPrice";
import { toppingOptions } from "@/lib/productOptions";
import { getStoredToken } from "@/lib/auth";
import { submitOrderApi } from "@/lib/orders/orders";
import {
  clearActiveCheckout,
  getActiveCheckout,
  getCartFingerprint,
  saveCheckout,
} from "@/lib/payments/storage";
import { useOwnOrder, useOrderClock } from "@/hooks/useOrderHistory";
import { getMyOrder, OrderApiError } from "@/lib/orders/history";
import { canPay, isPaid } from "@/lib/orderUtils";
import VoucherPicker from "@/components/VoucherPicker";
import { useVoucherQuote } from "@/hooks/useVoucherQuote";

const toppingLabel = (ids: string[]) =>
  ids.length
    ? ids
        .map((id) => toppingOptions.find((opt) => opt.id === id)?.name ?? id)
        .join(", ")
    : "Không topping";

export default function CartPage() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const total = useCart(selectTotalPrice);
  const voucherCode = useCart((s) => s.voucherCode);
  const setVoucherCode = useCart((s) => s.setVoucherCode);
  const setQty = useCart((s) => s.setQty);
  const removeItem = useCart((s) => s.removeItem);
  const router = useRouter();
  const availability = useAvailability(items, hydrated);
  const candidate =
    hydrated && items.length
      ? getActiveCheckout(getCartFingerprint(items))
      : null;
  const activeOrder = useOwnOrder(candidate?.orderId ?? "");
  const now = useOrderClock(
    activeOrder.data?.serverTime,
    activeOrder.dataUpdatedAt,
  );
  const resume =
    !!candidate &&
    !!activeOrder.data &&
    (canPay(activeOrder.data, now) || isPaid(activeOrder.data.status));
  const requestInFlight = useRef(false);
  const quote = useVoucherQuote(
    items,
    voucherCode || undefined,
    hydrated && !resume,
  );
  const savedOrder = resume ? activeOrder.data : undefined;
  const currentQuote = quote.isError ? undefined : quote.data;
  const displayedSubtotal =
    savedOrder?.subtotal ?? currentQuote?.subtotal ?? total;
  const displayedDiscount = savedOrder?.discount ?? currentQuote?.discount ?? 0;
  const displayedTotal = savedOrder?.total ?? currentQuote?.total ?? total;

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (requestInFlight.current) return;
    setErrorMessage(null);

    // Not logged in yet: go to login, then come back to the cart
    if (!getStoredToken()) {
      router.push("/login?redirect=/cart");
      return;
    }

    const fingerprint = getCartFingerprint(items);
    requestInFlight.current = true;
    setLoading(true);
    try {
      if (candidate) {
        try {
          const current = await getMyOrder(candidate.orderId);
          if (current.canPay) {
            router.push(`/checkout/${encodeURIComponent(current.id)}`);
            return;
          }
          if (isPaid(current.status)) {
            useCart.getState().clear();
            clearActiveCheckout(current.id);
            router.push(
              `/orders/${encodeURIComponent(current.id)}${current.status === "PAID" ? "/confirmation" : ""}`,
            );
            return;
          }
          clearActiveCheckout(candidate.orderId);
        } catch (cause) {
          if (cause instanceof OrderApiError && cause.status === 404)
            clearActiveCheckout(candidate.orderId);
          else throw cause;
        }
      }
      const latest = await availability.refetch();
      if (latest.isError || !latest.data) {
        throw new Error("Không kiểm tra được số ly còn bán. Vui lòng thử lại.");
      }
      if (!latest.data.available) {
        throw new Error(
          "Giỏ hàng vượt số ly còn bán. Vui lòng giảm số lượng hoặc đổi lựa chọn.",
        );
      }
      const data = await submitOrderApi(items, voucherCode || undefined);
      saveCheckout({
        orderId: data.orderId,
        total: data.total,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        cartFingerprint: fingerprint,
      });
      router.push(`/checkout/${encodeURIComponent(data.orderId)}`);
    } catch (err: unknown) {
      // Keep the cart unchanged so the user can try again
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Đã có lỗi xảy ra khi kết nối tới máy chủ.",
      );
    } finally {
      requestInFlight.current = false;
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
                        {!resume &&
                          availability.data &&
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
              {resume
                ? "Bạn có đơn hàng cho giỏ này. Tiếp tục để kiểm tra và thanh toán."
                : availability.isPending
                  ? "Đang kiểm tra số ly còn bán…"
                  : availability.isError
                    ? "Không kiểm tra được nguyên liệu. Vui lòng thử lại."
                    : availability.data?.available
                      ? "Đủ nguyên liệu theo lựa chọn hiện tại."
                      : "Chưa đủ nguyên liệu cho toàn bộ giỏ hàng. Vui lòng điều chỉnh số lượng."}
              {!resume && (
                <p className="mt-1">
                  Số ly của mỗi món đã tính phần nguyên liệu dành cho các món
                  khác trong giỏ.
                </p>
              )}
              {!resume && availability.isError && (
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
            <div className="flex items-center justify-between text-sm">
              <span>Tạm tính</span>
              <span>{formatPrice(displayedSubtotal)}</span>
            </div>
            <VoucherPicker
              items={items}
              selectedCode={
                savedOrder?.voucherCode ?? (resume ? "" : voucherCode)
              }
              onSelect={setVoucherCode}
              disabled={
                loading || resume || (!!candidate && activeOrder.isPending)
              }
            />
            {!resume && voucherCode && quote.isError && (
              <div
                role="alert"
                className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"
              >
                {quote.error.message} Bạn có thể đổi hoặc bỏ mã để tiếp tục.
                <button
                  onClick={() => void quote.refetch()}
                  className="ml-2 font-semibold underline"
                >
                  Thử lại
                </button>
              </div>
            )}
            {!resume && voucherCode && quote.isFetching && (
              <p role="status" className="mb-3 text-sm text-stone-500">
                Đang kiểm tra ưu đãi…
              </p>
            )}
            {(displayedDiscount > 0 ||
              savedOrder?.voucherCode ||
              voucherCode) && (
              <div className="mb-3 flex items-center justify-between text-sm text-green-800">
                <span>Giảm giá</span>
                <span>−{formatPrice(displayedDiscount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Tổng thanh toán</span>
              <span className="text-amber-800">
                {formatPrice(displayedTotal)}
              </span>
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
                  (!!candidate && activeOrder.isPending) ||
                  (!resume &&
                    !!voucherCode &&
                    (quote.isPending || quote.isFetching || quote.isError)) ||
                  (!resume &&
                    (availability.isPending ||
                      availability.isFetching ||
                      availability.isError ||
                      !availability.data?.available))
                }
                className="flex-1 rounded-full bg-amber-700 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {loading
                  ? "Đang xử lý…"
                  : resume
                    ? "Tiếp tục đơn hàng"
                    : `Đặt hàng · ${formatPrice(displayedTotal)}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
