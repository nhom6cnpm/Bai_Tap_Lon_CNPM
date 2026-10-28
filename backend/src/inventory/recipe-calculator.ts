import type { ProductSize, ToppingId } from '../orders/pricing';

// Recipes are stored for size S. Bigger sizes use more of every base ingredient;
// toppings add their own ingredients and are not scaled by size.
export const SIZE_INGREDIENT_FACTOR: Readonly<Record<ProductSize, number>> = {
  S: 1,
  M: 1.25,
  L: 1.5,
};

export interface RecipeEntry {
  ingredientId: string;
  amount: number; // grams or millilitres for one cup
}

export interface RecipeBook {
  products: ReadonlyMap<string, readonly RecipeEntry[]>;
  toppings: ReadonlyMap<string, readonly RecipeEntry[]>;
}

export interface OrderLine {
  productId: string;
  size: ProductSize;
  toppingIds: readonly ToppingId[];
  qty: number;
}

/** ingredientId -> amount */
export type IngredientAmounts = Map<string, number>;

function addAmount(target: IngredientAmounts, id: string, amount: number) {
  target.set(id, (target.get(id) ?? 0) + amount);
}

/** Ingredients needed for one cup with the chosen size and toppings. */
export function requiredPerCup(
  book: RecipeBook,
  productId: string,
  size: ProductSize,
  toppingIds: readonly string[],
): IngredientAmounts {
  const result: IngredientAmounts = new Map();
  for (const entry of book.products.get(productId) ?? []) {
    // Round up so rounding never lets us sell more than we have
    addAmount(
      result,
      entry.ingredientId,
      Math.ceil(entry.amount * SIZE_INGREDIENT_FACTOR[size]),
    );
  }
  for (const toppingId of toppingIds) {
    for (const entry of book.toppings.get(toppingId) ?? []) {
      addAmount(result, entry.ingredientId, entry.amount);
    }
  }
  return result;
}

/** Total ingredients needed for a whole order (used when placing an order). */
export function requiredForLines(
  book: RecipeBook,
  lines: readonly OrderLine[],
): IngredientAmounts {
  const total: IngredientAmounts = new Map();
  for (const line of lines) {
    const perCup = requiredPerCup(
      book,
      line.productId,
      line.size,
      line.toppingIds,
    );
    for (const [id, amount] of perCup) {
      addAmount(total, id, amount * line.qty);
    }
  }
  return total;
}

/** How many cups can still be made from the current stock. */
export function sellableCups(
  perCup: IngredientAmounts,
  stock: ReadonlyMap<string, number>,
): number {
  if (perCup.size === 0) {
    return 0; // no recipe → cannot be prepared
  }
  let cups = Number.POSITIVE_INFINITY;
  for (const [id, amount] of perCup) {
    cups = Math.min(cups, Math.floor((stock.get(id) ?? 0) / amount));
  }
  return cups;
}

/** Ingredients that do not have enough stock for the requested amounts. */
export function findShortages(
  required: IngredientAmounts,
  stock: ReadonlyMap<string, number>,
): Array<{ ingredientId: string; required: number; available: number }> {
  const shortages: Array<{
    ingredientId: string;
    required: number;
    available: number;
  }> = [];
  for (const [ingredientId, amount] of required) {
    const available = stock.get(ingredientId) ?? 0;
    if (available < amount) {
      shortages.push({ ingredientId, required: amount, available });
    }
  }
  return shortages;
}
