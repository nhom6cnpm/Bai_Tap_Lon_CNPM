import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * One row per (user, Idempotency-Key) of POST /orders: sending the same key
 * twice returns the order created by the first request instead of a new one.
 */
@Entity('order_request_keys')
export class OrderRequestKey {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  userId!: string;

  @PrimaryColumn({ type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({ type: 'varchar', length: 64 })
  orderId!: string;

  // sha256 of the normalized cart: the same key with another cart is rejected
  @Column({ type: 'varchar', length: 64 })
  requestHash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
