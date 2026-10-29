import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PaymentMethod = 'WALLET' | 'CARD';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

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

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  status!: PaymentStatus;

  @Column({ type: 'varchar', length: 500 })
  gatewayUrl!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
