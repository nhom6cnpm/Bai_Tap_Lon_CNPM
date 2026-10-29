import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { OrdersService, Order } from '../orders/orders.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let ordersService: OrdersService;

  const mockOrder: Order = {
    id: 'ORD-123',
    userId: 'user-1',
    status: 'PENDING',
    total: 75000,
    items: [],
    createdAt: new Date(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: OrdersService,
          useValue: {
            findById: jest.fn(async (id: string) =>
              id === mockOrder.id ? { ...mockOrder } : undefined,
            ),
            updateOrderStatus: jest.fn(async (id: string, status: any) => ({
              ...mockOrder,
              id,
              status,
            })),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PAYMENT_GATEWAY_SECRET') return 'test_secret_key';
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    ordersService = module.get<OrdersService>(OrdersService);
  });

  it('nên tạo phiên thanh toán thành công với số tiền lấy từ đơn hàng', async () => {
    const res = await service.createPayment(
      'user-1',
      { orderId: 'ORD-123', method: 'WALLET' },
      'idem-key-1',
    );
    expect(res.paymentId).toBeDefined();
    expect(res.status).toBe('PENDING');
    expect(res.gatewayUrl).toContain(res.paymentId);
  });

  it('idempotency: gọi lại cùng Idempotency-Key thì trả về đúng phiên cũ', async () => {
    const res1 = await service.createPayment(
      'user-1',
      { orderId: 'ORD-123', method: 'WALLET' },
      'idem-repeat',
    );
    const res2 = await service.createPayment(
      'user-1',
      { orderId: 'ORD-123', method: 'WALLET' },
      'idem-repeat',
    );
    expect(res1.paymentId).toEqual(res2.paymentId);
  });

  it('báo lỗi nếu thiếu Idempotency-Key', async () => {
    await expect(
      service.createPayment(
        'user-1',
        { orderId: 'ORD-123', method: 'WALLET' },
        '',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('báo lỗi nếu đơn hàng không tồn tại', async () => {
    await expect(
      service.createPayment(
        'user-1',
        { orderId: 'ORD-999', method: 'WALLET' },
        'key-999',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('báo lỗi nếu user không sở hữu đơn hàng', async () => {
    await expect(
      service.createPayment(
        'wrong-user',
        { orderId: 'ORD-123', method: 'WALLET' },
        'key-diff',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('báo lỗi nếu đơn hàng đã được thanh toán (PAID)', async () => {
    jest.spyOn(ordersService, 'findById').mockReturnValueOnce(Promise.resolve({
      ...mockOrder,
      status: 'PAID' as any,
    }) as any);
    await expect(
      service.createPayment(
        'user-1',
        { orderId: 'ORD-123', method: 'WALLET' },
        'key-paid',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('luồng thử lại: chuyển đơn PAYMENT_FAILED về PENDING trước', async () => {
    jest.spyOn(ordersService, 'findById').mockReturnValueOnce(Promise.resolve({
      ...mockOrder,
      status: 'PAYMENT_FAILED' as any,
    }) as any);
    const updateSpy = jest.spyOn(ordersService, 'updateOrderStatus');

    await service.createPayment(
      'user-1',
      { orderId: 'ORD-123', method: 'WALLET' },
      'key-retry',
    );
    expect(updateSpy).toHaveBeenCalledWith('ORD-123', 'PENDING');
  });

  it('callback: thành công (SUCCESS) cập nhật đơn thành PAID', async () => {
    const payment = await service.createPayment(
      'user-1',
      { orderId: 'ORD-123', method: 'WALLET' },
      'key-cb-success',
    );
    const signature = service.generateSignature(payment.paymentId, 'SUCCESS');
    const updateSpy = jest.spyOn(ordersService, 'updateOrderStatus');

    const cbRes = await service.processCallback({
      paymentId: payment.paymentId,
      result: 'SUCCESS',
      signature,
    });

    expect(cbRes.status).toBe('SUCCESS');
    expect(updateSpy).toHaveBeenCalledWith('ORD-123', 'PAID');
  });

  it('callback: thất bại (FAILED) cập nhật đơn thành PAYMENT_FAILED', async () => {
    const payment = await service.createPayment(
      'user-1',
      { orderId: 'ORD-123', method: 'CARD' },
      'key-cb-fail',
    );
    const signature = service.generateSignature(payment.paymentId, 'FAILED');
    const updateSpy = jest.spyOn(ordersService, 'updateOrderStatus');

    const cbRes = await service.processCallback({
      paymentId: payment.paymentId,
      result: 'FAILED',
      signature,
    });

    expect(cbRes.status).toBe('FAILED');
    expect(updateSpy).toHaveBeenCalledWith('ORD-123', 'PAYMENT_FAILED');
  });

  it('callback: sai chữ ký bị từ chối 400', async () => {
    const payment = await service.createPayment(
      'user-1',
      { orderId: 'ORD-123', method: 'CARD' },
      'key-cb-bad-sig',
    );
    await expect(
      service.processCallback({
        paymentId: payment.paymentId,
        result: 'SUCCESS',
        signature: 'invalid_signature_hex',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
