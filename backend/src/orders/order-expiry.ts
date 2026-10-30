export const ORDER_EXPIRY_SCAN_INTERVAL_MS = 5_000;
export const UNPAID_ORDER_STATUSES = ['PENDING', 'PAYMENT_FAILED'] as const;
export type CancellationReason = 'PAYMENT_TIMEOUT' | 'USER_CANCELLED';
