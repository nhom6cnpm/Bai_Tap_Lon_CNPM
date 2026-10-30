import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** Lock this row before counting or changing an account's voucher usages. */
@Entity('voucher_user_quotas')
export class VoucherUserQuota {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ type: 'varchar', length: 32 })
  voucherCode!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
