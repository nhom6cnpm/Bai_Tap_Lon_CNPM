// How long an order waits for payment (customer transfer + staff confirmation).
// Shared by backend and frontend through ORDER_PAYMENT_TIMEOUT_MINUTES.
export const DEFAULT_ORDER_PAYMENT_TIMEOUT_MINUTES = 15;

export function parsePaymentTimeoutMinutes(raw: string | undefined): number {
  const minutes = Number(raw);
  return Number.isFinite(minutes) && minutes > 0
    ? minutes
    : DEFAULT_ORDER_PAYMENT_TIMEOUT_MINUTES;
}

export function paymentDeadline(createdAt: Date, timeoutMinutes: number): Date {
  return new Date(createdAt.getTime() + timeoutMinutes * 60 * 1000);
}
