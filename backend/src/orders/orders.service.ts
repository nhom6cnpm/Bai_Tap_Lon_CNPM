import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEntity } from '../database/entities';
import { OrderResponseDto } from './dto/order-response.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
  ) {}

  async findMine(userId: string): Promise<OrderResponseDto[]> {
    const orders = await this.orders.find({
      where: { userId },
      relations: { items: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return orders.map((order) => this.toResponse(order));
  }

  async findMineById(userId: string, id: string): Promise<OrderResponseDto> {
    const order = await this.orders.findOne({
      where: { id, userId },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return this.toResponse(order);
  }

  private toResponse(order: OrderEntity): OrderResponseDto {
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      pickupCode: order.pickupCode,
      paymentMethod: order.paymentMethod,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        size: item.size,
        toppings: item.toppings,
        qty: item.qty,
        lineTotal: item.lineTotal,
      })),
    };
  }
}
