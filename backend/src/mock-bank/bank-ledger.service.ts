import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager, Repository } from 'typeorm';
import { BankTransaction } from './bank-transaction.entity';

export interface LedgerPayment {
  id: string;
  orderId: string;
  amount: number;
}

/**
 * Ngân hàng giả lập: chỉ là sao kê tài khoản của quán (không có tài khoản/số dư
 * của khách). Callers hold the order row lock, so a balance read and the row
 * written after it cannot race with another refund for the same order.
 */
@Injectable()
export class BankLedgerService {
  constructor(
    @InjectRepository(BankTransaction)
    private readonly repository: Repository<BankTransaction>,
  ) {}

  /** Money the shop currently holds for an order: received minus refunded. */
  async balanceForOrder(
    orderId: string,
    manager: EntityManager,
  ): Promise<number> {
    const rows = await manager.query<Array<{ balance: number | string }>>(
      `SELECT COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0) AS balance
         FROM bank_transactions WHERE "orderId" = $1`,
      [orderId],
    );
    return Number(rows[0]?.balance ?? 0);
  }

  async hasReceived(paymentId: string, manager: EntityManager) {
    return manager
      .getRepository(BankTransaction)
      .existsBy({ paymentId, type: 'IN' });
  }

  /** Tiền vào: amount always comes from the payment (= order total), never from the client. */
  async recordIncoming(
    payment: LedgerPayment,
    manager: EntityManager,
    content: string,
    now: Date,
  ): Promise<BankTransaction> {
    return manager.getRepository(BankTransaction).save(
      manager.getRepository(BankTransaction).create({
        id: `TXN-${randomUUID()}`,
        type: 'IN',
        amount: payment.amount,
        orderId: payment.orderId,
        paymentId: payment.id,
        content,
        createdAt: now,
      }),
    );
  }

  /**
   * Hoàn toàn bộ số tiền quán đang giữ cho đơn. Returns the refunded amount
   * (0 when nothing was received or it was already refunded), so calling it
   * twice never refunds twice.
   */
  async refundOrder(
    orderId: string,
    manager: EntityManager,
    reason: string,
    now: Date,
    paymentId: string | null = null,
  ): Promise<number> {
    const balance = await this.balanceForOrder(orderId, manager);
    if (balance <= 0) return 0;
    await manager.getRepository(BankTransaction).save(
      manager.getRepository(BankTransaction).create({
        id: `TXN-${randomUUID()}`,
        type: 'REFUND',
        amount: balance,
        orderId,
        paymentId,
        content: `Hoàn tiền ${orderId} - ${reason}`.slice(0, 255),
        createdAt: now,
      }),
    );
    return balance;
  }

  /** Sao kê cho nhân viên, mới nhất trước. */
  list(orderId?: string, limit = 200): Promise<BankTransaction[]> {
    return this.repository.find({
      where: orderId ? { orderId } : {},
      order: { createdAt: 'DESC', id: 'DESC' },
      take: limit,
    });
  }

  /** Total refunded per order, for showing "Đã hoàn tiền" to customers. */
  async refundedByOrder(orderIds: string[]): Promise<Map<string, number>> {
    if (!orderIds.length) return new Map();
    const rows = await this.repository
      .createQueryBuilder('t')
      .select('t.orderId', 'orderId')
      .addSelect('SUM(t.amount)', 'refunded')
      .where('t.type = :type', { type: 'REFUND' })
      .andWhere('t.orderId IN (:...orderIds)', { orderIds })
      .groupBy('t.orderId')
      .getRawMany<{ orderId: string; refunded: string }>();
    return new Map(rows.map((row) => [row.orderId, Number(row.refunded)]));
  }
}
