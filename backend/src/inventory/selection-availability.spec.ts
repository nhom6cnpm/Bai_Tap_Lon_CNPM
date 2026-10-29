import type { OrderLine, RecipeBook } from './recipe-calculator';
import { selectionAvailability } from './selection-availability';

const book: RecipeBook = {
  products: new Map([
    ['coffee', [{ ingredientId: 'beans', amount: 20 }]],
    ['milk-coffee', [{ ingredientId: 'beans', amount: 10 }]],
    ['rounding', [{ ingredientId: 'beans', amount: 3 }]],
  ]),
  toppings: new Map([
    ['cream', [{ ingredientId: 'cream', amount: 20 }]],
    ['pearls', [{ ingredientId: 'beans', amount: 5 }]],
  ]),
};
const stock = new Map([
  ['beans', 100],
  ['cream', 40],
]);
const line = (overrides: Partial<OrderLine> = {}): OrderLine => ({
  productId: 'coffee',
  size: 'S',
  toppingIds: [],
  qty: 1,
  ...overrides,
});

describe('selection availability', () => {
  it.each([
    ['S', 5],
    ['M', 4],
    ['L', 3],
  ] as const)('uses the selected size %s', (size, expected) => {
    expect(
      selectionAvailability(book, stock, [line({ size })]).items[0].stock,
    ).toBe(expected);
  });

  it('uses the scarcest topping without scaling it by size', () => {
    expect(
      selectionAvailability(book, stock, [
        line({ size: 'L', toppingIds: ['cream'] }),
      ]),
    ).toMatchObject({ available: true, items: [{ stock: 2 }] });
  });

  it('adds topping and base amounts when they use the same ingredient', () => {
    expect(
      selectionAvailability(book, stock, [line({ toppingIds: ['pearls'] })])
        .items[0].stock,
    ).toBe(4);
  });

  it('rounds each base ingredient up before calculating cups', () => {
    expect(
      selectionAvailability(book, stock, [
        line({ productId: 'rounding', size: 'M' }),
      ]).items[0].stock,
    ).toBe(25);
  });

  it('allows the last cup and rejects quantities above stock', () => {
    expect(
      selectionAvailability(book, stock, [line({ qty: 5 })]).available,
    ).toBe(true);
    expect(
      selectionAvailability(book, stock, [line({ qty: 6 })]).available,
    ).toBe(false);
  });

  it('detects shared-ingredient shortages even when each line alone would fit', () => {
    const result = selectionAvailability(book, stock, [
      line({ qty: 5 }),
      line({ productId: 'milk-coffee', qty: 1 }),
    ]);
    expect(result.available).toBe(false);
    expect(result.items.map((item) => item.stock)).toEqual([4, 0]);
  });

  it('subtracts other variants and gives the maximum total for each cart line', () => {
    const result = selectionAvailability(book, stock, [
      line({ qty: 2 }),
      line({ size: 'L', qty: 1 }),
    ]);
    expect(result.available).toBe(true);
    expect(result.items.map((item) => item.stock)).toEqual([3, 2]);
  });

  it('does not double-count the current line when computing its limit', () => {
    expect(
      selectionAvailability(book, stock, [line({ qty: 3 })]).items[0].stock,
    ).toBe(5);
  });

  it('returns zero for a missing ingredient, base recipe or topping recipe', () => {
    for (const selected of [
      line({ toppingIds: ['cream'] }),
      line({ productId: 'unknown', toppingIds: ['pearls'] }),
    ]) {
      expect(
        selectionAvailability(book, new Map([['beans', 100]]), [selected])
          .items[0].stock,
      ).toBe(0);
    }
    const incomplete: RecipeBook = { ...book, toppings: new Map() };
    expect(
      selectionAvailability(incomplete, stock, [
        line({ toppingIds: ['cream'] }),
      ]).items[0].stock,
    ).toBe(0);
  });

  it('clamps shortages to zero and never changes stock or recipes', () => {
    const before = [...stock];
    const result = selectionAvailability(book, stock, [
      line({ qty: 99 }),
      line(),
    ]);
    expect(result.items[1].stock).toBe(0);
    expect([...stock]).toEqual(before);
    expect(book.products.get('coffee')).toEqual([
      { ingredientId: 'beans', amount: 20 },
    ]);
  });
});
