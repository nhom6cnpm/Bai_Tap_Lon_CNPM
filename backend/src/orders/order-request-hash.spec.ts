import { orderRequestHash } from './order-request-hash';
import type { CreateOrderDto } from './dto/create-order.dto';

const cart = (overrides: Partial<CreateOrderDto> = {}): CreateOrderDto => ({
  items: [
    { productId: '1', size: 'M', toppingIds: ['cream', 'pearls'], qty: 2 },
    { productId: '4', size: 'S', toppingIds: [], qty: 1 },
  ],
  ...overrides,
});

describe('orderRequestHash (Idempotency-Key của POST /orders)', () => {
  it('cùng giỏ hàng cho cùng dấu vân tay, không phụ thuộc thứ tự món/topping', () => {
    const reordered = cart({
      items: [
        { productId: '4', size: 'S', toppingIds: [], qty: 1 },
        { productId: '1', size: 'M', toppingIds: ['pearls', 'cream'], qty: 2 },
      ],
    });
    expect(orderRequestHash(reordered)).toBe(orderRequestHash(cart()));
  });

  it('voucher không phân biệt hoa thường và khoảng trắng', () => {
    expect(orderRequestHash(cart({ voucherCode: ' ui10k ' }))).toBe(
      orderRequestHash(cart({ voucherCode: 'UI10K' })),
    );
  });

  it.each([
    [
      'số lượng',
      cart({ items: [{ productId: '1', size: 'M', toppingIds: [], qty: 3 }] }),
    ],
    [
      'size',
      cart({
        items: [
          {
            productId: '1',
            size: 'L',
            toppingIds: ['cream', 'pearls'],
            qty: 2,
          },
          { productId: '4', size: 'S', toppingIds: [], qty: 1 },
        ],
      }),
    ],
    ['voucher', cart({ voucherCode: 'UI10K' })],
  ])('khác %s thì khác dấu vân tay', (_label, other) => {
    expect(orderRequestHash(other)).not.toBe(orderRequestHash(cart()));
  });
});
