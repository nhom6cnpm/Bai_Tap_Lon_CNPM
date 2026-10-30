import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PaymentMethod = 'WALLET' | 'CARD';

/**
 * PENDING            khách đã chọn phương thức, chưa chuyển tiền
 * CUSTOMER_REPORTED  khách bấm "Tôi đã chuyển tiền", chờ nhân viên kiểm tra
 * SUCCESS            nhân viên xác nhận đã nhận tiền  → đơn PAID
 * FAILED             nhân viên từ chối                → đơn PAYMENT_FAILED
 *
 * The order itself stays PENDING until staff decide: "customer reported" is a
 * payment state, not an order state (state machine đề mục 9.1 is unchanged).
 */
export const PAYMENT_STATUSES = [
  'PENDING',
  'CUSTOMER_REPORTED',
  'SUCCESS',
  'FAILED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Payments staff still have to decide on. */
export const ACTIVE_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'PENDING',
  'CUSTOMER_REPORTED',
];

@Entity('payments')
export class Payment {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  orderId!: string;

  @Column({ type: 'varchar', length: 64 })
  userId!: string;

  // UNIQUE: the same request sent twice never creates a second payment (Task 10d)
  @Column({ type: 'varchar', length: 128, unique: true })
  idempotencyKey!: string;

  // Same unit as orders.total (VND, integer)
  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'varchar', length: 16 })
  method!: PaymentMethod;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status!: PaymentStatus;

  // When the customer pressed "Tôi đã chuyển tiền"
  @Column({ type: 'timestamptz', nullable: true })
  reportedAt!: Date | null;

  // Staff decision: who, when, and an optional reason shown to the customer
  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reviewNote!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
