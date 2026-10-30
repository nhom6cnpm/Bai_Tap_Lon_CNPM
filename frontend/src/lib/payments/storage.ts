import type { PaymentMethod } from './api';
import { getCheckoutDeadlineMs } from './timeout';

export interface CheckoutSnapshot {
  orderId: string;
  total: number;
  createdAt: string;
  expiresAt?: string | null;
  cartFingerprint: string;
}

export interface PaymentAttempt {
  orderId: string;
  method: PaymentMethod;
  idempotencyKey: string;
  paymentId?: string;
}

const checkoutKey = (orderId: string) => `brewlite-checkout:${orderId}`;
const activeCheckoutKey = 'brewlite-active-checkout';
const attemptKey = (orderId: string, method: PaymentMethod) => `brewlite-payment-attempt:${orderId}:${method}`;

function readStored<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: unknown): void {
  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
}

export function saveCheckout(snapshot: CheckoutSnapshot): void {
  writeStored(checkoutKey(snapshot.orderId), snapshot);
  writeStored(activeCheckoutKey, snapshot);
}

export function getCheckout(orderId: string): CheckoutSnapshot | null {
  const snapshot = readStored<CheckoutSnapshot>(checkoutKey(orderId));
  return snapshot?.orderId === orderId && Number.isFinite(snapshot.total) &&
    Number.isFinite(Date.parse(snapshot.createdAt)) ? snapshot : null;
}

export function getActiveCheckout(cartFingerprint: string): CheckoutSnapshot | null {
  const snapshot = readStored<CheckoutSnapshot>(activeCheckoutKey);
  if (!snapshot || snapshot.cartFingerprint !== cartFingerprint) return null;
  const saved = getCheckout(snapshot.orderId);
  return saved && getCheckoutDeadlineMs(saved) > Date.now() ? saved : null;
}

export function clearActiveCheckout(orderId: string): void {
  const active = readStored<CheckoutSnapshot>(activeCheckoutKey);
  if (active?.orderId === orderId && typeof window !== 'undefined') localStorage.removeItem(activeCheckoutKey);
}

export function getAttempt(orderId: string, method: PaymentMethod): PaymentAttempt | null {
  const attempt = readStored<PaymentAttempt>(attemptKey(orderId, method));
  return attempt?.orderId === orderId && attempt.method === method &&
    typeof attempt.idempotencyKey === 'string' ? attempt : null;
}

export function saveAttempt(attempt: PaymentAttempt): void {
  writeStored(attemptKey(attempt.orderId, attempt.method), attempt);
}

export function removeAttempt(orderId: string, method: PaymentMethod): void {
  if (typeof window !== 'undefined') localStorage.removeItem(attemptKey(orderId, method));
}
