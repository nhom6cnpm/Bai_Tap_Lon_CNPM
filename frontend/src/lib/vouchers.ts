import { getApiBaseUrl } from "@/lib/products";
import type { CartItem } from "@/store/useCart";

export interface VoucherOption {
  code: string;
  title: string;
  discountType: "FIXED" | "PERCENT";
  discountValue: number;
  minSubtotal: number;
  maxDiscount: number | null;
  startsAt: string;
  endsAt: string;
  unavailableReason: string | null;
  discount: number;
}

export interface VoucherQuote {
  subtotal: number;
  discount: number;
  total: number;
  voucherCode: string | null;
  voucherTitle: string | null;
  serverTime: string;
  vouchers: VoucherOption[];
}

export async function quoteVoucher(
  items: CartItem[],
  voucherCode?: string,
  signal?: AbortSignal,
): Promise<VoucherQuote> {
  const response = await fetch(`${getApiBaseUrl()}/vouchers/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    cache: "no-store",
    signal,
    body: JSON.stringify({
      items: items.map(({ productId, size, toppingIds, qty }) => ({
        productId,
        size,
        toppingIds,
        qty,
      })),
      ...(voucherCode ? { voucherCode } : {}),
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join(" ")
      : data?.message;
    throw new Error(
      typeof message === "string"
        ? message
        : "Không kiểm tra được mã giảm giá. Vui lòng thử lại.",
    );
  }
  if (
    !data ||
    !Number.isSafeInteger(data.subtotal) ||
    data.subtotal < 0 ||
    !Number.isSafeInteger(data.discount) ||
    data.discount < 0 ||
    !Number.isSafeInteger(data.total) ||
    data.total < 0 ||
    data.total !== data.subtotal - data.discount ||
    !Array.isArray(data.vouchers) ||
    (data.voucherCode !== null && typeof data.voucherCode !== "string")
  )
    throw new Error("Dữ liệu ưu đãi chưa hợp lệ. Vui lòng thử lại.");
  return data as VoucherQuote;
}
