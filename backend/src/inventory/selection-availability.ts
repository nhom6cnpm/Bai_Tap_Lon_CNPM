import {
  type OrderLine,
  type RecipeBook,
  requiredForLines,
  requiredPerCup,
  sellableCups,
} from './recipe-calculator';

/** Maximum total quantity per line after allowing for every other cart line. */
export function selectionAvailability(
  book: RecipeBook,
  stock: ReadonlyMap<string, number>,
  lines: readonly OrderLine[],
) {
  const required = requiredForLines(book, lines);
  const items = lines.map((line) => {
    const hasRecipe =
      Boolean(book.products.get(line.productId)?.length) &&
      line.toppingIds.every((id) => Boolean(book.toppings.get(id)?.length));
    const perCup = requiredPerCup(
      book,
      line.productId,
      line.size,
      line.toppingIds,
    );
    const remaining = new Map(stock);
    for (const [id, amount] of required) {
      const usedByOtherLines = amount - (perCup.get(id) ?? 0) * line.qty;
      remaining.set(id, Math.max(0, (stock.get(id) ?? 0) - usedByOtherLines));
    }
    return {
      ...line,
      stock: hasRecipe ? sellableCups(perCup, remaining) : 0,
    };
  });
  return {
    available: items.every((item) => item.qty <= item.stock),
    items,
  };
}
