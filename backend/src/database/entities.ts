import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { OrderStatus } from '../orders/order-status';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) email!: string;
  @Column({ select: false }) passwordHash!: string;
  @Column({ default: 0 }) loyaltyPoints!: number;
}

@Entity('orders')
@Index(['userId', 'createdAt'])
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) code!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<UserEntity>;
  @Column({ type: 'varchar', default: 'PENDING' }) status!: OrderStatus;
  @Column({ type: 'integer' }) total!: number;
  @Column({ type: 'varchar', nullable: true }) pickupCode!: string | null;
  @Column({ type: 'varchar', nullable: true }) paymentMethod!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @OneToMany(() => OrderItemEntity, (item) => item.order, {
    cascade: ['insert'],
  })
  items!: Relation<OrderItemEntity[]>;
}

@Entity('order_items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) orderId!: string;
  @ManyToOne(() => OrderEntity, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: Relation<OrderEntity>;
  @Column() productId!: string;
  // Keep a purchase-time snapshot when the menu changes later.
  @Column() name!: string;
  @Column() size!: string;
  @Column('simple-json', { default: '[]' }) toppings!: string[];
  @Column({ type: 'integer' }) qty!: number;
  @Column({ type: 'integer' }) lineTotal!: number;
}
