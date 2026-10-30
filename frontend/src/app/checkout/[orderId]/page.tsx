import { OrderCheckout } from "@/components/orders/OrderCheckout";
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <OrderCheckout key={orderId} id={orderId} />;
}
