import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DEFAULT_MAX_VOUCHER_USES_PER_USER } from './voucher-usage';

@Entity('vouchers')
export class Voucher {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  code!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 16 })
  discountType!: 'FIXED' | 'PERCENT';

  @Column({ type: 'int' })
  discountValue!: number;

  @Column({ type: 'int', default: 0 })
  minSubtotal!: number;

  @Column({ type: 'int', nullable: true })
  maxDiscount!: number | null;

  @Column({ type: 'timestamptz' })
  startsAt!: Date;

  @Column({ type: 'timestamptz' })
  endsAt!: Date;

  @Column({ type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ type: 'boolean', default: true })
  isPublic!: boolean;

  @Column({ type: 'int', default: DEFAULT_MAX_VOUCHER_USES_PER_USER })
  maxUsesPerUser!: number;
}
