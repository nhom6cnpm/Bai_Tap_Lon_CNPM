import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  type OrderStatus,
  InvalidOrderTransitionException,
  assertTransition,
  canTransition,
  isTerminalStatus,
} from './order-status';

// Arrows from the state machine diagram (đề A1, mục 9.1)
const ALLOWED: Array<[OrderStatus, OrderStatus]> = [
  ['PENDING', 'PAID'],
  ['PENDING', 'PAYMENT_FAILED'],
  ['PENDING', 'CANCELLED'],
  ['PAYMENT_FAILED', 'PENDING'],
  ['PAYMENT_FAILED', 'CANCELLED'],
  ['PAID', 'PREPARING'],
  ['PAID', 'CANCELLED'],
  ['PREPARING', 'READY'],
  ['READY', 'COMPLETED'],
];

const isAllowed = (from: OrderStatus, to: OrderStatus) =>
  ALLOWED.some(([f, t]) => f === from && t === to);

const ALL_PAIRS = ORDER_STATUSES.flatMap((from) =>
  ORDER_STATUSES.map((to) => [from, to] as [OrderStatus, OrderStatus]),
);
const FORBIDDEN = ALL_PAIRS.filter(([from, to]) => !isAllowed(from, to));

describe('Order state machine', () => {
  it('transition table matches the diagram exactly', () => {
    const fromTable = ORDER_STATUSES.flatMap((from) =>
      ORDER_TRANSITIONS[from].map((to) => `${from}->${to}`),
    ).sort();
    const fromDiagram = ALLOWED.map(([f, t]) => `${f}->${t}`).sort();
    expect(fromTable).toEqual(fromDiagram);
  });

  it.each(ALLOWED)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each(FORBIDDEN)('rejects %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(
      InvalidOrderTransitionException,
    );
  });

  it('does not allow paying a failed order directly (must retry via PENDING)', () => {
    expect(() => assertTransition('PAYMENT_FAILED', 'PAID')).toThrow(
      InvalidOrderTransitionException,
    );
  });

  it('does not allow skipping steps (PAID -> COMPLETED)', () => {
    expect(() => assertTransition('PAID', 'COMPLETED')).toThrow(
      InvalidOrderTransitionException,
    );
  });

  it('treats COMPLETED and CANCELLED as terminal states', () => {
    expect(isTerminalStatus('COMPLETED')).toBe(true);
    expect(isTerminalStatus('CANCELLED')).toBe(true);
    for (const to of ORDER_STATUSES) {
      expect(canTransition('COMPLETED', to)).toBe(false);
      expect(canTransition('CANCELLED', to)).toBe(false);
    }
  });

  it('rejects staying in the same status', () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it('returns a 400 error with a clear message', () => {
    expect.assertions(2);
    try {
      assertTransition('CANCELLED', 'PAID');
    } catch (error) {
      expect((error as InvalidOrderTransitionException).getStatus()).toBe(400);
      expect((error as Error).message).toBe(
        'Không thể chuyển đơn hàng từ CANCELLED sang PAID',
      );
    }
  });
});
