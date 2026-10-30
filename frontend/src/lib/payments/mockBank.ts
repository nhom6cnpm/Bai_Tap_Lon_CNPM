import {
  isRecord,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  readResponse,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/payments/api";

/** What the mock bank screen shows. Amount always comes from the backend. */
export interface MockBankTransfer {
  paymentId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  orderStatus: OrderStatus | null;
  expiresAt: string | null;
  receivedAt: string | null;
  transferContent: string;
  account: { bankName: string; accountNumber: string; accountName: string };
}

// Same-origin proxy (app/api/mock-bank): a phone that scanned the QR only
// needs to reach the frontend, not the backend port.
const endpoint = (paymentId: string) =>
  `/api/mock-bank/${encodeURIComponent(paymentId)}`;

function parseTransfer(data: unknown): MockBankTransfer {
  const account =
    isRecord(data) && isRecord(data.account) ? data.account : null;
  if (
    !isRecord(data) ||
    !account ||
    typeof data.paymentId !== "string" ||
    typeof data.orderId !== "string" ||
    typeof data.amount !== "number" ||
    !Number.isSafeInteger(data.amount) ||
    typeof data.transferContent !== "string" ||
    (data.method !== "WALLET" && data.method !== "CARD") ||
    !PAYMENT_STATUSES.includes(data.status as PaymentStatus) ||
    typeof account.bankName !== "string" ||
    typeof account.accountNumber !== "string" ||
    typeof account.accountName !== "string"
  ) {
    throw new Error("Phản hồi ngân hàng giả lập không đúng định dạng.");
  }
  return {
    paymentId: data.paymentId,
    orderId: data.orderId,
    amount: data.amount,
    method: data.method,
    status: data.status as PaymentStatus,
    orderStatus: ORDER_STATUSES.includes(data.orderStatus as OrderStatus)
      ? (data.orderStatus as OrderStatus)
      : null,
    expiresAt: typeof data.expiresAt === "string" ? data.expiresAt : null,
    receivedAt: typeof data.receivedAt === "string" ? data.receivedAt : null,
    transferContent: data.transferContent,
    account: {
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
    },
  };
}

export async function getMockBankTransfer(
  paymentId: string,
): Promise<MockBankTransfer> {
  const response = await fetch(endpoint(paymentId), { cache: "no-store" });
  return parseTransfer(
    await readResponse(response, "Không tải được thông tin chuyển khoản."),
  );
}

/** "Chuyển tiền": the amount is not sent, the backend uses the order total. */
export async function sendMockBankTransfer(
  paymentId: string,
): Promise<MockBankTransfer> {
  const response = await fetch(endpoint(paymentId), { method: "POST" });
  return parseTransfer(
    await readResponse(
      response,
      "Chuyển tiền không thành công. Vui lòng thử lại.",
    ),
  );
}
