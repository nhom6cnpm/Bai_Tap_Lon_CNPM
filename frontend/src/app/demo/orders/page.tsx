import { OrderHistory } from "@/components/orders/OrderHistory";
import type { DemoState } from "@/hooks/useOrderData";
export default async function DemoOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const demoState: DemoState =
    state === "empty" || state === "loading" || state === "error"
      ? state
      : "ready";
  return <OrderHistory demo demoState={demoState} />;
}
