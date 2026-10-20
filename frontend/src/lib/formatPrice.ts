const priceFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) {
    return '0đ';
  }

  return `${priceFormatter.format(value)}đ`;
}
