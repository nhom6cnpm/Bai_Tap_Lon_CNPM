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

@Injectable()
export class OrderHistoryService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly dataSource: DataSource,
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
    userId: string,
  ): Promise<OrderHistoryResponseDto[]> {
    if (!orders.length) return [];
    const [clock, payments] = await Promise.all([
      this.dataSource.query<Array<{ now: Date }>>(
        'SELECT clock_timestamp() AS now',
      ),
      this.payments.find({
        where: { orderId: In(orders.map((order) => order.id)), userId },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    ]);
    const now = new Date(clock[0].now);
    return orders.map((order) => {
      const candidates = payments.filter(
        (payment) => payment.orderId === order.id,
      );
      const payment =
        candidates.find((entry) => entry.status === 'SUCCESS') ?? candidates[0];
      return {
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
        serverTime: now,
        canPay:
          ['PENDING', 'PAYMENT_FAILED'].includes(order.status) &&
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
}
