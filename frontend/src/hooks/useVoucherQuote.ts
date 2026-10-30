import { useQuery } from "@tanstack/react-query";
import { quoteVoucher } from "@/lib/vouchers";
import type { CartItem } from "@/store/useCart";
import { useAuth } from "./useAuth";
import { useHydrated } from "./useHydrated";

export function useVoucherQuote(
  items: CartItem[],
  code?: string,
  enabled = true,
  refetchInterval = 15_000,
) {
  const { token } = useAuth();
  const hydrated = useHydrated();
  const lines = items.map(({ productId, size, toppingIds, qty }) => ({
    productId,
    size,
    toppingIds,
    qty,
  }));
  return useQuery({
    queryKey: ["voucher-quote", token, lines, code ?? ""],
    queryFn: ({ signal }) => quoteVoucher(items, code, signal, token),
    enabled: hydrated && enabled && items.length > 0,
    retry: false,
    refetchInterval,
    refetchOnWindowFocus: true,
  });
}
