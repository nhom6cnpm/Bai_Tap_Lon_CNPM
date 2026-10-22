import type { OrderStatus } from '../order-status';

export class OrderItemResponseDto {
  id!: string;
  productId!: string;
  name!: string;
  size!: string;
  toppings!: string[];
  qty!: number;
  lineTotal!: number;
}

export class OrderResponseDto {
  id!: string;
  code!: string;
  status!: OrderStatus;
  total!: number;
  createdAt!: string;
  pickupCode!: string | null;
  paymentMethod!: string | null;
  items!: OrderItemResponseDto[];
}
