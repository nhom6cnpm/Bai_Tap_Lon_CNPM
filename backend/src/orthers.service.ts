import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private orders = [];

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const { items } = createOrderDto;
    let totalOrderAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const basePrice = 50000;
      const sizeSurcharge = item.size === 'L' ? 15000 : item.size === 'M' ? 10000 : 0;
      const toppingsPrice = item.toppingIds.length * 5000;

      const unitPrice = basePrice + sizeSurcharge + toppingsPrice;
      const lineTotal = unitPrice * item.qty;

      totalOrderAmount += lineTotal;

      processedItems.push({
        id: 'ITEM-' + Math.random().toString(36).substring(2, 9),
        productId: item.productId,
        size: item.size,
        toppingIds: item.toppingIds,
        qty: item.qty,
        unitPrice,
        lineTotal,
      });
    }

    const newOrder = {
      id: 'ORD-' + Date.now(),
      userId,
      status: 'PENDING',
      total: totalOrderAmount,
      items: processedItems,
      createdAt: new Date(),
    };

    this.orders.push(newOrder);

    return {
      message: 'Tạo đơn hàng thành công',
      orderId: newOrder.id,
      total: newOrder.total,
      status: newOrder.status,
    };
  }
}
