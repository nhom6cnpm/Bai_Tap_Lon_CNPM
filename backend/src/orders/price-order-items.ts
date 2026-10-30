import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Product } from '../products/product.entity';
import type { OrderItemDto } from './dto/create-order.dto';
import { calculateUnitPrice } from './pricing';

/** Quotes and order creation must use the same server-side prices. */
export async function priceOrderItems(
  manager: EntityManager,
  items: OrderItemDto[],
) {
  let subtotal = 0;
  const lines = [];
  for (const item of items) {
    const product = await manager
      .getRepository(Product)
      .findOneBy({ id: item.productId });
    if (!product)
      throw new BadRequestException(`Sản phẩm ${item.productId} không tồn tại`);
    const unitPrice = calculateUnitPrice(
      product.price,
      item.size,
      item.toppingIds,
    );
    const lineTotal = unitPrice * item.qty;
    subtotal += lineTotal;
    if (!Number.isSafeInteger(subtotal) || subtotal > 2_147_483_647)
      throw new BadRequestException('Tổng tiền đơn hàng vượt giới hạn lưu trữ');
    lines.push({
      productId: item.productId,
      size: item.size,
      toppingIds: item.toppingIds,
      qty: item.qty,
      productName: product.name,
      productImageUrl: product.imageUrl,
      unitPrice,
      lineTotal,
    });
  }
  return { subtotal, lines };
}
