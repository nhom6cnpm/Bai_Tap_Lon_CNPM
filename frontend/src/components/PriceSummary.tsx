import { formatPrice } from "@/lib/formatPrice";

interface Totals {
  subtotal: number;
  discount: number;
  total: number;
  voucherCode?: string | null;
  voucherTitle?: string | null;
}

export default function PriceSummary({ totals }: { totals: Totals }) {
  return (
    <section
      aria-label="Tổng kết thanh toán"
      className="mt-4 border-t border-stone-200 pt-4"
    >
      <dl className="space-y-3 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-stone-600">Tổng tiền món</dt>
          <dd className="shrink-0 font-medium">
            {formatPrice(totals.subtotal)}
          </dd>
        </div>
        {totals.voucherCode && (
          <div className="flex items-start justify-between gap-4 text-amber-800">
            <dt className="min-w-0 break-words">
              <span className="block">
                Voucher{" "}
                <span className="break-all font-medium">
                  {totals.voucherCode}
                </span>
              </span>
              {totals.voucherTitle && (
                <span className="mt-1 block text-xs text-stone-500">
                  {totals.voucherTitle}
                </span>
              )}
            </dt>
            <dd className="shrink-0 font-medium">
              −{formatPrice(totals.discount)}
            </dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 border-t border-stone-100 pt-4">
          <dt className="font-semibold">Tổng thanh toán</dt>
          <dd className="shrink-0 text-xl font-bold text-amber-900">
            {formatPrice(totals.total)}
          </dd>
        </div>
      </dl>
      {totals.discount > 0 && (
        <p className="mt-2 text-right text-xs text-green-800">
          Bạn tiết kiệm {formatPrice(totals.discount)}
        </p>
      )}
    </section>
  );
}
