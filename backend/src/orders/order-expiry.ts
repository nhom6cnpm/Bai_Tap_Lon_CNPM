export const ORDER_PAYMENT_WINDOW_MS = 5 * 60 * 1000;
export const ORDER_EXPIRY_SCAN_INTERVAL_MS = 5_000;
export const UNPAID_ORDER_STATUSES = ['PENDING', 'PAYMENT_FAILED'] as const;
export type CancellationReason = 'PAYMENT_TIMEOUT' | 'USER_CANCELLED';
