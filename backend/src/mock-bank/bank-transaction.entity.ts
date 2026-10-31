import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * IN      tiền vào tài khoản của quán (khách chuyển khoản qua ngân hàng giả lập,
 *         hoặc nhân viên xác nhận đã thu tại quầy)
 * REFUND  quán hoàn tiền cho khách (hủy đơn đã có tiền, từ chối thanh toán)
 */
export const BANK_TRANSACTION_TYPES = ['IN', 'REFUND'] as const;
export type BankTransactionType = (typeof BANK_TRANSACTION_TYPES)[number];

/** Sao kê tài khoản của quán trong ngân hàng giả lập. Chỉ thêm dòng, không sửa/xóa. */
@Entity('bank_transactions')
export class BankTransaction {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  type!: BankTransactionType;

  // Always positive, VND; REFUND rows are subtracted when computing a balance
  @Column({ type: 'int' })
  amount!: number;

  @Index('IDX_bank_transactions_orderId')
  @Column({ type: 'varchar', length: 64 })
  orderId!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  paymentId!: string | null;

  // Nội dung chuyển khoản, as it appears on the statement
  @Column({ type: 'varchar', length: 255 })
  content!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
