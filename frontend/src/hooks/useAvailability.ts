"use client";

import { useQuery } from "@tanstack/react-query";
import { getCartAvailability, type AvailabilityLine } from "@/lib/availability";

export function useAvailability(
  lines: readonly AvailabilityLine[],
  enabled = true,
) {
  const items = lines.map(({ productId, size, toppingIds, qty }) => ({
    productId,
    size,
    toppingIds: [...toppingIds].sort(),
    qty,
  }));
  return useQuery({
    queryKey: ["availability", items],
    queryFn: ({ signal }) => getCartAvailability(items, signal),
    enabled: enabled && items.length > 0,
    staleTime: 0,
    refetchInterval: 15_000,
    retry: false,
  });
}
