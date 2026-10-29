import { OrderDetail } from "@/components/orders/OrderDetail";
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetail key={id} id={id} confirmation />;
}
