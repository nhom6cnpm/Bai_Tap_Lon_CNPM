import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import type { OrderStatus } from './order-status';
import type { CancellationReason } from './order-expiry';
import {
  BENEFITS_POLICY_VERSIONS,
  type BenefitsPolicyVersion,
} from './benefits-policy';
import type { CancelRequestStatus } from './order-cancellation';

export type { OrderStatus } from './order-status';

@Entity('orders')
export class Order {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status!: OrderStatus;

  @Column({ type: 'int' })
  total!: number;

  @Column({ type: 'int' })
  subtotal!: number;

  @Column({ type: 'int', default: 0 })
  discount!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  voucherCode!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  voucherTitle!: string | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @Column({
    type: 'timestamptz',
    default: () => "CURRENT_TIMESTAMP + INTERVAL '15 minutes'",
  })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  inventoryReservedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  inventoryReleasedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  cancelReason!: CancellationReason | null;

  // Remains legacy until reservation and settlement are enabled together.
  @Column({ type: 'int', default: BENEFITS_POLICY_VERSIONS.LEGACY })
  benefitsPolicyVersion!: BenefitsPolicyVersion;

  @Column({ type: 'int', default: 0 })
  pointsEarned!: number;

  @Column({ type: 'int', default: 0 })
  pointsReversed!: number;

  @Column({ type: 'timestamptz', nullable: true })
  pointsAwardedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  pointsReversedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  cancelRequestId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelRequestedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cancelRequestReason!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  cancelRequestStatus!: CancelRequestStatus | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelReviewedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  cancelReviewedBy!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cancelReviewNote!: string | null;
}
