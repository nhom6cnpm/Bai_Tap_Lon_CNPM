import { OrderConfirmation } from "@/components/orders/OrderConfirmation";
export default async function DemoConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderConfirmation key={id} id={id} demo />;
}
