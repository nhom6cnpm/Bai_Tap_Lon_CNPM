import type { OrderStatus } from './order-status';
import { ConflictException } from '@nestjs/common';
import type { Order } from './order.entity';
import type { CancellationCapabilitiesDto } from './dto/order-workflow-response.dto';

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
  hasReceivedTransfer: boolean,
  requestStatus: CancelRequestStatus | null,
): CancellationAction {
  if (requestStatus === 'PENDING') return 'UNAVAILABLE';
  if (status === 'PAID') return 'REQUEST';
  if (status === 'PENDING' || status === 'PAYMENT_FAILED')
    return hasReceivedTransfer ? 'REQUEST' : 'IMMEDIATE';
  return 'UNAVAILABLE';
}

export function assertNoPendingCancellation(order: Order): void {
  if (order.cancelRequestStatus === 'PENDING')
    throw new ConflictException({
      code: 'CANCELLATION_REQUEST_PENDING',
      message: 'Đơn đang chờ duyệt hủy. Vui lòng xử lý yêu cầu hủy trước.',
    });
}

export function cancellationCapabilities(
  order: Order,
  hasReceivedTransfer: boolean,
  now: Date,
): CancellationCapabilitiesDto {
  // Money already received: not expired, the customer may still ask staff
  const expired =
    ['PENDING', 'PAYMENT_FAILED'].includes(order.status) &&
    order.expiresAt <= now &&
    !hasReceivedTransfer;
  const action = expired
    ? 'UNAVAILABLE'
    : cancellationAction(
        order.status,
        hasReceivedTransfer,
        order.cancelRequestStatus,
      );
  return {
    canCancelImmediately: action === 'IMMEDIATE',
    canRequestCancellation: action === 'REQUEST',
    cancelRequest: order.cancelRequestId
      ? {
          id: order.cancelRequestId,
          status: order.cancelRequestStatus!,
          reason: order.cancelRequestReason!,
          requestedAt: order.cancelRequestedAt!,
          reviewedAt: order.cancelReviewedAt,
          reviewedBy: order.cancelReviewedBy,
          reviewNote: order.cancelReviewNote,
        }
      : null,
  };
}
