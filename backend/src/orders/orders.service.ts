import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { ProductsService } from '../products/products.service';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { calculateUnitPrice } from './pricing';
import { assertTransition, type OrderStatus } from './order-status';

@Injectable()
  export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly productsService: ProductsService,
  ) {}

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const orderId = 'ORD-' + Date.now();
    let total = 0;

    const itemsToCreate: OrderItem[] = [];

    for (let index = 0; index < createOrderDto.items.length; index++) {
      const item = createOrderDto.items[index];
      const product = await this.productsService.findById(item.productId);
      if (!product) {
        throw new BadRequestException(
          `Sản phẩm ${item.productId} không tồn tại`,
        );
      }

      // Backend recalculates the price; the client price is never trusted
      const unitPrice = calculateUnitPrice(
        product.price,
        item.size,
        item.toppingIds,
      );
      const lineTotal = unitPrice * item.qty;
      total += lineTotal;

      const orderItem = this.orderItemRepository.create({
        id: `${orderId}-${index + 1}`,
        orderId,
        productId: item.productId,
        size: item.size,
        toppingIds: item.toppingIds,
        qty: item.qty,
        unitPrice,
        lineTotal,
      });

      itemsToCreate.push(orderItem);
    }

    const order = this.orderRepository.create({
      id: orderId,
      userId,
      status: 'PENDING',
      total,
      items: itemsToCreate,
      createdAt: new Date(),
    });

    itemsToCreate.forEach((item) => {
      item.order = order;
    });

    // Save in transaction
    const savedOrder = await this.dataSource.transaction(async (manager) => {
      return manager.save(Order, order);
    });

    return {
      message: 'Tạo đơn hàng thành công',
      orderId: savedOrder.id,
      total: savedOrder.total,
      status: savedOrder.status,
      createdAt: savedOrder.createdAt,
    };
  }
async findById(orderId: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const order = await this.findById(orderId);
    if (!order) {
      throw new BadRequestException(`Đơn hàng ${orderId} không tồn tại`);
    }
   assertTransition(order.status, status);
    order.status = status;
    return this.orderRepository.save(order);
  }
  }

