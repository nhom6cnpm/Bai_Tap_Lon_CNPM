"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/formatPrice";
import {
  getMockBankTransfer,
  sendMockBankTransfer,
  type MockBankTransfer,
} from "@/lib/payments/mockBank";

function formatTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        day: "2-digit",
        month: "2-digit",
      });
}

/**
 * Ngân hàng giả lập: plays the role of the customer's banking app in the demo.
 * Opened by scanning the payment QR (no login needed). It can only move money
 * to the shop; whether the order is paid is decided by staff.
 */
export default function MockBankPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [transfer, setTransfer] = useState<MockBankTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    try {
      setTransfer(await getMockBankTransfer(paymentId));
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không tải được thông tin chuyển khoản.",
      );
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  async function handleTransfer() {
    if (!transfer || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError("");
    try {
      setTransfer(await sendMockBankTransfer(paymentId));
      setJustSent(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Chuyển tiền không thành công. Vui lòng thử lại.",
      );
      void load();
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  const alreadyPaid =
    transfer?.status === "TRANSFER_RECEIVED" || transfer?.status === "SUCCESS";
  const closed =
    !!transfer &&
    !alreadyPaid &&
    (transfer.status === "FAILED" ||
      transfer.orderStatus === "CANCELLED" ||
      transfer.orderStatus !== "PENDING");
  const isCard = transfer?.method === "CARD";

  return (
    <section className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <div className="overflow-hidden rounded-3xl border border-sky-200 bg-white shadow-sm">
        <header className="bg-sky-800 px-6 py-5 text-white">
          <p className="text-lg font-bold">
            🏦 {transfer?.account.bankName ?? "BrewLite Bank (giả lập)"}
          </p>
          <p className="mt-1 text-xs text-sky-100">
            Ngân hàng giả lập dùng để demo, không phải tiền thật.
          </p>
        </header>

        <div className="p-6">
          {loading ? (
            <p role="status" className="text-stone-600">
              Đang tải thông tin chuyển khoản…
            </p>
          ) : !transfer ? (
            <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
              {error || "Không tìm thấy phiên thanh toán."}
            </p>
          ) : (
            <>
              <h1 className="text-xl font-bold text-stone-900">
                {alreadyPaid ? "Chuyển tiền thành công" : "Chuyển tiền"}
              </h1>

              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-stone-500">Tài khoản nhận</dt>
                  <dd className="mt-1 font-semibold text-stone-900">
                    {transfer.account.accountName}
                  </dd>
                  <dd className="font-mono text-stone-700">
                    {transfer.account.accountNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Số tiền</dt>
                  <dd className="mt-1 text-2xl font-bold text-sky-900">
                    {formatPrice(transfer.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Nội dung chuyển khoản</dt>
                  <dd className="mt-1 break-all font-mono font-semibold text-stone-900">
                    {transfer.transferContent}
                  </dd>
                </div>
              </dl>

              {alreadyPaid ? (
                <div
                  role="status"
                  className="mt-6 rounded-2xl bg-green-50 p-4 text-green-900"
                >
                  <p className="font-semibold">
                    ✓{" "}
                    {justSent
                      ? "Đã chuyển tiền đến BrewLite."
                      : "Khoản này đã được chuyển trước đó."}
                  </p>
                  {transfer.receivedAt && (
                    <p className="mt-1 text-sm">
                      Lúc {formatTime(transfer.receivedAt)}
                    </p>
                  )}
                  <p className="mt-2 text-sm">
                    Quay lại màn hình đặt món: nhân viên sẽ đối chiếu và xác
                    nhận đơn của bạn.
                  </p>
                </div>
              ) : isCard ? (
                <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  Đơn này chọn thanh toán thẻ tại quầy, không chuyển khoản.
                </p>
              ) : closed ? (
                <p className="mt-6 rounded-2xl bg-stone-100 p-4 text-sm text-stone-700">
                  Phiên thanh toán này không còn nhận chuyển khoản (đơn đã hết
                  hạn, bị hủy hoặc đã được xử lý).
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleTransfer()}
                  disabled={sending}
                  className="mt-6 w-full rounded-xl bg-sky-800 px-4 py-3 font-bold text-white hover:bg-sky-900 disabled:opacity-50"
                >
                  {sending
                    ? "Đang chuyển…"
                    : `Chuyển tiền ${formatPrice(transfer.amount)}`}
                </button>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
                >
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
