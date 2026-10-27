import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

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

  @CreateDateColumn()
  createdAt!: Date;
}
