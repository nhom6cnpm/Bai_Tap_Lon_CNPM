import type { CancellationReason } from '../order-expiry';
import type { OrderStatus } from '../order-status';

export interface CreateOrderResponseDto {
  message: string;
  orderId: string;
  total: number;
  subtotal: number;
  discount: number;
  voucherCode: string | null;
  voucherTitle: string | null;
  status: OrderStatus;
  createdAt: Date;
  expiresAt: Date;
}

export interface CancelOrderResponseDto {
  orderId: string;
  status: OrderStatus;
  cancelReason: CancellationReason | null;
  cancelledAt: Date | null;
  expiresAt: Date;
}
