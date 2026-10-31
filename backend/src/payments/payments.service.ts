import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  MoreThan,
  QueryFailedError,
  Repository,
  type FindOptionsWhere,
} from 'typeorm';
import { OrdersService } from '../orders/orders.service';
import { assertNoPendingCancellation } from '../orders/order-cancellation';
import { Order } from '../orders/order.entity';
import type { OrderStatus } from '../orders/order-status';
import { User } from '../auth/user.entity';
import { randomUUID } from 'crypto';
import { PaymentRequestKey } from './entities/payment-request-key.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import type { ListAdminPaymentsDto } from './dto/list-admin-payments.dto';
import {
  ACTIVE_PAYMENT_STATUSES,
  Payment,
  type PaymentStatus,
} from './entities/payment.entity';
import { BankLedgerService } from '../mock-bank/bank-ledger.service';
import { SHOP_BANK_ACCOUNT } from '../mock-bank/mock-bank.constants';

const UNIQUE_VIOLATION = '23505';

export type PaymentDecision = 'CONFIRM' | 'REJECT';

/**
 * Task 8 — thanh toán giả lập, nhân viên xác nhận (yêu cầu 30/10):
 * khách chọn phương thức → chuyển tiền trên ngân hàng giả lập (tiền vào sao kê,
 * phiên TRANSFER_RECEIVED) → ADMIN đối chiếu rồi xác nhận (đơn PAID) hoặc từ
 * chối (đơn PAYMENT_FAILED, hoàn số tiền đã nhận).
 * Every order status change goes through OrdersService.updateOrderStatus, so the
 * state machine (assertTransition) still guards every arrow.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly ordersService: OrdersService,
    private readonly dataSource: DataSource,
    private readonly ledger: BankLedgerService,
  ) {}

  private toView(payment: Payment, order?: Order | null) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      receivedAt: payment.receivedAt ?? null,
      reviewNote: payment.reviewNote ?? null,
      cancellationPending: order?.cancelRequestStatus === 'PENDING',
      createdAt: payment.createdAt,
      orderStatus: order?.status ?? null,
      expiresAt: order?.expiresAt ?? null,
      serverTime: new Date(),
    };
  }

  private async lockOrder(manager: EntityManager, orderId: string) {
    const order = await manager.getRepository(Order).findOne({
      where: { id: orderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ${orderId}`);
    }
    return order;
  }

  private async lockPayment(manager: EntityManager, paymentId: string) {
    const payment = await manager.getRepository(Payment).findOne({
      where: { id: paymentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!payment) {
      throw new NotFoundException(
        `Không tìm thấy phiên thanh toán ${paymentId}`,
      );
    }
    return payment;
  }

  private assertRequest(
    key: PaymentRequestKey,
    userId: string,
    dto: CreatePaymentDto,
  ): void {
    if (
      key.orderId !== dto.orderId ||
      key.userId !== userId ||
      key.method !== dto.method
    )
      throw new BadRequestException(
        'Idempotency-Key đã được dùng cho yêu cầu thanh toán khác',
      );
  }

  private async lockPair(manager: EntityManager, paymentId: string) {
    const original = await manager
      .getRepository(Payment)
      .findOneBy({ id: paymentId });
    if (!original)
      throw new NotFoundException('Không tìm thấy phiên thanh toán');
    // Shared lock order with creation, expiry and cancellation: order, payment, ingredients.
    const order = await this.lockOrder(manager, original.orderId);
    const payment = await this.lockPayment(manager, paymentId);
    return { order, payment };
  }

  async createPayment(
    userId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey?.trim() || idempotencyKey.length > 128)
      throw new BadRequestException('Idempotency-Key phải có 1–128 ký tự');
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const order = await this.lockOrder(manager, dto.orderId);
        if (order.userId !== userId)
          throw new ForbiddenException(
            'Bạn không có quyền thanh toán đơn hàng này',
          );
        const keys = manager.getRepository(PaymentRequestKey);
        const previous = await keys.findOneBy({ id: idempotencyKey });
        const repository = manager.getRepository(Payment);
        if (previous) {
          this.assertRequest(previous, userId, dto);
          await this.ordersService.expireIfNeeded(order, manager);
          const payment = await repository.findOneBy({
            id: previous.paymentId,
          });
          if (!payment)
            throw new NotFoundException('Không tìm thấy phiên thanh toán');
          return this.toView(payment, order);
        }
        if (
          (await this.ordersService.expireIfNeeded(order, manager)) ||
          order.status === 'CANCELLED'
        )
          return null;
        if (!['PENDING', 'PAYMENT_FAILED'].includes(order.status))
          throw new BadRequestException(
            'Đơn hàng này không còn chờ thanh toán',
          );
        assertNoPendingCancellation(order);
        let payment = await repository.findOne({
          where: {
            orderId: order.id,
            status: In([...ACTIVE_PAYMENT_STATUSES]),
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (payment) {
          if (payment.status === 'PENDING' && payment.method !== dto.method) {
            payment.method = dto.method;
            await repository.save(payment);
          }
        } else {
          if (order.status === 'PAYMENT_FAILED') {
            const retried = await this.ordersService.updateOrderStatus(
              order.id,
              'PENDING',
              manager,
            );
            if (retried.status === 'CANCELLED') return null;
            Object.assign(order, retried);
          } else
            await this.ordersService.ensureInventoryReservation(order, manager);
          if (await this.ordersService.expireIfNeeded(order, manager))
            return null;
          payment = await repository.save(
            repository.create({
              id: `PAY-${randomUUID()}`,
              orderId: order.id,
              userId,
              idempotencyKey,
              amount: order.total,
              method: dto.method,
              status: 'PENDING',
              receivedAt: null,
              reviewedAt: null,
              reviewedBy: null,
              reviewNote: null,
            }),
          );
        }
        await keys.save(
          keys.create({
            id: idempotencyKey,
            paymentId: payment.id,
            orderId: order.id,
            userId,
            method: dto.method,
          }),
        );
        return this.toView(payment, order);
      });
      // Commit timeout cancellation/refund before returning an error.
      if (!result) throw new BadRequestException('Đơn đã hết hạn hoặc bị hủy');
      return result;
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION
      ) {
        const winner = await this.dataSource
          .getRepository(PaymentRequestKey)
          .findOneBy({ id: idempotencyKey });
        if (winner) {
          this.assertRequest(winner, userId, dto);
          const payment = await this.paymentRepository.findOneBy({
            id: winner.paymentId,
          });
          const order = await this.orderRepository.findOneBy({
            id: winner.orderId,
          });
          if (payment && order) return this.toView(payment, order);
        }
      }
      throw error;
    }
  }

  /**
   * Ngân hàng giả lập: khách bấm "Chuyển tiền". Records the money on the shop's
   * statement and marks the payment TRANSFER_RECEIVED so staff are notified.
   * The order stays PENDING: only staff can make it PAID. Public on purpose
   * (opened by scanning the QR on a phone that is not logged in); the payment
   * id is a random UUID and a transfer can only add money, never confirm.
   */
  async receiveTransfer(paymentId: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const { payment, order } = await this.lockPair(manager, paymentId);
      if (payment.method !== 'WALLET')
        throw new BadRequestException(
          'Thanh toán thẻ được thực hiện tại quầy, không chuyển khoản',
        );
      // Pressing "Chuyển tiền" twice never takes the money twice
      if (payment.status === 'TRANSFER_RECEIVED')
        return this.toView(payment, order);
      if (
        (await this.ordersService.expireIfNeeded(order, manager)) ||
        order.status === 'CANCELLED'
      )
        return null;
      if (order.status !== 'PENDING' || payment.status !== 'PENDING')
        throw new BadRequestException(
          'Phiên thanh toán không còn chờ chuyển tiền',
        );
      assertNoPendingCancellation(order);
      const now = await this.ordersService.databaseNow(manager);
      // Amount comes from the payment (= order total), never from the client
      await this.ledger.recordIncoming(payment, manager, payment.orderId, now);
      payment.status = 'TRANSFER_RECEIVED';
      payment.receivedAt = now;
      return this.toView(
        await manager.getRepository(Payment).save(payment),
        order,
      );
    });
    if (!result) throw new BadRequestException('Đơn đã hết hạn hoặc bị hủy');
    return result;
  }

  /** GET /mock-bank/payments/:id — what the mock bank screen shows before transferring. */
  async getTransferInfo(paymentId: string) {
    const payment = await this.paymentRepository.findOneBy({ id: paymentId });
    if (!payment)
      throw new NotFoundException('Không tìm thấy phiên thanh toán');
    const order = await this.orderRepository.findOneBy({
      id: payment.orderId,
    });
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      orderStatus: order?.status ?? null,
      expiresAt: order?.expiresAt ?? null,
      receivedAt: payment.receivedAt ?? null,
      transferContent: payment.orderId,
      account: SHOP_BANK_ACCOUNT,
      serverTime: new Date(),
    };
  }

  /** GET /payments/:id — màn hình khách tự hỏi lại trạng thái (polling). */
  async getPaymentById(paymentId: string, userId: string) {
    const payment = await this.paymentRepository.findOneBy({ id: paymentId });
    if (!payment) {
      throw new NotFoundException(
        `Không tìm thấy phiên thanh toán ${paymentId}`,
      );
    }
    if (payment.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền xem phiên thanh toán này',
      );
    }
    const order = await this.orderRepository.findOneBy({
      id: payment.orderId,
    });
    return this.toView(payment, order);
  }

  /** GET /admin/payments — danh sách cho nhân viên (trang admin polling vài giây/lần). */
  async listForAdmin(query: ListAdminPaymentsDto) {
    const filter = query.status ?? 'ACTIVE';
    const where: FindOptionsWhere<Payment> = {};
    if (filter === 'ACTIVE') {
      where.status = In([...ACTIVE_PAYMENT_STATUSES]);
    } else if (filter !== 'ALL') {
      where.status = filter;
    }
    if (query.orderId?.trim()) where.orderId = query.orderId.trim();
    // Filter before LIMIT: old unpaid sessions must not hide newer live orders.
    if (filter === 'ACTIVE') {
      const orderFilter = query.orderId?.trim()
        ? { id: query.orderId.trim() }
        : {};
      const [activeOrders, received] = await Promise.all([
        this.orderRepository.find({
          where: {
            status: 'PENDING',
            expiresAt: MoreThan(new Date()),
            ...orderFilter,
          },
          select: { id: true },
        }),
        // Money already arrived: never auto-expired, staff must still decide
        this.paymentRepository.find({
          where: {
            status: 'TRANSFER_RECEIVED',
            ...(query.orderId?.trim() ? { orderId: query.orderId.trim() } : {}),
          },
          select: { orderId: true },
        }),
      ]);
      const ids = new Set([
        ...activeOrders.map((order) => order.id),
        ...received.map((payment) => payment.orderId),
      ]);
      if (!ids.size) return [];
      where.orderId = In([...ids]);
    }

    const payments = await this.paymentRepository.find({
      where,
      order: { createdAt: filter === 'ACTIVE' ? 'ASC' : 'DESC' },
      take: 100,
    });

    const orderIds = [...new Set(payments.map((p) => p.orderId))];
    const userIds = [...new Set(payments.map((p) => p.userId))];
    const [orders, users] = await Promise.all([
      orderIds.length
        ? this.orderRepository.find({
            where: { id: In(orderIds) },
            relations: { items: true },
          })
        : Promise.resolve([] as Order[]),
      userIds.length
        ? this.userRepository.find({
            where: { id: In(userIds) },
            select: { id: true, email: true },
          })
        : Promise.resolve([] as User[]),
    ]);
    const orderById = new Map(orders.map((o) => [o.id, o]));
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    const rows = payments
      .filter((payment) => {
        if (filter !== 'ACTIVE') return true;
        const order = orderById.get(payment.orderId);
        return (
          order?.status === 'PENDING' &&
          (payment.status === 'TRANSFER_RECEIVED' ||
            order.expiresAt.getTime() > Date.now())
        );
      })
      .map((payment) => {
        const order = orderById.get(payment.orderId);
        return {
          ...this.toView(payment, order),
          customerEmail: emailById.get(payment.userId) ?? null,
          itemCount:
            order?.items?.reduce((sum, item) => sum + item.qty, 0) ?? 0,
          reviewedAt: payment.reviewedAt ?? null,
        };
      });

    // Payments whose money already arrived come first
    if (filter === 'ACTIVE') {
      rows.sort(
        (a, b) =>
          Number(b.status === 'TRANSFER_RECEIVED') -
          Number(a.status === 'TRANSFER_RECEIVED'),
      );
    }
    return rows;
  }

  /**
   * POST /admin/payments/:id/confirm | /reject — nhân viên quyết định.
   * Payment and order change together in one transaction; assertTransition
   * rejects e.g. confirming an order that was already CANCELLED.
   */
  async review(
    adminId: string,
    paymentId: string,
    decision: PaymentDecision,
    note?: string,
  ) {
    const targetPayment: PaymentStatus =
      decision === 'CONFIRM' ? 'SUCCESS' : 'FAILED';
    const targetOrder: OrderStatus =
      decision === 'CONFIRM' ? 'PAID' : 'PAYMENT_FAILED';

    const result = await this.dataSource.transaction(async (manager) => {
      const { payment, order } = await this.lockPair(manager, paymentId);
      if (
        (await this.ordersService.expireIfNeeded(order, manager)) ||
        order.status === 'CANCELLED'
      )
        return null;
      assertNoPendingCancellation(order);
      if (!ACTIVE_PAYMENT_STATUSES.includes(payment.status))
        return this.toView(payment, order);
      if (order.status !== 'PENDING')
        throw new BadRequestException('Đơn không còn chờ xác nhận thanh toán');
      const updated = await this.ordersService.updateOrderStatus(
        payment.orderId,
        targetOrder,
        manager,
      );
      if (updated.status === 'CANCELLED') return null;
      const now = await this.ordersService.databaseNow(manager);
      if (decision === 'CONFIRM') {
        // Card at the counter (or money staff saw outside the mock bank): put it
        // on the statement so a later cancellation refunds the right amount
        if (!(await this.ledger.hasReceived(payment.id, manager)))
          await this.ledger.recordIncoming(
            payment,
            manager,
            payment.method === 'CARD'
              ? `Quẹt thẻ tại quầy ${payment.orderId}`
              : `Nhân viên xác nhận đã nhận ${payment.orderId}`,
            now,
          );
      } else {
        // Rejected after the money arrived: give it back, customer pays again
        await this.ledger.refundOrder(
          payment.orderId,
          manager,
          'nhân viên từ chối thanh toán',
          now,
          payment.id,
        );
      }
      payment.status = targetPayment;
      payment.reviewedAt = now;
      payment.reviewedBy = adminId;
      payment.reviewNote = note?.trim() || null;
      return this.toView(
        await manager.getRepository(Payment).save(payment),
        updated,
      );
    });
    if (!result) throw new BadRequestException('Đơn đã hết hạn hoặc bị hủy');
    return result;
  }
}
