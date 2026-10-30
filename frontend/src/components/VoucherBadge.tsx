import { formatPrice } from "@/lib/formatPrice";

export default function VoucherBadge({ discount }: { discount: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center px-3 py-1 text-xs font-semibold text-amber-800">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full fill-amber-50 stroke-amber-700/50"
      >
        <path
          vectorEffect="non-scaling-stroke"
          d="M1 1H99V8C91 8 91 20 99 20V27H1V20C9 20 9 8 1 8Z"
        />
      </svg>
      <span className="relative">−{formatPrice(discount)}</span>
    </span>
  );
}
