import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { DataSource, EntityManager } from 'typeorm';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { priceOrderItems } from '../orders/price-order-items';
import { Voucher } from './voucher.entity';
import { voucherDiscount, voucherUnavailableReason } from './voucher-pricing';
import { VoucherUsagesService } from './voucher-usages.service';
import { User } from '../auth/user.entity';
import type { VoucherUsageAvailability } from './voucher-usage';

export interface VoucherTotals {
  subtotal: number;
  discount: number;
  total: number;
  voucherCode: string | null;
  voucherTitle: string | null;
}

@Injectable()
export class VouchersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly usages: VoucherUsagesService,
  ) {}

  async apply(
    manager: EntityManager,
    subtotal: number,
    code: string | undefined,
    now: Date,
    lock = false,
  ): Promise<VoucherTotals> {
    if (!code)
      return {
        subtotal,
        discount: 0,
        total: subtotal,
        voucherCode: null,
        voucherTitle: null,
      };
    const voucher = await manager.getRepository(Voucher).findOne({
      where: { code: code.trim().toUpperCase() },
      ...(lock ? { lock: { mode: 'pessimistic_read' as const } } : {}),
    });
    if (!voucher) throw new BadRequestException('Mã giảm giá không tồn tại.');
    // A row lock may have waited beyond the voucher deadline.
    const checkedAt = lock
      ? new Date(
          (
            await manager.query<Array<{ now: Date }>>(
              'SELECT clock_timestamp() AS now',
            )
          )[0].now,
        )
      : now;
    const reason = voucherUnavailableReason(voucher, subtotal, checkedAt);
    if (reason) throw new BadRequestException(reason);
    const discount = voucherDiscount(voucher, subtotal);
    return {
      subtotal,
      discount,
      total: subtotal - discount,
      voucherCode: voucher.code,
      voucherTitle: voucher.title,
    };
  }

  async quote(dto: CreateOrderDto, userId?: string) {
    return this.dataSource.transaction(async (manager) => {
      if (
        userId &&
        (!isUUID(userId) ||
          !(await manager.getRepository(User).existsBy({ id: userId })))
      )
        throw new UnauthorizedException(
          'Tài khoản không còn hợp lệ, vui lòng đăng nhập lại.',
        );
      const { subtotal } = await priceOrderItems(manager, dto.items);
      const [clock] = await manager.query<Array<{ now: Date }>>(
        'SELECT clock_timestamp() AS now',
      );
      const now = new Date(clock.now);
      const totals = await this.apply(manager, subtotal, dto.voucherCode, now);
      let voucherUsage: VoucherUsageAvailability | null = null;
      if (userId && totals.voucherCode) {
        const selected = await manager
          .getRepository(Voucher)
          .findOneByOrFail({ code: totals.voucherCode });
        const usage = await this.usages.availability(
          manager,
          userId,
          selected.code,
          selected.maxUsesPerUser,
        );
        const reason = this.usages.unavailableReason(usage);
        if (reason) throw new ConflictException(reason);
        voucherUsage = usage;
      }
      const vouchers = await manager
        .getRepository(Voucher)
        .createQueryBuilder('voucher')
        .where('voucher.isActive = true AND voucher.isPublic = true')
        .andWhere('voucher.endsAt > :now', { now })
        .orderBy('voucher.code', 'ASC')
        .getMany();
      const views = await Promise.all(
        vouchers.map(async (voucher) => {
          const usage = userId
            ? await this.usages.availability(
                manager,
                userId,
                voucher.code,
                voucher.maxUsesPerUser,
              )
            : null;
          if (usage && usage.usedUses >= usage.maxUsesPerUser) return null;
          const reason =
            voucherUnavailableReason(voucher, subtotal, now) ??
            (usage ? this.usages.unavailableReason(usage) : null);
          return {
            code: voucher.code,
            title: voucher.title,
            discountType: voucher.discountType,
            discountValue: voucher.discountValue,
            minSubtotal: voucher.minSubtotal,
            maxDiscount: voucher.maxDiscount,
            startsAt: voucher.startsAt,
            endsAt: voucher.endsAt,
            maxUsesPerUser: voucher.maxUsesPerUser,
            usage,
            unavailableReason: reason,
            discount: reason ? 0 : voucherDiscount(voucher, subtotal),
          };
        }),
      );
      return {
        ...totals,
        serverTime: now,
        voucherUsage,
        vouchers: views.filter((view) => view !== null),
      };
    });
  }
}
