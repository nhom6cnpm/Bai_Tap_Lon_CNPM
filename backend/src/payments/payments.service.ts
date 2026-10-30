import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  QueryFailedError,
  Repository,
  type FindOptionsWhere,
} from 'typeorm';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/order.entity';
import type { OrderStatus } from '../orders/order-status';
import {
  paymentDeadline,
  parsePaymentTimeoutMinutes,
} from '../orders/payment-timeout';
import { User } from '../auth/user.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import type { ListAdminPaymentsDto } from './dto/list-admin-payments.dto';
import {
  ACTIVE_PAYMENT_STATUSES,
  Payment,
  type PaymentStatus,
} from './entities/payment.entity';

const UNIQUE_VIOLATION = '23505';

export type PaymentDecision = 'CONFIRM' | 'REJECT';

/**
 * Task 8 — thanh toán do nhân viên xác nhận (yêu cầu 30/10):
 * khách chọn phương thức → chuyển tiền → bấm "Tôi đã chuyển tiền" (chỉ báo) →
 * ADMIN xác nhận (đơn PAID) hoặc từ chối (đơn PAYMENT_FAILED).
 * Every order status change goes through OrdersService.updateOrderStatus, so the
 * state machine (assertTransition) still guards every arrow.
 */
@Injectable()
export class PaymentsService {
  private readonly timeoutMinutes: number;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.timeoutMinutes = parsePaymentTimeoutMinutes(
      this.configService.get<string>('ORDER_PAYMENT_TIMEOUT_MINUTES'),
    );
  }

  private toView(payment: Payment, order?: Order | null) {
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      reportedAt: payment.reportedAt ?? null,
      reviewNote: payment.reviewNote ?? null,
      createdAt: payment.createdAt,
      orderStatus: order?.status ?? null,
      expiresAt: order
        ? paymentDeadline(order.createdAt, this.timeoutMinutes)
        : null,
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

  /** POST /payments — khách chọn phương thức (Ví = chuyển khoản QR, Thẻ = quẹt tại quầy). */
  async createPayment(
    userId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException('Thiếu header Idempotency-Key');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        // Row lock on the order: two payment requests for the same order run
        // one after the other, so an order never has two active payments
        const order = await this.lockOrder(manager, dto.orderId);
        if (order.userId !== userId) {
          throw new ForbiddenException(
            'Bạn không có quyền thanh toán đơn hàng này',
          );
        }

        const repository = manager.getRepository(Payment);
        const sameKey = await repository.findOneBy({ idempotencyKey });
        if (sameKey) {
          if (sameKey.orderId !== order.id) {
            throw new BadRequestException(
              'Idempotency-Key đã được dùng cho đơn hàng khác',
            );
          }
          return this.toView(sameKey, order);
        }

        if (order.status === 'CANCELLED') {
          throw new BadRequestException('Đơn hàng đã hết hạn hoặc đã bị hủy');
        }
        if (order.status !== 'PENDING' && order.status !== 'PAYMENT_FAILED') {
          throw new BadRequestException('Đơn hàng này đã được thanh toán');
        }

        // One active payment per order: reuse it instead of creating another
        // row the staff would have to review twice
        const active = await repository.findOne({
          where: {
            orderId: order.id,
            status: In([...ACTIVE_PAYMENT_STATUSES]),
          },
        });
        if (active) {
          if (active.status === 'PENDING' && active.method !== dto.method) {
            active.method = dto.method;
            await repository.save(active);
          }
          return this.toView(active, order);
        }

        // Retry: PAYMENT_FAILED → PENDING first (đề mục 9.1, "thử lại")
        if (order.status === 'PAYMENT_FAILED') {
          order.status = (
            await this.ordersService.updateOrderStatus(
              order.id,
              'PENDING',
              manager,
            )
          ).status;
        }

        const payment = repository.create({
          id:
            'PAY-' +
            Date.now() +
            '-' +
            Math.random().toString(36).substring(2, 7),
          orderId: order.id,
          userId,
          idempotencyKey,
          amount: order.total, // never trust an amount from the client
          method: dto.method,
          status: 'PENDING',
          reportedAt: null,
          reviewedAt: null,
          reviewedBy: null,
          reviewNote: null,
        });
        return this.toView(await repository.save(payment), order);
      });
    } catch (error) {
      // Same Idempotency-Key sent twice at the same time for different orders:
      // the UNIQUE constraint rejects the second insert
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION
      ) {
        const winner = await this.paymentRepository.findOneBy({
          idempotencyKey,
        });
        if (winner && winner.orderId === dto.orderId) {
          const order = await this.orderRepository.findOneBy({
            id: winner.orderId,
          });
          return this.toView(winner, order);
        }
        throw new BadRequestException(
          'Idempotency-Key đã được dùng cho đơn hàng khác',
        );
      }
      throw error;
    }
  }

  /**
   * POST /payments/:id/report-paid — khách bấm "Tôi đã chuyển tiền".
   * Only flags the payment for staff; the order stays PENDING.
   */
  async reportPaid(userId: string, paymentId: string) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await this.lockPayment(manager, paymentId);
      if (payment.userId !== userId) {
        throw new ForbiddenException(
          'Bạn không có quyền với phiên thanh toán này',
        );
      }
      const order = await manager
        .getRepository(Order)
        .findOneBy({ id: payment.orderId });

      // Pressing the button twice is harmless
      if (payment.status === 'CUSTOMER_REPORTED') {
        return this.toView(payment, order);
      }
      if (payment.status !== 'PENDING') {
        throw new BadRequestException(
          'Phiên thanh toán này đã được nhân viên xử lý',
        );
      }
      if (order?.status !== 'PENDING') {
        throw new BadRequestException('Đơn hàng đã hết hạn hoặc đã bị hủy');
      }

      payment.status = 'CUSTOMER_REPORTED';
      payment.reportedAt = new Date();
      return this.toView(
        await manager.getRepository(Payment).save(payment),
        order,
      );
    });
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

    const rows = payments.map((payment) => {
      const order = orderById.get(payment.orderId);
      return {
        ...this.toView(payment, order),
        customerEmail: emailById.get(payment.userId) ?? null,
        itemCount: order?.items?.reduce((sum, item) => sum + item.qty, 0) ?? 0,
        reviewedAt: payment.reviewedAt ?? null,
      };
    });

    // Customers who already reported a transfer come first
    if (filter === 'ACTIVE') {
      rows.sort(
        (a, b) =>
          Number(b.status === 'CUSTOMER_REPORTED') -
          Number(a.status === 'CUSTOMER_REPORTED'),
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

    return this.dataSource.transaction(async (manager) => {
      // Row lock: two staff pressing at the same time are handled one by one
      const payment = await this.lockPayment(manager, paymentId);
      if (!ACTIVE_PAYMENT_STATUSES.includes(payment.status)) {
        throw new BadRequestException(
          `Phiên thanh toán đã được xử lý trước đó (${payment.status})`,
        );
      }

      const order = await this.ordersService.updateOrderStatus(
        payment.orderId,
        targetOrder,
        manager,
      );

      payment.status = targetPayment;
      payment.reviewedAt = new Date();
      payment.reviewedBy = adminId;
      payment.reviewNote = note?.trim() || null;
      const saved = await manager.getRepository(Payment).save(payment);
      return this.toView(saved, order);
    });
  }
}
