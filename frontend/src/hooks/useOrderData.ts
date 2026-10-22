"use client";

import { useEffect, useState } from "react";
import { ACCESS_TOKEN_KEY, ApiError, getMyOrder, getMyOrders } from "@/lib/api";
import { demoOrders } from "@/lib/demoOrders";
import type { Order } from "@/types/order";

export type DemoState = "ready" | "loading" | "empty" | "error";
type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string; unauthorized: boolean }
  | { status: "ready"; orders: Order[] };

export function useOrderData(
  demo: boolean,
  id?: string,
  demoState: DemoState = "ready",
) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    async function load() {
      try {
        if (!window.sessionStorage.getItem(ACCESS_TOKEN_KEY))
          throw new ApiError(
            401,
            "Vui lòng đăng nhập để xem đơn hàng của bạn.",
          );
        const orders = id
          ? [await getMyOrder(id, controller.signal)]
          : await getMyOrders(controller.signal);
        if (!controller.signal.aborted) setState({ status: "ready", orders });
      } catch (error) {
        if (!controller.signal.aborted)
          setState({
            status: "error",
            message:
              error instanceof ApiError
                ? error.message
                : "Không thể kết nối máy chủ.",
            unauthorized: error instanceof ApiError && error.status === 401,
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [demo, id, revision]);

  let result = state;
  if (demo) {
    if (demoState === "loading") result = { status: "loading" };
    else if (demoState === "error")
      result = {
        status: "error",
        message: "Không thể tải đơn hàng. Vui lòng thử lại.",
        unauthorized: false,
      };
    else
      result = {
        status: "ready",
        orders:
          demoState === "empty"
            ? []
            : id
              ? demoOrders.filter((order) => order.id === id)
              : demoOrders,
      };
  }
  function retry() {
    setState({ status: "loading" });
    setRevision((value) => value + 1);
  }
  return { state: result, retry };
}
