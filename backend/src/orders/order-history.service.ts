import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { DataSource, In, Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Order } from './order.entity';
import type { OrderHistoryResponseDto } from './dto/order-history-response.dto';
import { cancellationCapabilities } from './order-cancellation';
import { BankLedgerService } from '../mock-bank/bank-ledger.service';

@Injectable()
export class OrderHistoryService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly ledger: BankLedgerService,
  ) {}

  private async requireUser(userId: string): Promise<void> {
    if (!isUUID(userId) || !(await this.users.existsBy({ id: userId }))) {
      throw new UnauthorizedException('Vui lòng đăng nhập lại để xem đơn hàng');
    }
  }

  async findMine(userId: string): Promise<OrderHistoryResponseDto[]> {
    await this.requireUser(userId);
    const orders = await this.orders.find({
      where: { userId },
      relations: { items: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return this.toResponses(orders, userId);
  }

  async findOwnById(
    userId: string,
    id: string,
  ): Promise<OrderHistoryResponseDto> {
    await this.requireUser(userId);
    const order = await this.orders.findOne({
      where: { id, userId },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return (await this.toResponses([order], userId))[0];
  }

  private async toResponses(
    orders: Order[],
    userId?: string,
  ): Promise<OrderHistoryResponseDto[]> {
    if (!orders.length) return [];
    const [clock, payments, refunds] = await Promise.all([
      this.dataSource.query<Array<{ now: Date }>>(
        'SELECT clock_timestamp() AS now',
      ),
      this.payments.find({
        where: {
          orderId: In(orders.map((order) => order.id)),
          ...(userId ? { userId } : {}),
        },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
      this.ledger.refundedByOrder(orders.map((order) => order.id)),
    ]);
    const now = new Date(clock[0].now);
    return orders.map((order) => {
      const candidates = payments.filter(
        (payment) => payment.orderId === order.id,
      );
      const payment =
        candidates.find((entry) => entry.status === 'SUCCESS') ?? candidates[0];
      const transferReceived = candidates.some(
        (entry) => entry.status === 'TRANSFER_RECEIVED',
      );
      return {
        ...cancellationCapabilities(order, transferReceived, now),
        // Money arrived but staff have not decided: never auto-expired
        transferReceived,
        id: order.id,
        status: order.status,
        total: order.total,
        subtotal: order.subtotal,
        discount: order.discount,
        voucherCode: order.voucherCode,
        voucherTitle: order.voucherTitle,
        benefitsPolicyVersion: order.benefitsPolicyVersion,
        pointsEarned: order.pointsEarned,
        pointsReversed: order.pointsReversed,
        pointsAwardedAt: order.pointsAwardedAt,
        pointsReversedAt: order.pointsReversedAt,
        createdAt: order.createdAt,
        expiresAt: order.expiresAt,
        cancelledAt: order.cancelledAt,
        cancelReason: order.cancelReason,
        paymentMethod: payment?.method ?? null,
        // Ngân hàng giả lập: money given back to the customer for this order
        refundedAmount: refunds.get(order.id) ?? 0,
        serverTime: now,
        canPay:
          ['PENDING', 'PAYMENT_FAILED'].includes(order.status) &&
          order.cancelRequestStatus !== 'PENDING' &&
          order.expiresAt > now,
        items: [...order.items]
          .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
          .map((item) => ({
            id: item.id,
            productId: item.productId,
            name:
              item.productName ??
              `Món ${item.productId} (thông tin cũ không còn)`,
            imageUrl: item.productImageUrl,
            size: item.size,
            toppingIds: item.toppingIds,
            qty: item.qty,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
      };
    });
  }

  async findCancellationRequests(
    status: 'PENDING',
  ): Promise<OrderHistoryResponseDto[]> {
    const orders = await this.orders.find({
      where: { cancelRequestStatus: status },
      relations: { items: true },
      order: { cancelRequestedAt: 'ASC', id: 'ASC' },
    });
    return this.toResponses(orders);
  }

  async findForAdminById(id: string): Promise<OrderHistoryResponseDto> {
    const order = await this.orders.findOne({
      where: { id },
      relations: { items: true },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return (await this.toResponses([order]))[0];
  }

  async findPreparationOrders(
    status = 'PAID,PREPARING,READY',
  ): Promise<OrderHistoryResponseDto[]> {
    const orders = await this.orders.find({
      where: { status: In(status.split(',')) },
      relations: { items: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return this.toResponses(orders);
  }
}
