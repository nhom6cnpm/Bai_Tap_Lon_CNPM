import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import type { UserRole } from './roles';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'int', default: 0 })
  loyaltyPoints!: number;

  // CUSTOMER = khách hàng, ADMIN = nhân viên cửa hàng (xác nhận thanh toán)
  @Column({ type: 'varchar', length: 16, default: 'CUSTOMER' })
  role!: UserRole;

  @CreateDateColumn()
  createdAt!: Date;
}
