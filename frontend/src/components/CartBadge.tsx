'use client';
import { useCart, selectTotalQty } from '@/store/useCart';

export default function CartBadge() {
  const totalQty = useCart(selectTotalQty);
  if (totalQty <= 0) return null;

  return (
    <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-700 px-1.5 text-xs font-semibold text-white">
      {totalQty}
    </span>
  );
}