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
}
