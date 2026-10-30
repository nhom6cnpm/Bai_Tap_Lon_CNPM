import { useQuery } from "@tanstack/react-query";
import { quoteVoucher } from "@/lib/vouchers";
import type { CartItem } from "@/store/useCart";

export function useVoucherQuote(
  items: CartItem[],
  code?: string,
  enabled = true,
) {
  const lines = items.map(({ productId, size, toppingIds, qty }) => ({
    productId,
    size,
    toppingIds,
    qty,
  }));
  return useQuery({
    queryKey: ["voucher-quote", lines, code ?? ""],
    queryFn: ({ signal }) => quoteVoucher(items, code, signal),
    enabled: enabled && items.length > 0,
    retry: false,
    refetchInterval: 30000,
  });
}
