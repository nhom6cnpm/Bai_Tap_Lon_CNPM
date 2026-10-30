import type { Order } from "@/types/order";

/** Reward amounts come from persisted order fields; pending estimates are labelled. */
export default function OrderRewards({
  order,
  compact = false,
}: {
  order: Order;
  compact?: boolean;
}) {
  if (order.benefitsPolicyVersion !== 1) return null;
  let text: string;
  let color = "text-stone-600";
  if (order.pointsReversedAt) {
    text = `Đã thu hồi ${order.pointsReversed} điểm`;
  } else if (order.pointsAwardedAt) {
    text = `Đã cộng ${order.pointsEarned} điểm`;
    color = "text-green-800";
  } else if (["PENDING", "PAYMENT_FAILED"].includes(order.status)) {
    text = `Dự kiến +${Math.floor(order.total / 10_000)} điểm sau khi thanh toán`;
    color = "text-amber-800";
  } else {
    if (compact) return null;
    text = "Đơn này chưa được cộng điểm.";
  }
  return (
    <div
      aria-label="Điểm thưởng của đơn"
      className={
        compact
          ? `mt-2 text-xs ${color}`
          : `mt-4 rounded-xl bg-stone-50 p-4 text-sm ${color}`
      }
    >
      <p className="font-semibold">{text}</p>
      {!compact && (
        <p className="mt-1 text-xs text-stone-500">
          10.000đ thực trả = 1 điểm. Điểm dùng để tích lũy, chưa dùng để thanh
          toán.
        </p>
      )}
    </div>
  );
}
