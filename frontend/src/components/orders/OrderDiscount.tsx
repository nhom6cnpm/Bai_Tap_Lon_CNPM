import { formatPrice } from "@/lib/formatPrice";
import type { Order } from "@/types/order";

export default function OrderDiscount({ order }: { order: Order }) {
  if (!order.voucherCode) return null;
  return (
    <div className="mt-4 space-y-2 border-t border-stone-100 pt-4 text-sm">
      <p className="flex items-center justify-between gap-3">
        <span>Tạm tính</span>
        <span>{formatPrice(order.subtotal)}</span>
      </p>
      <p className="flex items-center justify-between gap-3 text-green-800">
        <span className="min-w-0 break-all">Ưu đãi {order.voucherCode}</span>
        <span className="shrink-0">−{formatPrice(order.discount)}</span>
      </p>
    </div>
  );
}
