import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  PAYMENT_STATUSES,
  type PaymentStatus,
} from '../entities/payment.entity';

export type AdminPaymentFilter = 'ACTIVE' | 'ALL' | PaymentStatus;

export class ListAdminPaymentsDto {
  // ACTIVE (default) = PENDING + CUSTOMER_REPORTED
  @IsOptional()
  @IsIn(['ACTIVE', 'ALL', ...PAYMENT_STATUSES])
  status?: AdminPaymentFilter;

  // Order code read from the customer's QR
  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;
}
