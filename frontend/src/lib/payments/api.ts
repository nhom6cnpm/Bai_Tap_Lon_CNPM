import { getStoredToken } from '@/lib/auth';

export type PaymentMethod = 'WALLET' | 'CARD';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type GatewayResult = 'SUCCESS' | 'FAILED';

export interface CreatedPayment {
  paymentId: string;
  gatewayUrl: string;
}

export interface PaymentDetails {
  paymentId: string;
  orderId: string;
  status: PaymentStatus;
  amount: number;
  method?: PaymentMethod;
}

export interface GatewayDetails {
  paymentId: string;
  orderId: string;
  status: PaymentStatus;
  amount: number;
  method: PaymentMethod;
}

export class PaymentApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'PaymentApiError';
  }
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3001').replace(/\/+$/, '');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorMessage(data: unknown, fallback: string): string {
  if (!isRecord(data)) return fallback;
  const message = data.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) return message.filter((part): part is string => typeof part === 'string').join(', ') || fallback;
  return fallback;
}

async function readResponse(response: Response, fallback: string): Promise<unknown> {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new PaymentApiError(readErrorMessage(data, fallback), response.status);
  return data;
}

function requireToken(): string {
  const token = getStoredToken();
  if (!token) throw new PaymentApiError('Vui lòng đăng nhập để thanh toán.', 401);
  return token;
}

function isStatus(value: unknown): value is PaymentStatus {
  return value === 'PENDING' || value === 'SUCCESS' || value === 'FAILED';
}

function isMethod(value: unknown): value is PaymentMethod {
  return value === 'WALLET' || value === 'CARD';
}

export async function createPayment(orderId: string, method: PaymentMethod, idempotencyKey: string): Promise<CreatedPayment> {
  const response = await fetch(`${API_URL}/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${requireToken()}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ orderId, method }),
  });
  const data = await readResponse(response, 'Không tạo được phiên thanh toán. Vui lòng thử lại.');
  if (!isRecord(data) || typeof data.paymentId !== 'string' || typeof data.gatewayUrl !== 'string') {
    throw new Error('Phản hồi tạo thanh toán không đúng định dạng.');
  }
  return { paymentId: data.paymentId, gatewayUrl: data.gatewayUrl };
}

export async function getPayment(paymentId: string): Promise<PaymentDetails> {
  const response = await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${requireToken()}` },
    cache: 'no-store',
  });
  const data = await readResponse(response, 'Không kiểm tra được trạng thái thanh toán.');
  if (!isRecord(data) || typeof data.paymentId !== 'string' || typeof data.orderId !== 'string' ||
    typeof data.amount !== 'number' || !isStatus(data.status)) {
    throw new Error('Phản hồi trạng thái thanh toán không đúng định dạng.');
  }
  return {
    paymentId: data.paymentId,
    orderId: data.orderId,
    amount: data.amount,
    status: data.status,
    method: isMethod(data.method) ? data.method : undefined,
  };
}

// The public gateway is proxied through Next.js so a phone only needs access to the frontend URL.
export async function getGatewayDetails(paymentId: string): Promise<GatewayDetails> {
  const response = await fetch(`/api/mock-gateway/${encodeURIComponent(paymentId)}`, { cache: 'no-store' });
  const data = await readResponse(response, 'Không tải được phiên thanh toán.');
  if (!isRecord(data) || typeof data.paymentId !== 'string' || typeof data.orderId !== 'string' ||
    typeof data.amount !== 'number' || !isMethod(data.method) || !isStatus(data.status)) {
    throw new Error('Phản hồi cổng thanh toán không đúng định dạng.');
  }
  return { paymentId: data.paymentId, orderId: data.orderId, amount: data.amount, method: data.method, status: data.status };
}

export async function confirmGatewayPayment(paymentId: string, result: GatewayResult): Promise<void> {
  const response = await fetch(`/api/mock-gateway/${encodeURIComponent(paymentId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ result }),
  });
  await readResponse(response, 'Cổng thanh toán chưa xử lý được yêu cầu.');
}
