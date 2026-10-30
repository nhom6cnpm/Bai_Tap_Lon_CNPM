import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { EntityManager, MoreThanOrEqual } from 'typeorm';
import { User } from '../auth/user.entity';
import { VoucherUsagesService } from '../vouchers/voucher-usages.service';
import {
  BENEFITS_POLICY_VERSIONS,
  LOYALTY_VND_PER_POINT,
} from './benefits-policy';
import { Order } from './order.entity';

@Injectable()
export class OrderBenefitsService {
  constructor(private readonly usages: VoucherUsagesService) {}

  async requireUser(manager: EntityManager, userId: string): Promise<void> {
    if (
      !isUUID(userId) ||
      !(await manager.getRepository(User).existsBy({ id: userId }))
    )
      throw new UnauthorizedException(
        'Tài khoản không còn hợp lệ, vui lòng đăng nhập lại.',
      );
  }

  private applies(order: Order): boolean {
    return (
      order.benefitsPolicyVersion ===
      BENEFITS_POLICY_VERSIONS.VOUCHER_QUOTAS_AND_POINTS
    );
  }

  async reserve(order: Order, manager: EntityManager): Promise<void> {
    if (this.applies(order)) await this.usages.reserve(order, manager);
  }

  /** Caller holds the order lock and supplies the payment transaction. */
  async award(order: Order, manager: EntityManager, now: Date): Promise<void> {
    if (!this.applies(order) || order.pointsAwardedAt) return;
    if (order.status !== 'PAID')
      throw new ConflictException('Chỉ cộng điểm khi đơn đã thanh toán.');
    await this.usages.markUsed(order, manager, now);
    const points = Math.floor(order.total / LOYALTY_VND_PER_POINT);
    const result = await manager
      .getRepository(User)
      .increment({ id: order.userId }, 'loyaltyPoints', points);
    if (result.affected !== 1)
      throw new ConflictException('Không tìm thấy tài khoản để cộng điểm.');
    order.pointsEarned = points;
    order.pointsAwardedAt = now;
    // Persist the marker even for zero-point orders, inside the same transaction.
    await manager.save(Order, order);
  }

  async reverse(
    order: Order,
    manager: EntityManager,
    now: Date,
  ): Promise<void> {
    if (!this.applies(order)) return;
    await this.usages.release(order, manager, now);
    if (order.pointsAwardedAt && !order.pointsReversedAt) {
      const points = order.pointsEarned;
      const result = await manager
        .getRepository(User)
        .decrement(
          { id: order.userId, loyaltyPoints: MoreThanOrEqual(points) },
          'loyaltyPoints',
          points,
        );
      if (result.affected !== 1)
        throw new ConflictException(
          'Số dư điểm không đủ để thu hồi, cần kiểm tra dữ liệu.',
        );
      order.pointsReversed += points;
      order.pointsEarned = 0;
      order.pointsReversedAt = now;
    }
    await manager.save(Order, order);
  }
}
