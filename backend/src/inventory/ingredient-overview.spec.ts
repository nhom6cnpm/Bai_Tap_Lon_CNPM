import { inventoryOverview, LOW_STOCK_CUPS } from './ingredient-overview';
import type { RecipeBook } from './recipe-calculator';

const book: RecipeBook = {
  products: new Map([
    [
      '1',
      [
        { ingredientId: 'coffee', amount: 20 },
        { ingredientId: 'milk', amount: 30 },
      ],
    ],
    ['2', [{ ingredientId: 'coffee', amount: 18 }]],
  ]),
  toppings: new Map([['cream', [{ ingredientId: 'cream', amount: 20 }]]]),
};
const products = [
  { id: '1', name: 'Cà phê sữa' },
  { id: '2', name: 'Americano' },
];

describe('inventoryOverview (bảng nguyên liệu cho admin)', () => {
  const overview = inventoryOverview(
    book,
    [
      { id: 'coffee', name: 'Cà phê', unit: 'g', quantity: 1000 },
      { id: 'milk', name: 'Sữa đặc', unit: 'ml', quantity: 150 },
      { id: 'cream', name: 'Kem', unit: 'g', quantity: 1000 },
      { id: 'sugar', name: 'Đường', unit: 'g', quantity: 500 },
    ],
    products,
    new Map([['coffee', 40]]),
  );
  const ingredient = (id: string) =>
    overview.ingredients.find((row) => row.id === id)!;

  it('số ly còn làm được = ít nhất trong các món dùng nguyên liệu đó', () => {
    // coffee: 1000/20 = 50 (Cà phê sữa), 1000/18 = 55 (Americano) → 50
    expect(ingredient('coffee').cupsLeft).toBe(50);
    expect(ingredient('coffee').usedBy).toEqual(['Cà phê sữa', 'Americano']);
  });

  it(`cảnh báo sắp hết khi còn dưới ${LOW_STOCK_CUPS} ly`, () => {
    expect(ingredient('milk').cupsLeft).toBe(5);
    expect(ingredient('milk').low).toBe(true);
    expect(ingredient('coffee').low).toBe(false);
  });

  it('topping tính theo phần topping; nguyên liệu không dùng thì không cảnh báo', () => {
    expect(ingredient('cream').cupsLeft).toBe(50);
    expect(ingredient('sugar')).toMatchObject({
      cupsLeft: null,
      low: false,
      usedBy: [],
    });
  });

  it('hiện lượng đang giữ cho đơn chờ thanh toán', () => {
    expect(ingredient('coffee').reserved).toBe(40);
    expect(ingredient('milk').reserved).toBe(0);
  });

  it('số ly còn bán của từng món và nguyên liệu đang giới hạn', () => {
    expect(overview.products).toEqual([
      {
        id: '1',
        name: 'Cà phê sữa',
        sellableCups: 5,
        limitingIngredientId: 'milk',
      },
      {
        id: '2',
        name: 'Americano',
        sellableCups: 55,
        limitingIngredientId: 'coffee',
      },
    ]);
  });
});
