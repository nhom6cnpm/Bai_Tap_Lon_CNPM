import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('payments')
export class Payment {
  @PrimaryColumn('varchar')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'idempotency_key', unique: true }) 
  idempotencyKey: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column()
  method: string; 

  @Column({ default: 'PENDING' })
  status: string; 

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
