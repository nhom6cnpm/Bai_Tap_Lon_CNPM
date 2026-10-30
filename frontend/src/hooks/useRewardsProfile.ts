"use client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { useHydrated } from "./useHydrated";
import { refreshRewardsProfile } from "@/lib/rewardsProfile";
import type { Order } from "@/types/order";

export function useRewardsProfile() {
  const { token } = useAuth();
  const hydrated = useHydrated();
  return useQuery({
    queryKey: ["rewards-profile", token],
    queryFn: ({ signal }) => refreshRewardsProfile(token!, signal),
    enabled: hydrated && !!token,
    retry: false,
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

/** React to persisted benefit markers, rather than guessing a reward from PAID alone. */
export function useOrderRewardsSync(orders: readonly Order[]) {
  const { token } = useAuth();
  const client = useQueryClient();
  const snapshot = JSON.stringify(
    orders
      .filter((order) => order.benefitsPolicyVersion === 1)
      .map((order) => [
        order.id,
        order.status,
        order.pointsAwardedAt,
        order.pointsReversedAt,
      ]),
  );
  useEffect(() => {
    if (!token || snapshot === "[]") return;
    void client.invalidateQueries({ queryKey: ["rewards-profile", token] });
    void client.invalidateQueries({ queryKey: ["voucher-quote", token] });
  }, [client, token, snapshot]);
}
