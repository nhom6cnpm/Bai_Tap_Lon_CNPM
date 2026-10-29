import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { Product } from '../products/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import type {
  CreateOrderResponseDto,
  CancelOrderResponseDto,
} from './dto/order-mutation-response.dto';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderInventoryReservation } from './order-inventory-reservation.entity';
import {
  ORDER_PAYMENT_WINDOW_MS,
  type CancellationReason,
} from './order-expiry';
import { calculateUnitPrice } from './pricing';
import { assertTransition, type OrderStatus } from './order-status';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly inventoryService: InventoryService,
  ) {}

  async databaseNow(manager: EntityManager): Promise<Date> {
    const rows = await manager.query<Array<{ now: Date }>>(
      'SELECT clock_timestamp() AS now',
    );
    return new Date(rows[0].now);
  }

  async createOrder(
    userId: string,
    dto: CreateOrderDto,
  ): Promise<CreateOrderResponseDto> {
    const savedOrder = await this.dataSource.transaction(async (manager) => {
      const now = await this.databaseNow(manager);
      const orderId = `ORD-${randomUUID()}`;
      let total = 0;
      const items: OrderItem[] = [];
      for (const [index, item] of dto.items.entries()) {
        const product = await manager
          .getRepository(Product)
          .findOneBy({ id: item.productId });
        if (!product)
          throw new BadRequestException(
            `Sản phẩm ${item.productId} không tồn tại`,
          );
        const unitPrice = calculateUnitPrice(
          product.price,
          item.size,
          item.toppingIds,
        );
        const lineTotal = unitPrice * item.qty;
        total += lineTotal;
        if (!Number.isSafeInteger(total) || total > 2_147_483_647) {
          throw new BadRequestException(
            'Tổng tiền đơn hàng vượt giới hạn lưu trữ',
          );
        }
        items.push(
          manager.getRepository(OrderItem).create({
            id: `${orderId}-${index + 1}`,
            orderId,
            productId: item.productId,
            size: item.size,
            toppingIds: item.toppingIds,
            qty: item.qty,
            unitPrice,
            lineTotal,
          }),
        );
      }
      const order = manager.getRepository(Order).create({
        id: orderId,
        userId,
        status: 'PENDING',
        total,
        items,
        createdAt: now,
        expiresAt: new Date(now.getTime() + ORDER_PAYMENT_WINDOW_MS),
      });
      await manager.save(Order, order);
      await this.ensureInventoryReservation(order, manager);
      return order;
    });
    return {
      message: 'Tạo đơn hàng thành công',
      orderId: savedOrder.id,
      total: savedOrder.total,
      status: savedOrder.status,
      createdAt: savedOrder.createdAt,
      expiresAt: savedOrder.expiresAt,
    };
  }

  findById(orderId: string): Promise<Order | null> {
    return this.orderRepository.findOne({
      where: { id: orderId },
      relations: { items: true },
    });
  }

  /** Always lock the order before any of its payments or reserved ingredients. */
  lockById(orderId: string, manager: EntityManager): Promise<Order | null> {
    return manager.getRepository(Order).findOne({
      where: { id: orderId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  /** Also covers still-valid unpaid orders created before the inventory migration. */
  async ensureInventoryReservation(
    order: Order,
    manager: EntityManager,
  ): Promise<void> {
    if (order.inventoryReservedAt) return;
    if (order.inventoryReleasedAt)
      throw new BadRequestException('Đơn hàng đã hết hạn hoặc đã bị hủy');
    const items =
      order.items ??
      (await manager.getRepository(OrderItem).findBy({ orderId: order.id }));
    if (!items.length) throw new BadRequestException('Đơn hàng không có món');
    const amounts = await this.inventoryService.reserveIngredients(
      items,
      manager,
    );
    await manager.getRepository(OrderInventoryReservation).insert(
      [...amounts].map(([ingredientId, amount]) => ({
        orderId: order.id,
        ingredientId,
        amount,
      })),
    );
    order.inventoryReservedAt = await this.databaseNow(manager);
    await manager.save(Order, order);
  }

  /** Caller must commit a timeout result before returning an HTTP error. */
  async expireIfNeeded(order: Order, manager: EntityManager): Promise<boolean> {
    if (!['PENDING', 'PAYMENT_FAILED'].includes(order.status)) return false;
    const now = await this.databaseNow(manager);
    if (order.expiresAt.getTime() > now.getTime()) return false;
    await this.cancelLocked(order, manager, 'PAYMENT_TIMEOUT', now);
    return true;
  }

  private async cancelLocked(
    order: Order,
    manager: EntityManager,
    reason: CancellationReason,
    now: Date,
  ): Promise<Order> {
    if (order.status === 'CANCELLED') return order;
    assertTransition(order.status, 'CANCELLED');
    if (!order.inventoryReleasedAt) {
      if (order.inventoryReservedAt) {
        const rows = await manager
          .getRepository(OrderInventoryReservation)
          .findBy({ orderId: order.id });
        if (!rows.length)
          throw new ConflictException(
            'Thiếu dữ liệu nguyên liệu đã giữ cho đơn hàng',
          );
        await this.inventoryService.releaseIngredients(
          new Map(rows.map((r) => [r.ingredientId, r.amount])),
          manager,
        );
      }
      order.inventoryReleasedAt = now;
    }
    order.status = 'CANCELLED';
    order.cancelReason = reason;
    order.cancelledAt = now;
    return manager.save(Order, order);
  }

  async cancelOrder(
    userId: string,
    orderId: string,
  ): Promise<CancelOrderResponseDto> {
    const order = await this.dataSource.transaction(async (manager) => {
      const locked = await this.lockById(orderId, manager);
      if (!locked || locked.userId !== userId)
        throw new NotFoundException('Không tìm thấy đơn hàng');
      if (locked.status === 'CANCELLED') return locked;
      if (await this.expireIfNeeded(locked, manager)) return locked;
      return this.cancelLocked(
        locked,
        manager,
        'USER_CANCELLED',
        await this.databaseNow(manager),
      );
    });
    return {
      orderId: order.id,
      status: order.status,
      cancelReason: order.cancelReason,
      cancelledAt: order.cancelledAt,
      expiresAt: order.expiresAt,
    };
  }

  /** With a caller's transaction, return CANCELLED on expiry so the caller can commit the refund. */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    manager?: EntityManager,
  ): Promise<Order> {
    const transition = async (transaction: EntityManager) => {
      const order = await this.lockById(orderId, transaction);
      if (!order)
        throw new BadRequestException(`Đơn hàng ${orderId} không tồn tại`);
      if (await this.expireIfNeeded(order, transaction)) return order;
      if (status === 'CANCELLED') {
        return this.cancelLocked(
          order,
          transaction,
          'USER_CANCELLED',
          await this.databaseNow(transaction),
        );
      }
      assertTransition(order.status, status);
      if (status === 'PAID' || status === 'PENDING') {
        await this.ensureInventoryReservation(order, transaction);
      }
      order.status = status;
      return transaction.save(Order, order);
    };
    if (manager) return transition(manager);
    const order = await this.dataSource.transaction(transition);
    if (order.status !== status)
      throw new BadRequestException('Đơn đã hết hạn');
    return order;
  }

  /** One transaction per order keeps row/ingredient lock ordering consistent across workers. */
  async expireUnpaidOrders(limit = 100): Promise<number> {
    const candidates = await this.orderRepository
      .createQueryBuilder('order')
      .select('order.id')
      .where('order.status IN (:...statuses)', {
        statuses: ['PENDING', 'PAYMENT_FAILED'],
      })
      .andWhere('order.expiresAt <= clock_timestamp()')
      .orderBy('order.expiresAt', 'ASC')
      .addOrderBy('order.id', 'ASC')
      .take(limit)
      .getMany();
    let expired = 0;
    for (const candidate of candidates) {
      const changed = await this.dataSource.transaction(async (manager) => {
        const order = await manager
          .getRepository(Order)
          .createQueryBuilder('order')
          .where('order.id = :id', { id: candidate.id })
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getOne();
        return order ? this.expireIfNeeded(order, manager) : false;
      });
      if (changed) expired++;
    }
    return expired;
  }
}
