import type { Voucher } from './voucher.entity';

export function voucherUnavailableReason(
  voucher: Voucher,
  subtotal: number,
  now: Date,
): string | null {
  if (!voucher.isActive) return 'Mã giảm giá hiện không hoạt động.';
  if (now < voucher.startsAt) return 'Mã giảm giá chưa đến thời gian sử dụng.';
  if (now >= voucher.endsAt) return 'Mã giảm giá đã hết hạn.';
  if (subtotal < voucher.minSubtotal)
    return `Đơn hàng chưa đạt tối thiểu ${voucher.minSubtotal.toLocaleString('vi-VN')}đ.`;
  return null;
}

export function voucherDiscount(voucher: Voucher, subtotal: number): number {
  const discount =
    voucher.discountType === 'FIXED'
      ? voucher.discountValue
      : Math.floor((subtotal * voucher.discountValue) / 100);
  return Math.min(subtotal, voucher.maxDiscount ?? subtotal, discount);
}
