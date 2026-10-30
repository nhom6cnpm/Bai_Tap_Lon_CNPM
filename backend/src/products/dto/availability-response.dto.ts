import type { ProductSize, ToppingId } from '../../orders/pricing';

export interface SelectionAvailabilityResponseDto {
  productId: string;
  size: ProductSize;
  toppingIds: readonly ToppingId[];
  stock: number;
}

export interface CartAvailabilityItemResponseDto extends SelectionAvailabilityResponseDto {
  qty: number;
}

export interface CartAvailabilityResponseDto {
  available: boolean;
  items: CartAvailabilityItemResponseDto[];
}
