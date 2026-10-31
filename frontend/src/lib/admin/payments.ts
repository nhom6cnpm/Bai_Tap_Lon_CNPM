import {
  API_URL,
  isRecord,
  parsePayment,
  readResponse,
  requireToken,
  type PaymentDetails,
  type PaymentStatus,
} from "@/lib/payments/api";

export type AdminPaymentFilter = "ACTIVE" | "ALL" | PaymentStatus;

export interface AdminPayment extends PaymentDetails {
  cancellationPending: boolean;
  customerEmail: string | null;
  itemCount: number;
  reviewedAt: string | null;
}

function headers(json = false): Record<string, string> {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${requireToken()}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

export async function listAdminPayments(
  filter: AdminPaymentFilter,
  orderId?: string,
): Promise<AdminPayment[]> {
  const params = new URLSearchParams({ status: filter });
  if (orderId?.trim()) params.set("orderId", orderId.trim());
  const response = await fetch(
    `${API_URL}/admin/payments?${params.toString()}`,
    { headers: headers(), cache: "no-store" },
  );
  const data = await readResponse(
    response,
    "Không tải được danh sách thanh toán.",
  );
  if (!Array.isArray(data))
    throw new Error("Phản hồi danh sách thanh toán không đúng định dạng.");
  return data.map((row: unknown) => {
    const record = isRecord(row) ? row : {};
    return {
      ...parsePayment(row),
      cancellationPending: record.cancellationPending === true,
      customerEmail:
        typeof record.customerEmail === "string" ? record.customerEmail : null,
      itemCount: typeof record.itemCount === "number" ? record.itemCount : 0,
      reviewedAt:
        typeof record.reviewedAt === "string" ? record.reviewedAt : null,
    };
  });
}

export async function reviewPayment(
  paymentId: string,
  decision: "confirm" | "reject",
  note?: string,
): Promise<PaymentDetails> {
  const response = await fetch(
    `${API_URL}/admin/payments/${encodeURIComponent(paymentId)}/${decision}`,
    {
      method: "POST",
      headers: headers(true),
      body: JSON.stringify(note?.trim() ? { note: note.trim() } : {}),
    },
  );
  return parsePayment(
    await readResponse(
      response,
      "Không xử lý được thanh toán. Vui lòng thử lại.",
    ),
  );
}

/** One line of the shop's statement in the mock bank. */
export interface BankTransaction {
  id: string;
  type: "IN" | "REFUND";
  amount: number;
  orderId: string;
  paymentId: string | null;
  content: string;
  createdAt: string;
}

export async function listBankTransactions(
  orderId?: string,
): Promise<BankTransaction[]> {
  const params = new URLSearchParams();
  if (orderId?.trim()) params.set("orderId", orderId.trim());
  const response = await fetch(
    `${API_URL}/admin/bank-transactions${params.size ? `?${params.toString()}` : ""}`,
    { headers: headers(), cache: "no-store" },
  );
  const data = await readResponse(response, "Không tải được sao kê.");
  if (!Array.isArray(data))
    throw new Error("Phản hồi sao kê không đúng định dạng.");
  return data.flatMap((row: unknown) => {
    if (
      !isRecord(row) ||
      typeof row.id !== "string" ||
      (row.type !== "IN" && row.type !== "REFUND") ||
      typeof row.amount !== "number" ||
      typeof row.orderId !== "string" ||
      typeof row.content !== "string" ||
      typeof row.createdAt !== "string"
    )
      return [];
    return [
      {
        id: row.id,
        type: row.type,
        amount: row.amount,
        orderId: row.orderId,
        paymentId: typeof row.paymentId === "string" ? row.paymentId : null,
        content: row.content,
        createdAt: row.createdAt,
      },
    ];
  });
}
