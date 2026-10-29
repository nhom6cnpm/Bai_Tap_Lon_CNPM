import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Ingredient } from '../inventory/ingredient.entity';
import { Order } from './order.entity';

@Entity('order_ingredient_reservations')
export class OrderInventoryReservation {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  orderId!: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  ingredientId!: string;

  @Column({ type: 'int' })
  amount!: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order!: Order;

  @ManyToOne(() => Ingredient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ingredientId' })
  ingredient!: Ingredient;
}
