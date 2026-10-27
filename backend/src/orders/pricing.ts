// Surcharges must stay in sync with frontend/src/lib/productOptions.ts
export const SIZE_SURCHARGE = { S: 0, M: 5000, L: 10000 } as const;
export const TOPPING_PRICES = { cream: 5000, pearls: 5000 } as const;

export type ProductSize = keyof typeof SIZE_SURCHARGE;
export type ToppingId = keyof typeof TOPPING_PRICES;

export const SIZE_IDS = Object.keys(SIZE_SURCHARGE) as ProductSize[];
export const TOPPING_IDS = Object.keys(TOPPING_PRICES) as ToppingId[];

export function calculateUnitPrice(
  basePrice: number,
  size: ProductSize,
  toppingIds: readonly ToppingId[],
): number {
  const toppingPrice = toppingIds.reduce(
    (sum, id) => sum + TOPPING_PRICES[id],
    0,
  );
  return basePrice + SIZE_SURCHARGE[size] + toppingPrice;
}
