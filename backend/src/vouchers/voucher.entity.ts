import { Column, Entity, PrimaryColumn } from 'typeorm';

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
}
