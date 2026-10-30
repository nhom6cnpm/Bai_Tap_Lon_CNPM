import { ConflictException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Order } from '../orders/order.entity';
import { Voucher } from './voucher.entity';
import { VoucherUsage } from './voucher-usage.entity';
import { VoucherUserQuota } from './voucher-user-quota.entity';
import type { VoucherUsageAvailability } from './voucher-usage';
import { voucherUnavailableReason } from './voucher-pricing';

@Injectable()
export class VoucherUsagesService {
  /** Lock order: order -> ingredients (if needed) -> voucher/quota -> user. */
  private async lockAccount(
    manager: EntityManager,
    userId: string,
    code: string,
  ) {
    await manager.query(
      `INSERT INTO voucher_user_quotas ("userId", "voucherCode")
      VALUES ($1, $2) ON CONFLICT ("userId", "voucherCode") DO NOTHING`,
      [userId, code],
    );
    await manager.getRepository(VoucherUserQuota).findOneOrFail({
      where: { userId, voucherCode: code },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async availability(
    manager: EntityManager,
    userId: string,
    code: string,
    limit: number,
  ): Promise<VoucherUsageAvailability> {
    const [counts] = await manager.query<
      Array<{ reserved: number; used: number }>
    >(
      `SELECT
      count(*) FILTER (WHERE status = 'RESERVED')::int AS reserved,
      count(*) FILTER (WHERE status = 'USED')::int AS used
      FROM voucher_usages WHERE "userId" = $1 AND "voucherCode" = $2 AND status IN ('RESERVED', 'USED')`,
      [userId, code],
    );
    return {
      maxUsesPerUser: limit,
      reservedUses: counts.reserved,
      usedUses: counts.used,
      availableUses: Math.max(0, limit - counts.reserved - counts.used),
    };
  }

  unavailableReason(usage: VoucherUsageAvailability): string | null {
    if (usage.usedUses >= usage.maxUsesPerUser)
      return 'Bạn đã dùng hết lượt của mã giảm giá này.';
    if (usage.availableUses === 0)
      return 'Các lượt còn lại đang giữ cho đơn chờ thanh toán.';
    return null;
  }

  async reserve(order: Order, manager: EntityManager): Promise<void> {
    if (!order.voucherCode) return;
    // Also protects the configuration while a reservation waits for its account lock.
    const voucher = await manager.getRepository(Voucher).findOneOrFail({
      where: { code: order.voucherCode },
      lock: { mode: 'pessimistic_read' },
    });
    await this.lockAccount(manager, order.userId, voucher.code);
    const repository = manager.getRepository(VoucherUsage);
    const previous = await repository.findOneBy({ orderId: order.id });
    if (previous) {
      this.assertOwner(previous, order);
      if (previous.status === 'RESERVED') return;
      throw new ConflictException(
        'Lượt voucher của đơn không còn chờ thanh toán.',
      );
    }
    const [clock] = await manager.query<Array<{ now: Date }>>(
      'SELECT clock_timestamp() AS now',
    );
    const now = new Date(clock.now);
    const pricingReason = voucherUnavailableReason(
      voucher,
      order.subtotal,
      now,
    );
    if (pricingReason) throw new ConflictException(pricingReason);
    if (now >= order.expiresAt)
      throw new ConflictException('Đơn đã hết thời gian chờ tạo thanh toán.');
    const usage = await this.availability(
      manager,
      order.userId,
      voucher.code,
      voucher.maxUsesPerUser,
    );
    const reason = this.unavailableReason(usage);
    if (reason)
      throw new ConflictException({
        code:
          usage.usedUses >= usage.maxUsesPerUser
            ? 'VOUCHER_USES_EXHAUSTED'
            : 'VOUCHER_USES_RESERVED',
        message: reason,
      });
    await repository.insert({
      orderId: order.id,
      userId: order.userId,
      voucherCode: voucher.code,
      status: 'RESERVED',
      reservedAt: now,
    });
  }

  private assertOwner(usage: VoucherUsage, order: Order): void {
    if (
      usage.userId !== order.userId ||
      usage.voucherCode !== order.voucherCode
    )
      throw new ConflictException('Dữ liệu lượt voucher không khớp đơn hàng.');
  }

  private async lockedUsage(
    order: Order,
    manager: EntityManager,
  ): Promise<VoucherUsage> {
    await this.lockAccount(manager, order.userId, order.voucherCode!);
    const usage = await manager.getRepository(VoucherUsage).findOne({
      where: { orderId: order.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!usage)
      throw new ConflictException('Thiếu dữ liệu lượt voucher đã giữ cho đơn.');
    this.assertOwner(usage, order);
    return usage;
  }

  async markUsed(
    order: Order,
    manager: EntityManager,
    now: Date,
  ): Promise<void> {
    if (!order.voucherCode) return;
    const usage = await this.lockedUsage(order, manager);
    if (usage.status === 'USED') return;
    if (usage.status !== 'RESERVED')
      throw new ConflictException('Lượt voucher đã được trả.');
    usage.status = 'USED';
    usage.usedAt = now;
    await manager.save(VoucherUsage, usage);
  }

  async release(
    order: Order,
    manager: EntityManager,
    now: Date,
  ): Promise<void> {
    if (!order.voucherCode) return;
    const usage = await this.lockedUsage(order, manager);
    if (usage.status === 'RELEASED') return;
    usage.status = 'RELEASED';
    usage.releasedAt = now;
    await manager.save(VoucherUsage, usage);
  }
}
