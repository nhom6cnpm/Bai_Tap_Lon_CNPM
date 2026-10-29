"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { useHydrated } from "./useHydrated";
import { getMyOrder, getMyOrders } from "@/lib/orders/history";

export function useOrderHistory() {
  const { token } = useAuth();
  const hydrated = useHydrated();
  const query = useQuery({
    queryKey: ["orders", "history", token],
    queryFn: ({ signal }) => getMyOrders(signal),
    enabled: hydrated && !!token,
    retry: false,
    staleTime: 0,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
  return { ...query, authenticated: hydrated && !!token, hydrated };
}

export function useOwnOrder(
  id: string,
  refetchInterval: number | false = 3_000,
) {
  const { token } = useAuth();
  const hydrated = useHydrated();
  const query = useQuery({
    queryKey: ["orders", "detail", id, token],
    queryFn: ({ signal }) => getMyOrder(id, signal),
    enabled: hydrated && !!token && !!id,
    retry: false,
    staleTime: 0,
    refetchInterval,
    refetchOnWindowFocus: true,
  });
  return { ...query, authenticated: hydrated && !!token, hydrated };
}

/** Advance the backend clock using elapsed client time, without trusting the client's timezone/clock offset. */
export function useOrderClock(
  serverTime: string | undefined,
  receivedAt: number,
): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return serverTime
    ? Date.parse(serverTime) + Math.max(0, now - receivedAt)
    : now;
}
