import type { OrderStatus } from './order-status';

export const CANCEL_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
] as const;
export type CancelRequestStatus = (typeof CANCEL_REQUEST_STATUSES)[number];
export type CancellationAction = 'IMMEDIATE' | 'REQUEST' | 'UNAVAILABLE';

/** Evaluate only after ownership and the persisted deadline have been checked. */
export function cancellationAction(
  status: OrderStatus,
  hasReportedPayment: boolean,
  requestStatus: CancelRequestStatus | null,
): CancellationAction {
  if (requestStatus === 'PENDING') return 'UNAVAILABLE';
  if (status === 'PAID') return 'REQUEST';
  if (status === 'PENDING' || status === 'PAYMENT_FAILED')
    return hasReportedPayment ? 'REQUEST' : 'IMMEDIATE';
  return 'UNAVAILABLE';
}
