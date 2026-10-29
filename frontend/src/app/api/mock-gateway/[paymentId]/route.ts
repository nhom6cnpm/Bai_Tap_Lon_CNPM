import { NextRequest, NextResponse } from 'next/server';

const backendUrl = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

async function forward(request: NextRequest, paymentId: string, method: 'GET' | 'POST') {
  try {
    const response = await fetch(`${backendUrl}/mock-gateway/${encodeURIComponent(paymentId)}${method === 'POST' ? '/confirm' : ''}`, {
      method,
      headers: { Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      body: method === 'POST' ? await request.text() : undefined,
      cache: 'no-store',
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
    });
  } catch {
    return NextResponse.json({ message: 'Cổng thanh toán chưa kết nối được backend.' }, { status: 502 });
  }
}

export async function GET(request: NextRequest, context: RouteContext<'/api/mock-gateway/[paymentId]'>) {
  const { paymentId } = await context.params;
  return forward(request, paymentId, 'GET');
}

export async function POST(request: NextRequest, context: RouteContext<'/api/mock-gateway/[paymentId]'>) {
  const { paymentId } = await context.params;
  return forward(request, paymentId, 'POST');
}
