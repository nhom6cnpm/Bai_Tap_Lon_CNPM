import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { priceOrderItems } from '../orders/price-order-items';
import { Voucher } from './voucher.entity';
import { voucherDiscount, voucherUnavailableReason } from './voucher-pricing';

export interface VoucherTotals {
  subtotal: number;
  discount: number;
  total: number;
  voucherCode: string | null;
  voucherTitle: string | null;
}

@Injectable()
export class VouchersService {
  constructor(private readonly dataSource: DataSource) {}

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

  async quote(dto: CreateOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const { subtotal } = await priceOrderItems(manager, dto.items);
      const [clock] = await manager.query<Array<{ now: Date }>>(
        'SELECT clock_timestamp() AS now',
      );
      const now = new Date(clock.now);
      const totals = await this.apply(manager, subtotal, dto.voucherCode, now);
      const vouchers = await manager
        .getRepository(Voucher)
        .createQueryBuilder('voucher')
        .where('voucher.isActive = true AND voucher.isPublic = true')
        .andWhere('voucher.endsAt > :now', { now })
        .orderBy('voucher.code', 'ASC')
        .getMany();
      return {
        ...totals,
        serverTime: now,
        vouchers: vouchers.map((voucher) => ({
          code: voucher.code,
          title: voucher.title,
          discountType: voucher.discountType,
          discountValue: voucher.discountValue,
          minSubtotal: voucher.minSubtotal,
          maxDiscount: voucher.maxDiscount,
          startsAt: voucher.startsAt,
          endsAt: voucher.endsAt,
          unavailableReason: voucherUnavailableReason(voucher, subtotal, now),
          discount: voucherUnavailableReason(voucher, subtotal, now)
            ? 0
            : voucherDiscount(voucher, subtotal),
        })),
      };
    });
  }
}
