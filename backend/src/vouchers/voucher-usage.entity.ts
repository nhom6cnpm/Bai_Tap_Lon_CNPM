import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import type { VoucherUsageStatus } from './voucher-usage';

@Entity('voucher_usages')
@Index(
  'IDX_voucher_usages_active_account',
  ['userId', 'voucherCode', 'status'],
  {
    where: `status IN ('RESERVED', 'USED')`,
  },
)
export class VoucherUsage {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  orderId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 32 })
  voucherCode!: string;

  @Column({ type: 'varchar', length: 16, default: 'RESERVED' })
  status!: VoucherUsageStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  reservedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  releasedAt!: Date | null;
}
