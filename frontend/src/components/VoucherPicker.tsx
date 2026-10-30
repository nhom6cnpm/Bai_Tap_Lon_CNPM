"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useVoucherQuote } from "@/hooks/useVoucherQuote";
import { quoteVoucher } from "@/lib/vouchers";
import { formatPrice } from "@/lib/formatPrice";
import type { CartItem } from "@/store/useCart";

interface Props {
  items: CartItem[];
  selectedCode: string;
  onSelect: (code: string) => void;
  disabled?: boolean;
}

function VoucherDialog({
  items,
  selectedCode,
  onSelect,
  onClose,
}: Props & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState(selectedCode);
  const [notice, setNotice] = useState("");
  const list = useVoucherQuote(items);
  const check = useMutation({
    mutationFn: (code: string) => quoteVoucher(items, code),
  });
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function verify(code: string) {
    setNotice("");
    try {
      const result = await check.mutateAsync(code.trim().toUpperCase());
      setDraft(result.voucherCode ?? "");
      setNotice(
        `Mã ${result.voucherCode} hợp lệ. Giảm ${formatPrice(result.discount)}.`,
      );
    } catch {
      // The mutation exposes the server's validation message below.
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={() => {
        // React Strict Mode can close and reopen the native dialog before its queued close event.
        if (!dialog.current?.open) onClose();
      }}
      aria-labelledby="voucher-title"
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-stone-200 bg-white p-5 text-stone-900 shadow-xl backdrop:bg-stone-950/40 sm:inset-0 sm:m-auto sm:max-w-lg sm:rounded-3xl sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="voucher-title" className="text-xl font-bold">
          Chọn ưu đãi BrewLite
        </h2>
        <button
          type="button"
          aria-label="Đóng chọn ưu đãi"
          onClick={onClose}
          className="rounded-full border border-stone-300 px-3 py-2"
        >
          ✕
        </button>
      </div>
      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (input.trim()) void verify(input);
        }}
      >
        <label htmlFor="voucher-input" className="text-sm font-semibold">
          Nhập mã giảm giá
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="voucher-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={32}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="Nhập mã của bạn"
            className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-3 uppercase focus:outline-2 focus:outline-amber-800"
          />
          <button
            disabled={!input.trim() || check.isPending}
            className="rounded-xl bg-amber-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Kiểm tra
          </button>
        </div>
      </form>
      {check.isPending && (
        <p role="status" className="mt-3 text-sm">
          Đang kiểm tra mã…
        </p>
      )}
      {check.error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {check.error.message}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-3 text-sm text-green-800">
          {notice}
        </p>
      )}
      <h3 className="mt-6 font-bold">Mã có sẵn</h3>
      <p className="mt-1 text-sm text-stone-500">Chọn một mã cho đơn hàng.</p>
      {list.isPending && (
        <p role="status" className="mt-4 text-sm">
          Đang tải ưu đãi…
        </p>
      )}
      {list.isError && (
        <div role="alert" className="mt-4 text-sm text-red-700">
          {list.error.message}{" "}
          <button
            onClick={() => void list.refetch()}
            className="font-semibold underline"
          >
            Thử lại
          </button>
        </div>
      )}
      {list.data?.vouchers.length === 0 && (
        <p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
          Hiện chưa có mã ưu đãi công khai. Nếu bạn có mã riêng, hãy nhập ở trên
          để kiểm tra.
        </p>
      )}
      <div className="mt-4 space-y-3">
        {list.data?.vouchers.map((voucher) => (
          <label
            key={voucher.code}
            className={`flex items-start gap-3 rounded-2xl border p-4 ${voucher.unavailableReason ? "border-stone-200 bg-stone-50 text-stone-500" : draft === voucher.code ? "border-amber-700 bg-amber-50" : "border-stone-200"}`}
          >
            <input
              type="radio"
              name="voucher"
              value={voucher.code}
              checked={draft === voucher.code}
              disabled={!!voucher.unavailableReason || check.isPending}
              onChange={() => {
                setDraft(voucher.code);
                setNotice("");
                check.reset();
              }}
              className="mt-1 accent-amber-800"
            />
            <span className="min-w-0 flex-1 text-sm">
              <span className="block font-bold">{voucher.title}</span>
              <span className="mt-1 block break-all font-semibold text-amber-900">
                {voucher.code}
              </span>
              <span className="mt-1 block">
                {voucher.discountType === "PERCENT"
                  ? `Giảm ${voucher.discountValue}%`
                  : `Giảm ${formatPrice(voucher.discountValue)}`}
                {voucher.maxDiscount
                  ? `, tối đa ${formatPrice(voucher.maxDiscount)}`
                  : ""}
              </span>
              <span className="mt-1 block">
                Đơn tối thiểu {formatPrice(voucher.minSubtotal)}
              </span>
              <span className="mt-1 block">
                Hạn dùng: {new Date(voucher.endsAt).toLocaleString("vi-VN")}
              </span>
              {voucher.unavailableReason && (
                <span className="mt-2 block text-red-700">
                  {voucher.unavailableReason}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      <div className="sticky bottom-0 mt-5 border-t border-stone-200 bg-white pt-4">
        <p className="mb-3 break-all text-sm">
          {draft ? `Đang chọn: ${draft}` : "Chưa chọn mã giảm giá"}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setDraft("");
              setNotice("");
              check.reset();
            }}
            disabled={check.isPending}
            className="flex-1 rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold"
          >
            Bỏ chọn
          </button>
          <button
            onClick={() => {
              onSelect(draft);
              onClose();
            }}
            disabled={check.isPending}
            className="flex-1 rounded-full bg-amber-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function VoucherPicker(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-4 rounded-2xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-semibold">Ưu đãi BrewLite</span>
        <button
          disabled={props.disabled}
          onClick={() => setOpen(true)}
          className="text-sm font-semibold text-amber-800 underline disabled:opacity-50"
        >
          Chọn hoặc nhập mã
        </button>
      </div>
      {props.selectedCode && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="break-all font-semibold text-amber-900">
            {props.selectedCode}
          </span>
          <button
            disabled={props.disabled}
            onClick={() => props.onSelect("")}
            className="underline disabled:opacity-50"
          >
            Bỏ mã
          </button>
        </div>
      )}
      {props.disabled && (
        <p className="mt-2 text-xs text-stone-500">
          Mã và số tiền được giữ theo đơn đã tạo. Tiếp tục thanh toán đơn hiện
          tại.
        </p>
      )}
      {open && (
        <VoucherDialog
          key={JSON.stringify(props.items)}
          {...props}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
