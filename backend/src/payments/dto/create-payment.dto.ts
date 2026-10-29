import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export type PaymentMethod = 'WALLET' | 'CARD';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsIn(['WALLET', 'CARD'])
  method: PaymentMethod;
}
