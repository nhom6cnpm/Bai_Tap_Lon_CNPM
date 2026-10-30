import type { BenefitsPolicyVersion } from '../benefits-policy';
import type { CancelRequestStatus } from '../order-cancellation';

/** Shared contract for the upcoming customer/admin workflow responses. */
export interface OrderBenefitsResponseDto {
  benefitsPolicyVersion: BenefitsPolicyVersion;
  pointsEarned: number;
  pointsReversed: number;
  pointsAwardedAt: Date | null;
  pointsReversedAt: Date | null;
}

export interface CancelRequestResponseDto {
  id: string;
  status: CancelRequestStatus;
  reason: string;
  requestedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  reviewNote: string | null;
}

export interface CancellationCapabilitiesDto {
  canCancelImmediately: boolean;
  canRequestCancellation: boolean;
  cancelRequest: CancelRequestResponseDto | null;
}
