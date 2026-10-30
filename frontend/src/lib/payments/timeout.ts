const DEFAULT_ORDER_PAYMENT_TIMEOUT_MINUTES = 15;
const configuredTimeoutMinutes = Number(
  process.env.NEXT_PUBLIC_ORDER_PAYMENT_TIMEOUT_MINUTES,
);

export const ORDER_PAYMENT_TIMEOUT_MS =
  (Number.isFinite(configuredTimeoutMinutes) && configuredTimeoutMinutes > 0
    ? configuredTimeoutMinutes
    : DEFAULT_ORDER_PAYMENT_TIMEOUT_MINUTES) *
  60 *
  1000;

export function getCheckoutDeadlineMs(checkout: {
  createdAt: string;
  expiresAt?: string | null;
}): number {
  const serverDeadline = checkout.expiresAt
    ? Date.parse(checkout.expiresAt)
    : NaN;
  return Number.isFinite(serverDeadline)
    ? serverDeadline
    : Date.parse(checkout.createdAt) + ORDER_PAYMENT_TIMEOUT_MS;
}
