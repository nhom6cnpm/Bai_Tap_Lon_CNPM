/** Stored per order; version 1 is activated when benefit settlement is wired. */
export const BENEFITS_POLICY_VERSIONS = {
  LEGACY: 0,
  VOUCHER_QUOTAS_AND_POINTS: 1,
} as const;

export type BenefitsPolicyVersion =
  (typeof BENEFITS_POLICY_VERSIONS)[keyof typeof BENEFITS_POLICY_VERSIONS];

export const LOYALTY_VND_PER_POINT = 10_000;
