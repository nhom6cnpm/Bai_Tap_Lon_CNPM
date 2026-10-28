import {
  type RecipeBook,
  findShortages,
  requiredForLines,
  requiredPerCup,
  sellableCups,
} from './recipe-calculator';

const book: RecipeBook = {
  products: new Map([
    [
      'ca-phe-sua',
      [
        { ingredientId: 'coffee', amount: 20 },
        { ingredientId: 'condensed-milk', amount: 30 },
      ],
    ],
    [
      'bac-xiu',
      [
        { ingredientId: 'coffee', amount: 10 },
        { ingredientId: 'condensed-milk', amount: 40 },
        { ingredientId: 'fresh-milk', amount: 60 },
      ],
    ],
  ]),
  toppings: new Map([
    ['cream', [{ ingredientId: 'cream', amount: 20 }]],
    ['pearls', [{ ingredientId: 'pearls', amount: 40 }]],
  ]),
};

describe('recipe calculator', () => {
  describe('requiredPerCup', () => {
    it('uses the base recipe for size S', () => {
      expect(requiredPerCup(book, 'ca-phe-sua', 'S', [])).toEqual(
        new Map([
          ['coffee', 20],
          ['condensed-milk', 30],
        ]),
      );
    });

    it('scales base ingredients by size (M ×1.25, L ×1.5) and rounds up', () => {
      expect(requiredPerCup(book, 'ca-phe-sua', 'M', [])).toEqual(
        new Map([
          ['coffee', 25],
          ['condensed-milk', 38], // 37.5 rounded up
        ]),
      );
      expect(requiredPerCup(book, 'ca-phe-sua', 'L', [])).toEqual(
        new Map([
          ['coffee', 30],
          ['condensed-milk', 45],
        ]),
      );
    });

    it('adds topping ingredients without scaling them by size', () => {
      expect(
        requiredPerCup(book, 'ca-phe-sua', 'L', ['cream', 'pearls']),
      ).toEqual(
        new Map([
          ['coffee', 30],
          ['condensed-milk', 45],
          ['cream', 20],
          ['pearls', 40],
        ]),
      );
    });

    it('returns nothing for a product without a recipe', () => {
      expect(requiredPerCup(book, 'unknown', 'S', []).size).toBe(0);
    });
  });

  describe('requiredForLines', () => {
    it('multiplies by quantity and sums shared ingredients across lines', () => {
      const total = requiredForLines(book, [
        { productId: 'ca-phe-sua', size: 'L', toppingIds: ['cream'], qty: 2 },
        { productId: 'bac-xiu', size: 'S', toppingIds: [], qty: 1 },
      ]);
      expect(total).toEqual(
        new Map([
          ['coffee', 2 * 30 + 10],
          ['condensed-milk', 2 * 45 + 40],
          ['cream', 2 * 20],
          ['fresh-milk', 60],
        ]),
      );
    });
  });

  describe('sellableCups', () => {
    it('is limited by the scarcest ingredient', () => {
      const perCup = requiredPerCup(book, 'ca-phe-sua', 'S', []);
      const stock = new Map([
        ['coffee', 200], // 10 cups
        ['condensed-milk', 120], // 4 cups
      ]);
      expect(sellableCups(perCup, stock)).toBe(4);
    });

    it('is 0 when an ingredient is missing or the product has no recipe', () => {
      const perCup = requiredPerCup(book, 'bac-xiu', 'S', []);
      expect(
        sellableCups(
          perCup,
          new Map([
            ['coffee', 1000],
            ['condensed-milk', 1000],
          ]),
        ),
      ).toBe(0);
      expect(sellableCups(new Map(), new Map())).toBe(0);
    });
  });

  describe('findShortages', () => {
    it('lists only ingredients that are not enough', () => {
      const required = new Map([
        ['coffee', 60],
        ['condensed-milk', 90],
      ]);
      const stock = new Map([
        ['coffee', 100],
        ['condensed-milk', 50],
      ]);
      expect(findShortages(required, stock)).toEqual([
        { ingredientId: 'condensed-milk', required: 90, available: 50 },
      ]);
    });
  });
});
