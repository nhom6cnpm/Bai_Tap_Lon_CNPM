import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  DataSource,
  EntityManager,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { InventoryService } from '../inventory/inventory.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { CreateOrderDto } from './dto/create-order.dto';
import type {
  CreateOrderResponseDto,
  CancelOrderResponseDto,
} from './dto/order-mutation-response.dto';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderInventoryReservation } from './order-inventory-reservation.entity';
import type { CancellationReason } from './order-expiry';
import { parsePaymentTimeoutMinutes } from './payment-timeout';
import { priceOrderItems } from './price-order-items';
import { assertTransition, type OrderStatus } from './order-status';
import {
  assertNoPendingCancellation,
  cancellationAction,
} from './order-cancellation';
import { Payment } from '../payments/entities/payment.entity';
import { OrderBenefitsService } from './order-benefits.service';
import { BENEFITS_POLICY_VERSIONS } from './benefits-policy';
import { BankLedgerService } from '../mock-bank/bank-ledger.service';
import { OrderRequestKey } from './order-request-key.entity';
import { orderRequestHash } from './order-request-hash';

const UNIQUE_VIOLATION = '23505';
import {
  PREPARATION_TARGETS,
  type PreparationTarget,
} from './dto/preparation.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly inventoryService: InventoryService,
    private readonly vouchersService: VouchersService,
    private readonly configService: ConfigService,
    private readonly benefits: OrderBenefitsService,
    private readonly ledger: BankLedgerService,
  ) {}

  async databaseNow(manager: EntityManager): Promise<Date> {
    const rows = await manager.query<Array<{ now: Date }>>(
      'SELECT clock_timestamp() AS now',
    );
    return new Date(rows[0].now);
  }

  private toCreateResponse(order: Order): CreateOrderResponseDto {
    return {
      message: 'Tạo đơn hàng thành công',
      orderId: order.id,
      total: order.total,
      subtotal: order.subtotal,
      discount: order.discount,
      voucherCode: order.voucherCode,
      voucherTitle: order.voucherTitle,
      status: order.status,
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
    };
  }

  /** Same key again: the first order, never a second one; another cart: refused. */
  private async replay(
    previous: OrderRequestKey,
    requestHash: string,
    manager: EntityManager,
  ): Promise<Order> {
    if (previous.requestHash !== requestHash)
      throw new ConflictException(
        'Idempotency-Key đã được dùng cho một giỏ hàng khác',
      );
    const order = await manager
      .getRepository(Order)
      .findOneBy({ id: previous.orderId });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }

  /**
   * POST /orders. With an Idempotency-Key (required by the HTTP API), sending
   * the same request twice creates one order: the key is claimed first inside
   * the transaction, so a concurrent duplicate waits on the primary key and
   * then returns the order of the request that won.
   */
  async createOrder(
    userId: string,
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ): Promise<CreateOrderResponseDto> {
    if (
      idempotencyKey !== undefined &&
      (!idempotencyKey.trim() || idempotencyKey.length > 128)
    )
      throw new BadRequestException('Idempotency-Key phải có 1–128 ký tự');
    const requestHash = orderRequestHash(dto);
    try {
      const savedOrder = await this.dataSource.transaction(async (manager) => {
        await this.benefits.requireUser(manager, userId);
        const keys = manager.getRepository(OrderRequestKey);
        if (idempotencyKey) {
          const previous = await keys.findOneBy({ userId, idempotencyKey });
          if (previous) return this.replay(previous, requestHash, manager);
        }
        const now = await this.databaseNow(manager);
        const orderId = `ORD-${randomUUID()}`;
        // Claim the key before any stock is reserved
        if (idempotencyKey)
          await keys.insert({ userId, idempotencyKey, orderId, requestHash });
        const { subtotal, lines } = await priceOrderItems(manager, dto.items);
        const items = lines.map((line, index) =>
          manager.getRepository(OrderItem).create({
            ...line,
            id: `${orderId}-${index + 1}`,
            orderId,
          }),
        );
        const order = manager.getRepository(Order).create({
          id: orderId,
          userId,
          status: 'PENDING',
          benefitsPolicyVersion:
            BENEFITS_POLICY_VERSIONS.VOUCHER_QUOTAS_AND_POINTS,
          subtotal,
          discount: 0,
          total: subtotal,
          items,
          createdAt: now,
          expiresAt: new Date(
            now.getTime() +
              parsePaymentTimeoutMinutes(
                this.configService.get<string>('ORDER_PAYMENT_TIMEOUT_MINUTES'),
              ) *
                60_000,
          ),
        });
        await manager.save(Order, order);
        await this.ensureInventoryReservation(order, manager);
        // Validate after inventory waits; an expired voucher rolls back the whole order.
        Object.assign(
          order,
          await this.vouchersService.apply(
            manager,
            subtotal,
            dto.voucherCode,
            await this.databaseNow(manager),
            true,
          ),
        );
        await this.benefits.reserve(order, manager);
        await manager.save(Order, order);
        return order;
      });
      return this.toCreateResponse(savedOrder);
    } catch (error) {
      // A concurrent request with the same key committed first
      if (
        idempotencyKey &&
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION
      ) {
        const winner = await this.dataSource
          .getRepository(OrderRequestKey)
          .findOneBy({ userId, idempotencyKey });
        if (winner)
          return this.toCreateResponse(
            await this.replay(winner, requestHash, this.dataSource.manager),
          );
      }
      throw error;
    }
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

  /** The mock bank already received money for this order; staff must decide. */
  hasReceivedTransfer(orderId: string, manager: EntityManager) {
    return manager
      .getRepository(Payment)
      .existsBy({ orderId, status: 'TRANSFER_RECEIVED' });
  }

  /**
   * Caller must commit a timeout result before returning an HTTP error.
   * An order whose money already arrived is never auto-cancelled: the customer
   * paid in time, so staff confirm it (or reject it and the money is refunded).
   */
  async expireIfNeeded(order: Order, manager: EntityManager): Promise<boolean> {
    if (!['PENDING', 'PAYMENT_FAILED'].includes(order.status)) return false;
    const now = await this.databaseNow(manager);
    if (order.expiresAt.getTime() > now.getTime()) return false;
    if (await this.hasReceivedTransfer(order.id, manager)) return false;
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
    // Ngân hàng giả lập: give back whatever the shop holds for this order
    // (PAID orders, or money received before staff decided). Order lock held.
    await this.ledger.refundOrder(
      order.id,
      manager,
      reason === 'PAYMENT_TIMEOUT' ? 'đơn hết hạn' : 'hủy đơn',
      now,
    );
    await manager.getRepository(Payment).update(
      { orderId: order.id, status: In(['PENDING', 'TRANSFER_RECEIVED']) },
      {
        status: 'FAILED',
        reviewedAt: now,
        reviewedBy: null,
        reviewNote:
          reason === 'PAYMENT_TIMEOUT'
            ? 'Đơn đã hết hạn thanh toán.'
            : 'Đơn đã được hủy.',
      },
    );
    if (order.cancelRequestStatus === 'PENDING') {
      order.cancelRequestStatus = 'EXPIRED';
      order.cancelReviewedAt = now;
      order.cancelReviewedBy = null;
      order.cancelReviewNote = 'Đơn đã hết hạn thanh toán.';
    }
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
    await this.benefits.reverse(order, manager, now);
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
      assertTransition(locked.status, 'CANCELLED');
      const reported = await this.hasReceivedTransfer(locked.id, manager);
      const action = cancellationAction(
        locked.status,
        reported,
        locked.cancelRequestStatus,
      );
      if (action !== 'IMMEDIATE')
        throw new ConflictException({
          code:
            locked.cancelRequestStatus === 'PENDING'
              ? 'CANCELLATION_REQUEST_PENDING'
              : 'CANCELLATION_REQUIRES_REVIEW',
          message: 'Đơn này cần nhân viên xử lý hủy.',
        });
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
      assertNoPendingCancellation(order);
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
      if (status === 'PAID')
        await this.benefits.award(
          order,
          transaction,
          await this.databaseNow(transaction),
        );
      return transaction.save(Order, order);
    };
    if (manager) return transition(manager);
    const order = await this.dataSource.transaction(transition);
    if (order.status !== status)
      throw new BadRequestException('Đơn đã hết hạn');
    return order;
  }

  async advancePreparation(
    orderId: string,
    target: PreparationTarget,
  ): Promise<void> {
    if (!PREPARATION_TARGETS.includes(target))
      throw new BadRequestException('Trạng thái pha chế không hợp lệ.');
    const updated = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockById(orderId, manager);
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      // Commit timeout cleanup before reporting a stale staff action.
      if (await this.expireIfNeeded(order, manager)) return order;
      assertNoPendingCancellation(order);
      if (order.status === target) return order;
      return this.updateOrderStatus(orderId, target, manager);
    });
    if (updated.status !== target)
      throw new ConflictException(
        'Đơn đã hết hạn hoặc bị hủy. Vui lòng tải lại bảng.',
      );
  }

  async requestCancellation(
    userId: string,
    orderId: string,
    reason: string,
  ): Promise<void> {
    const expired = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockById(orderId, manager);
      if (!order || order.userId !== userId)
        throw new NotFoundException('Không tìm thấy đơn hàng');
      if (await this.expireIfNeeded(order, manager)) return true;
      if (order.cancelRequestStatus === 'PENDING') return false;
      const reported = await this.hasReceivedTransfer(orderId, manager);
      if (
        cancellationAction(
          order.status,
          reported,
          order.cancelRequestStatus,
        ) !== 'REQUEST'
      )
        throw new ConflictException(
          'Đơn không đủ điều kiện gửi yêu cầu hủy. Vui lòng cập nhật trạng thái.',
        );
      Object.assign(order, {
        cancelRequestId: randomUUID(),
        cancelRequestedAt: await this.databaseNow(manager),
        cancelRequestReason: reason.trim(),
        cancelRequestStatus: 'PENDING',
        cancelReviewedAt: null,
        cancelReviewedBy: null,
        cancelReviewNote: null,
      });
      await manager.save(Order, order);
      return false;
    });
    if (expired) throw new ConflictException('Đơn đã hết hạn và được hủy.');
  }

  async reviewCancellation(
    adminId: string,
    orderId: string,
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    note?: string,
  ): Promise<void> {
    const expired = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockById(orderId, manager);
      if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
      if (await this.expireIfNeeded(order, manager)) return true;
      if (!order.cancelRequestId || order.cancelRequestId !== requestId)
        throw new ConflictException(
          'Yêu cầu hủy đã thay đổi. Vui lòng tải lại danh sách.',
        );
      if (order.cancelRequestStatus === decision) return false;
      if (order.cancelRequestStatus !== 'PENDING')
        throw new ConflictException('Yêu cầu hủy đã được xử lý.');
      if (!['PENDING', 'PAYMENT_FAILED', 'PAID'].includes(order.status))
        throw new ConflictException('Đơn không còn được phép hủy.');
      if (decision === 'REJECTED' && !note?.trim())
        throw new BadRequestException('Cần nhập lý do từ chối.');
      order.cancelRequestStatus = decision;
      order.cancelReviewedAt = await this.databaseNow(manager);
      order.cancelReviewedBy = adminId;
      order.cancelReviewNote = note?.trim() || null;
      await manager.save(Order, order);
      if (decision === 'APPROVED')
        await this.cancelLocked(
          order,
          manager,
          'USER_CANCELLED',
          await this.databaseNow(manager),
        );
      return false;
    });
    if (expired) throw new ConflictException('Đơn đã hết hạn và được hủy.');
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
      // Paid in time through the mock bank: wait for staff, never auto-cancel
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM payments p WHERE p."orderId" = "order"."id" AND p.status = 'TRANSFER_RECEIVED')`,
      )
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
