import type { NextRequest } from "next/server";

// Server-side address of the backend (inside Docker: http://backend:3001)
const BACKEND_URL = (
  process.env.API_INTERNAL_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  "http://localhost:3001"
).replace(/\/+$/, "");

const PAYMENT_ID = /^[A-Za-z0-9-]{1,64}$/;

async function forward(path: string, init?: RequestInit): Promise<Response> {
  try {
    const upstream = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { message: "Ngân hàng giả lập tạm thời không kết nối được máy chủ." },
      { status: 502 },
    );
  }
}

/** Proxy for the mock bank page, so a phone only needs the frontend address. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await params;
  if (!PAYMENT_ID.test(paymentId))
    return Response.json(
      { message: "Mã thanh toán không hợp lệ." },
      { status: 400 },
    );
  return forward(`/mock-bank/payments/${encodeURIComponent(paymentId)}`);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await params;
  if (!PAYMENT_ID.test(paymentId))
    return Response.json(
      { message: "Mã thanh toán không hợp lệ." },
      { status: 400 },
    );
  return forward(
    `/mock-bank/payments/${encodeURIComponent(paymentId)}/transfer`,
    { method: "POST" },
  );
}
