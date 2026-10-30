import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { PaymentMethod } from './payment.entity';

/** Binds every request key, including requests that reuse an active payment. */
@Entity('payment_request_keys')
export class PaymentRequestKey {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;
  @Column({ type: 'varchar', length: 64 })
  paymentId!: string;
  @Column({ type: 'varchar', length: 64 })
  orderId!: string;
  @Column({ type: 'varchar', length: 64 })
  userId!: string;
  @Column({ type: 'varchar', length: 16 })
  method!: PaymentMethod;
}
