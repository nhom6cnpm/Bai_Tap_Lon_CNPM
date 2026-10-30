"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useVoucherQuote } from "@/hooks/useVoucherQuote";
import { quoteVoucher } from "@/lib/vouchers";
import { formatPrice } from "@/lib/formatPrice";
import type { CartItem } from "@/store/useCart";
import VoucherIcon from "./VoucherIcon";
import VoucherBadge from "./VoucherBadge";
import { useAuth } from "@/hooks/useAuth";
import { getStoredToken } from "@/lib/auth";

interface Props {
  items: CartItem[];
  selectedCode: string;
  onSelect: (code: string) => void;
  disabled?: boolean;
  locked?: boolean;
  appliedDiscount?: number;
}

function VoucherDialog({
  items,
  selectedCode,
  onSelect,
  onClose,
}: Props & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState(selectedCode);
  const [notice, setNotice] = useState("");
  const { token } = useAuth();
  const list = useVoucherQuote(items, undefined, true, 5_000);
  const check = useMutation({
    mutationKey: ["voucher-check", token],
    mutationFn: (code: string) => quoteVoucher(items, code, undefined, token),
  });
  useEffect(() => {
    mounted.current = true;
    const element = dialog.current;
    element?.showModal();
    return () => {
      mounted.current = false;
      element?.close();
    };
  }, []);

  async function verify(code: string) {
    setNotice("");
    try {
      const result = await check.mutateAsync(code.trim().toUpperCase());
      if (getStoredToken() !== token || !dialog.current?.open) return;
      setDraft(result.voucherCode ?? "");
      setNotice(
        `Mã ${result.voucherCode} hợp lệ. Giảm ${formatPrice(result.discount)}.`,
      );
    } catch {
      // The mutation exposes the server's validation message below.
    }
  }

  async function confirm() {
    if (!draft) {
      onSelect("");
      onClose();
      return;
    }
    setNotice("");
    try {
      const result = await check.mutateAsync(draft);
      if (getStoredToken() !== token || !dialog.current?.open) return;
      onSelect(result.voucherCode ?? "");
      onClose();
    } catch {
      void list.refetch();
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={() => {
        // React Strict Mode can close and reopen the native dialog before its queued close event.
        if (mounted.current && !dialog.current?.open) onClose();
      }}
      aria-labelledby="voucher-title"
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none flex-col overflow-hidden rounded-t-3xl border border-stone-200 bg-white p-0 text-stone-900 shadow-xl backdrop:bg-stone-950/40 open:flex sm:inset-0 sm:m-auto sm:max-w-xl sm:rounded-3xl"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 p-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
            <VoucherIcon className="size-6" />
          </span>
          <div>
            <h2 id="voucher-title" className="text-lg font-bold sm:text-xl">
              Chọn ưu đãi BrewLite
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Chọn mã phù hợp để tiết kiệm hơn
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Đóng chọn ưu đãi"
          onClick={onClose}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl text-stone-500 hover:bg-stone-100 hover:text-stone-900"
        >
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:px-6">
        <form
          className="rounded-2xl bg-stone-50 p-4"
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
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Mã có sẵn</h3>
          <span className="text-xs text-stone-500">
            Chọn một mã cho đơn hàng
          </span>
        </div>
        {!token && (
          <p className="mt-2 text-xs text-stone-500">
            Đăng nhập để xem số lượt voucher của bạn.
          </p>
        )}
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
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-stone-200 px-5 py-7 text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
              <VoucherIcon className="size-7" />
            </span>
            <p className="text-sm leading-6 text-stone-600">
              Hiện chưa có mã ưu đãi công khai. Nếu bạn có mã riêng, hãy nhập ở
              trên để kiểm tra.
            </p>
          </div>
        )}
        <div className="mt-4 space-y-3">
          {list.data?.vouchers.map((voucher) => (
            <label
              key={voucher.code}
              className={`voucher-ticket relative flex overflow-hidden rounded-lg border bg-white transition-colors [--voucher-stub-width:4.5rem] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber-700 sm:[--voucher-stub-width:5.5rem] ${voucher.unavailableReason ? "cursor-not-allowed border-stone-200 text-stone-500" : draft === voucher.code ? "cursor-pointer border-amber-700" : "cursor-pointer border-stone-200 hover:border-amber-400"}`}
            >
              {voucher.usage && (
                <span className="sr-only">
                  Còn {voucher.usage.availableUses} lượt
                </span>
              )}
              {voucher.usage && voucher.usage.availableUses > 1 && (
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-0 rounded-bl-xl bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900"
                >
                  x{voucher.usage.availableUses}
                </span>
              )}
              <span
                aria-hidden="true"
                className={`flex w-[var(--voucher-stub-width)] shrink-0 flex-col items-center justify-center gap-2 border-r border-dashed px-2 py-5 ${voucher.unavailableReason ? "border-stone-200 bg-stone-50 text-stone-400" : "border-amber-200 bg-amber-50/70 text-amber-800"}`}
              >
                <VoucherIcon className="size-8" />
                <span className="text-center text-xs font-bold">BrewLite</span>
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-3 p-3 sm:p-4">
                <span className="min-w-0 flex-1 text-sm">
                  <span
                    className={`block text-lg font-bold leading-snug ${voucher.unavailableReason ? "text-stone-500" : "text-amber-900"}`}
                  >
                    {voucher.discountType === "PERCENT"
                      ? `Giảm ${voucher.discountValue}%`
                      : `Giảm ${formatPrice(voucher.discountValue)}`}
                  </span>
                  {voucher.maxDiscount && (
                    <span className="mt-1 block text-xs">
                      Giảm tối đa {formatPrice(voucher.maxDiscount)}
                    </span>
                  )}
                  <span className="mt-1 block text-xs leading-5">
                    {voucher.title}
                  </span>
                  <span className="mt-2 inline-block max-w-full break-all rounded border border-current/20 px-2 py-0.5 text-xs font-semibold">
                    {voucher.code}
                  </span>
                  {voucher.usage && voucher.usage.reservedUses > 0 && (
                    <span className="mt-2 block text-xs text-stone-500">
                      {voucher.usage.reservedUses} lượt đang giữ
                    </span>
                  )}
                  <span className="mt-2 block text-xs leading-5">
                    Đơn tối thiểu {formatPrice(voucher.minSubtotal)}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-stone-500">
                    Hạn dùng: {new Date(voucher.endsAt).toLocaleString("vi-VN")}
                  </span>
                  {voucher.unavailableReason && (
                    <span className="mt-2 block text-xs leading-5 text-red-700">
                      {voucher.unavailableReason}
                    </span>
                  )}
                </span>
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
                  className="size-5 shrink-0 accent-amber-800"
                />
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-stone-200 bg-white p-5 sm:px-6">
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
            onClick={() => void confirm()}
            disabled={
              check.isPending ||
              !!list.data?.vouchers.find((voucher) => voucher.code === draft)
                ?.unavailableReason
            }
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
  const { token } = useAuth();
  const applied = !!props.selectedCode && props.appliedDiscount !== undefined;
  return (
    <div className="my-4 rounded-2xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold">
          <VoucherIcon
            checked={applied}
            className="size-5 shrink-0 text-amber-800"
          />
          Voucher BrewLite
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {applied && (
            <span aria-label="Khoản giảm đã áp dụng">
              <VoucherBadge discount={props.appliedDiscount!} />
            </span>
          )}
          <button
            disabled={props.disabled}
            onClick={() => setOpen(true)}
            className="text-sm font-semibold text-amber-800 underline disabled:opacity-50"
          >
            {applied ? "Chọn voucher khác" : "Chọn hoặc nhập mã"}
          </button>
        </div>
      </div>
      {props.selectedCode && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="break-all font-semibold text-amber-900">
            {applied
              ? `Đã áp dụng ${props.selectedCode}`
              : `Mã đang chọn: ${props.selectedCode}`}
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
      {props.locked && (
        <p className="mt-2 text-xs text-stone-500">
          Mã và số tiền được giữ theo đơn đã tạo. Tiếp tục thanh toán đơn hiện
          tại.
        </p>
      )}
      {open && (
        <VoucherDialog
          key={`${token ?? "guest"}:${JSON.stringify(props.items)}`}
          {...props}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
