import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';
import type { ProductSize, ToppingId } from './pricing';

@Entity('order_items')
export class OrderItem {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @Column({ type: 'varchar', length: 64 })
  productId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  productName!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  productImageUrl!: string | null;

  @Column({ type: 'varchar', length: 10 })
  size!: ProductSize;

  @Column({ type: 'json' })
  toppingIds!: ToppingId[];

  @Column({ type: 'int' })
  qty!: number;

  @Column({ type: 'int' })
  unitPrice!: number;

  @Column({ type: 'int' })
  lineTotal!: number;
}
