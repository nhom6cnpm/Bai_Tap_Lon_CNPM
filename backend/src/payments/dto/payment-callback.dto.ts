import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export type PaymentResult = 'SUCCESS' | 'FAILED';

export class PaymentCallbackDto {
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @IsIn(['SUCCESS', 'FAILED'])
  result: PaymentResult;

  @IsString()
  @IsNotEmpty()
  signature: string;
}
