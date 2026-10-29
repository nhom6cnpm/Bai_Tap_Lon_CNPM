export type PaymentResult = 'SUCCESS' | 'FAILED';

export class PaymentCallbackDto {
  paymentId: string;
  result: PaymentResult;
  signature: string;
}
