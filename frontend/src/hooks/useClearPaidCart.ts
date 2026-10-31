"use client";

import { useEffect } from "react";
import { isPaid } from "@/lib/orderUtils";
import {
  clearActiveCheckout,
  getCartFingerprint,
  getCheckout,
} from "@/lib/payments/storage";
import { useCart } from "@/store/useCart";
import type { OrderStatus } from "@/types/order";

interface OrderLike {
  id: string;
  status: OrderStatus;
}

/**
 * Empty the cart once its order is paid. Only the cart this order was placed
 * from is cleared: if the customer has since changed the cart (a newer,
 * different cart), it is kept.
 */
export function clearCartIfPaid(order: OrderLike): void {
  if (!isPaid(order.status)) return;
  const checkout = getCheckout(order.id);
  const cart = useCart.getState();
  if (
    checkout &&
    cart.items.length > 0 &&
    checkout.cartFingerprint === getCartFingerprint(cart.items)
  )
    cart.clear();
  clearActiveCheckout(order.id);
}

/**
 * Wherever the customer sees that an order is paid (cart, order detail,
 * confirmation, history), its cart is emptied, even if they were not on the
 * payment page when staff confirmed the payment.
 */
export function useClearPaidCart(orders: readonly OrderLike[] | undefined) {
  const paidIds = (orders ?? [])
    .filter((order) => isPaid(order.status))
    .map((order) => order.id)
    .join(",");
  useEffect(() => {
    if (!paidIds) return;
    for (const id of paidIds.split(","))
      clearCartIfPaid({ id, status: "PAID" });
  }, [paidIds]);
}
