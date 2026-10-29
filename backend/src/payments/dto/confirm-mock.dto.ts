import { IsIn } from 'class-validator';

export type PaymentResult = 'SUCCESS' | 'FAILED';

export class ConfirmMockDto {
  @IsIn(['SUCCESS', 'FAILED'])
  result: PaymentResult;
}
