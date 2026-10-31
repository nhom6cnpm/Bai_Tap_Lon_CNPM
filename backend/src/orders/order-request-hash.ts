import { createHash } from 'crypto';
import type { CreateOrderDto } from './dto/create-order.dto';

/**
 * Fingerprint of what the customer asked for. Item order and topping order do
 * not matter; quantities, sizes and the voucher do.
 */
export function orderRequestHash(dto: CreateOrderDto): string {
  const items = dto.items
    .map((item) => ({
      productId: String(item.productId),
      size: item.size,
      toppingIds: [...item.toppingIds].sort(),
      qty: item.qty,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
  const voucherCode = dto.voucherCode?.trim().toUpperCase() || null;
  return createHash('sha256')
    .update(JSON.stringify({ items, voucherCode }))
    .digest('hex');
}
