// Demo surcharges shared with Task 5. The order API must recalculate prices.
export const sizeOptions = [
  { id: 'S', price: 0 },
  { id: 'M', price: 5000 },
  { id: 'L', price: 10000 },
] as const;

export const toppingOptions = [
  { id: 'cream', name: 'Kem béo', price: 5000 },
  { id: 'pearls', name: 'Trân châu', price: 5000 },
] as const;

export type ProductSize = (typeof sizeOptions)[number]['id'];
export type ToppingId = (typeof toppingOptions)[number]['id'];

export function calculateUnitPrice(basePrice: number, size: ProductSize, toppingIds: readonly ToppingId[]): number {
  const sizePrice = sizeOptions.find((option) => option.id === size)?.price ?? 0;
  const toppingPrice = toppingOptions.filter((option) => toppingIds.includes(option.id))
    .reduce((total, option) => total + option.price, 0);
  return basePrice + sizePrice + toppingPrice;
}
