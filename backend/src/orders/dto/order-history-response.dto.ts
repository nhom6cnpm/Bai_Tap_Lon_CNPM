import type { CancellationReason } from '../order-expiry';
import type { OrderStatus } from '../order-status';
import type { ProductSize, ToppingId } from '../pricing';
import type { PaymentMethod } from '../../payments/entities/payment.entity';

export interface OrderHistoryItemDto {
  id: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  size: ProductSize;
  toppingIds: ToppingId[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderHistoryResponseDto {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: Date;
  expiresAt: Date;
  cancelledAt: Date | null;
  cancelReason: CancellationReason | null;
  paymentMethod: PaymentMethod | null;
  serverTime: Date;
  canPay: boolean;
  items: OrderHistoryItemDto[];
}
