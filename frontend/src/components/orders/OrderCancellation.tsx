"use client";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getStoredToken } from "@/lib/auth";
import { cancelOwnOrder, requestCancellation } from "@/lib/orders/cancellation";
import { clearActiveCheckout, removeAttempt } from "@/lib/payments/storage";
import { formatDate } from "@/lib/orderUtils";
import type { Order } from "@/types/order";

export default function OrderCancellation(props: {
  order: Order;
  serverNow: number;
  disabled?: boolean;
}) {
  const { token } = useAuth();
  return token ? (
    <CancellationPanel
      key={`${token}:${props.order.id}`}
      {...props}
      token={token}
    />
  ) : null;
}

function CancellationPanel({
  order,
  serverNow,
  disabled,
  token,
}: {
  order: Order;
  serverNow: number;
  disabled?: boolean;
  token: string;
}) {
  const [form, setForm] = useState<"IMMEDIATE" | "REQUEST" | null>(null);
  const [reason, setReason] = useState("");
  const client = useQueryClient();
  const pendingRequest = order.cancelRequest?.status === "PENDING";
  const expired =
    ["PENDING", "PAYMENT_FAILED"].includes(order.status) &&
    Date.parse(order.expiresAt) <= serverNow;
  const canCancel = !expired && order.canCancelImmediately;
  const canRequest = !expired && order.canRequestCancellation;
  const action = useMutation({
    mutationFn: async (mode: "IMMEDIATE" | "REQUEST"): Promise<void> => {
      if (mode === "IMMEDIATE") await cancelOwnOrder(order.id, token);
      else await requestCancellation(order.id, reason.trim(), token);
    },
    onSuccess: (_, mode) => {
      if (getStoredToken() !== token) return;
      setForm(null);
      setReason("");
      if (mode === "IMMEDIATE") {
        clearActiveCheckout(order.id);
        removeAttempt(order.id, "WALLET");
        removeAttempt(order.id, "CARD");
      }
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["orders"] });
      void client.invalidateQueries({ queryKey: ["voucher-quote", token] });
      void client.invalidateQueries({ queryKey: ["rewards-profile", token] });
    },
  });
  if (
    !canCancel &&
    !canRequest &&
    !order.cancelRequest &&
    order.status !== "CANCELLED"
  )
    return null;
  return (
    <div
      aria-label="Hủy đơn hàng"
      className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 text-sm"
    >
      {pendingRequest && (
        <p role="status" className="font-semibold text-amber-900">
          Đang chờ nhân viên duyệt hủy. Đơn chưa bị hủy; thời hạn thanh toán vẫn
          giữ nguyên.
        </p>
      )}
      {order.cancelRequest && (
        <div className="space-y-1 break-words text-stone-600">
          <p className="mt-2">Lý do yêu cầu: {order.cancelRequest.reason}</p>
          <p className="text-xs">
            Gửi lúc {formatDate(order.cancelRequest.requestedAt)}
          </p>
          {order.cancelRequest.status === "REJECTED" && (
            <p className="text-red-800">
              Yêu cầu hủy bị từ chối: {order.cancelRequest.reviewNote}
            </p>
          )}
          {order.cancelRequest.status === "APPROVED" && (
            <p className="text-green-800">
              Yêu cầu hủy đã được chấp nhận.
              {order.cancelRequest.reviewNote &&
                ` Ghi chú: ${order.cancelRequest.reviewNote}`}
            </p>
          )}
          {order.cancelRequest.status === "EXPIRED" && (
            <p>Yêu cầu đã đóng do đơn hết hạn thanh toán.</p>
          )}
        </div>
      )}
      {order.status === "CANCELLED" ? (
        <Link
          href="/cart"
          className="mt-3 inline-block font-semibold text-amber-800 underline"
        >
          Về giỏ hàng
        </Link>
      ) : (
        <>
          {canCancel && (
            <button
              disabled={disabled || action.isPending}
              onClick={() => {
                action.reset();
                setForm("IMMEDIATE");
              }}
              className="mt-3 rounded-xl border border-red-200 px-4 py-2 font-semibold text-red-800 disabled:opacity-50"
            >
              Hủy đơn hàng
            </button>
          )}
          {canRequest && (
            <button
              disabled={disabled || action.isPending}
              onClick={() => {
                action.reset();
                setForm("REQUEST");
              }}
              className="mt-3 rounded-xl border border-amber-300 px-4 py-2 font-semibold text-amber-900 disabled:opacity-50"
            >
              Yêu cầu hủy đơn
            </button>
          )}
          {form &&
            ((form === "IMMEDIATE" && canCancel) ||
              (form === "REQUEST" && canRequest)) && (
              <form
                className="mt-3 space-y-3 rounded-xl bg-stone-50 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!action.isPending) action.mutate(form);
                }}
              >
                <p className="font-semibold">
                  {form === "IMMEDIATE"
                    ? "Xác nhận hủy đơn này?"
                    : "Gửi yêu cầu cho nhân viên"}
                </p>
                {form === "IMMEDIATE" ? (
                  <p>
                    Nếu bạn đã chuyển tiền, hãy báo chuyển tiền và gửi yêu cầu
                    hủy để nhân viên kiểm tra. Hủy đơn không tự khôi phục hoặc
                    thay đổi giỏ hàng.
                  </p>
                ) : (
                  <>
                    <p>
                      Nhân viên sẽ xem xét trước khi hủy. Hệ thống không tự hoàn
                      tiền.
                    </p>
                    <label className="block">
                      Lý do hủy
                      <textarea
                        aria-label="Lý do hủy"
                        required
                        maxLength={500}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className="mt-1 block w-full rounded-lg border border-stone-300 p-2"
                      />
                    </label>
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={
                      disabled ||
                      action.isPending ||
                      (form === "REQUEST" && !reason.trim())
                    }
                    className="rounded-lg bg-amber-800 px-4 py-2 font-semibold text-white disabled:opacity-50"
                  >
                    {action.isPending
                      ? "Đang xử lý…"
                      : form === "IMMEDIATE"
                        ? "Xác nhận hủy"
                        : "Gửi yêu cầu hủy"}
                  </button>
                  <button
                    type="button"
                    disabled={action.isPending}
                    onClick={() => setForm(null)}
                    className="rounded-lg border border-stone-300 px-4 py-2"
                  >
                    Quay lại
                  </button>
                </div>
              </form>
            )}
        </>
      )}
      {action.error && (
        <p role="alert" className="mt-3 text-red-800">
          {action.error.message}
        </p>
      )}
    </div>
  );
}
