import { IsIn } from 'class-validator';
import type { PaymentResult } from './payment-callback.dto';

export class ConfirmMockDto {
  @IsIn(['SUCCESS', 'FAILED'])
  result!: PaymentResult;
}
