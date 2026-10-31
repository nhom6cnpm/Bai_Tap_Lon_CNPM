import {
  type RecipeBook,
  requiredPerCup,
  sellableCups,
} from './recipe-calculator';

/** Below this many cups (size S / one topping serving) an ingredient is flagged. */
export const LOW_STOCK_CUPS = 10;

export interface IngredientRow {
  id: string;
  name: string;
  unit: string;
  quantity: number;
}

export interface ProductRow {
  id: string;
  name: string;
}

export interface IngredientOverviewItem extends IngredientRow {
  /** Held for orders still waiting for payment; returned if they are cancelled */
  reserved: number;
  /** Fewest cups (size S) or topping servings this ingredient can still make */
  cupsLeft: number | null;
  low: boolean;
  usedBy: string[];
}

export interface ProductOverviewItem {
  id: string;
  name: string;
  sellableCups: number;
  limitingIngredientId: string | null;
}

export interface InventoryOverview {
  lowStockCups: number;
  ingredients: IngredientOverviewItem[];
  products: ProductOverviewItem[];
}

/**
 * Admin view of the ingredient stock. `quantity` is what is left after every
 * reservation, so it is exactly what new orders can still use.
 */
export function inventoryOverview(
  book: RecipeBook,
  ingredients: readonly IngredientRow[],
  products: readonly ProductRow[],
  reserved: ReadonlyMap<string, number>,
): InventoryOverview {
  const stock = new Map(ingredients.map((row) => [row.id, row.quantity]));
  const productName = new Map(products.map((row) => [row.id, row.name]));
  // Every (consumer, amount per cup/serving) for each ingredient
  const uses = new Map<string, Array<{ label: string; amount: number }>>();
  const addUse = (ingredientId: string, label: string, amount: number) => {
    const list = uses.get(ingredientId) ?? [];
    list.push({ label, amount });
    uses.set(ingredientId, list);
  };
  for (const product of products)
    for (const [id, amount] of requiredPerCup(book, product.id, 'S', []))
      addUse(id, product.name, amount);
  for (const [toppingId, entries] of book.toppings)
    for (const entry of entries)
      addUse(entry.ingredientId, `Topping ${toppingId}`, entry.amount);

  return {
    lowStockCups: LOW_STOCK_CUPS,
    ingredients: ingredients.map((row) => {
      const list = uses.get(row.id) ?? [];
      const cupsLeft = list.length
        ? Math.min(...list.map((use) => Math.floor(row.quantity / use.amount)))
        : null;
      return {
        ...row,
        reserved: reserved.get(row.id) ?? 0,
        cupsLeft,
        low: cupsLeft !== null && cupsLeft < LOW_STOCK_CUPS,
        usedBy: [...new Set(list.map((use) => use.label))],
      };
    }),
    products: products.map((product) => {
      const perCup = requiredPerCup(book, product.id, 'S', []);
      let limitingIngredientId: string | null = null;
      let fewest = Number.POSITIVE_INFINITY;
      for (const [id, amount] of perCup) {
        const cups = Math.floor((stock.get(id) ?? 0) / amount);
        if (cups < fewest) {
          fewest = cups;
          limitingIngredientId = id;
        }
      }
      return {
        id: product.id,
        name: productName.get(product.id) ?? product.id,
        sellableCups: sellableCups(perCup, stock),
        limitingIngredientId,
      };
    }),
  };
}
