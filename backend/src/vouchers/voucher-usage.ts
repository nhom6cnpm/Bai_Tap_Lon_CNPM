export const DEFAULT_MAX_VOUCHER_USES_PER_USER = 3;
export const VOUCHER_USAGE_STATUSES = ['RESERVED', 'USED', 'RELEASED'] as const;
export type VoucherUsageStatus = (typeof VOUCHER_USAGE_STATUSES)[number];

/** Account-specific availability; quoting this view never reserves a use. */
export interface VoucherUsageAvailability {
  maxUsesPerUser: number;
  reservedUses: number;
  usedUses: number;
  availableUses: number;
}
