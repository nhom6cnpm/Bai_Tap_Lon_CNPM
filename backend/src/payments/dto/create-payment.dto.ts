export type PaymentMethod = 'WALLET' | 'CARD';

export class CreatePaymentDto {
  orderId: string;
  method: PaymentMethod;
}
