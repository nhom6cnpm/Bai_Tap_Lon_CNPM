import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/order.entity';
import { Payment } from './entities/payment.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let payments: Payment[];

  const orderWith = (status: string) =>
    ({
      id: 'ORD-123',
      userId: 'user-1',
      status,
      total: 75000,
      items: [],
      createdAt: new Date(),
    }) as unknown as Order;

  // Standalone mocks (no unbound-method references in assertions)
  const findById = jest.fn(async (id: string) =>
    id === 'ORD-123' ? orderWith('PENDING') : null,
  );
  const updateOrderStatus = jest.fn(async (id: string, status: string) => ({
    id,
    status,
  }));

  // In-memory stand-in for the payments table
  const matches = (p: Payment, where: Partial<Payment>) =>
    Object.entries(where).every(
      ([key, value]) => p[key as keyof Payment] === value,
    );
  const paymentRepository = {
    findOneBy: jest.fn(
      async (where: Partial<Payment>) =>
        payments.find((p) => matches(p, where)) ?? null,
    ),
    findOne: jest.fn(
      async ({ where }: { where: Partial<Payment> }) =>
        payments.find((p) => matches(p, where)) ?? null,
    ),
    create: jest.fn((data: Partial<Payment>) => ({ ...data }) as Payment),
    save: jest.fn(async (payment: Payment) => {
      const index = payments.findIndex((p) => p.id === payment.id);
      if (index >= 0) payments[index] = payment;
      else payments.push(payment);
      return payment;
    }),
  };
  const manager = {
    getRepository: () => paymentRepository,
    save: paymentRepository.save,
  };

  beforeEach(async () => {
    payments = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepository },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(
              async (work: (m: typeof manager) => Promise<unknown>) =>
                work(manager),
            ),
          },
        },
        {
          provide: OrdersService,
          useValue: { findById, updateOrderStatus },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PAYMENT_GATEWAY_SECRET') return 'test_secret_key';
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
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
    expect(payments[0].amount).toBe(75000);
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
    expect(payments).toHaveLength(1);
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
    findById.mockResolvedValueOnce(orderWith('PAID'));
    await expect(
      service.createPayment(
        'user-1',
        { orderId: 'ORD-123', method: 'WALLET' },
        'key-paid',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('luồng thử lại: chuyển đơn PAYMENT_FAILED về PENDING trước (trong transaction)', async () => {
    findById.mockResolvedValueOnce(orderWith('PAYMENT_FAILED'));

    await service.createPayment(
      'user-1',
      { orderId: 'ORD-123', method: 'WALLET' },
      'key-retry',
    );
    expect(updateOrderStatus).toHaveBeenCalledWith(
      'ORD-123',
      'PENDING',
      manager,
    );
  });

  it('callback: thành công (SUCCESS) cập nhật đơn thành PAID', async () => {
    const payment = await service.createPayment(
      'user-1',
      { orderId: 'ORD-123', method: 'WALLET' },
      'key-cb-success',
    );
    const signature = service.generateSignature(payment.paymentId, 'SUCCESS');

    const cbRes = await service.processCallback({
      paymentId: payment.paymentId,
      result: 'SUCCESS',
      signature,
    });

    expect(cbRes.status).toBe('SUCCESS');
    expect(updateOrderStatus).toHaveBeenCalledWith('ORD-123', 'PAID', manager);
  });

  it('callback: thất bại (FAILED) cập nhật đơn thành PAYMENT_FAILED', async () => {
    const payment = await service.createPayment(
      'user-1',
      { orderId: 'ORD-123', method: 'CARD' },
      'key-cb-fail',
    );
    const signature = service.generateSignature(payment.paymentId, 'FAILED');

    const cbRes = await service.processCallback({
      paymentId: payment.paymentId,
      result: 'FAILED',
      signature,
    });

    expect(cbRes.status).toBe('FAILED');
    expect(updateOrderStatus).toHaveBeenCalledWith(
      'ORD-123',
      'PAYMENT_FAILED',
      manager,
    );
  });

  it('callback: gửi lặp không xử lý lại lần 2', async () => {
    const payment = await service.createPayment(
      'user-1',
      { orderId: 'ORD-123', method: 'WALLET' },
      'key-cb-twice',
    );
    const signature = service.generateSignature(payment.paymentId, 'SUCCESS');
    const callback = {
      paymentId: payment.paymentId,
      result: 'SUCCESS' as const,
      signature,
    };

    await service.processCallback(callback);
    const second = await service.processCallback(callback);

    expect(second.message).toBe('Callback đã được xử lý trước đó');
    expect(updateOrderStatus).toHaveBeenCalledTimes(1);
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

  it('thiếu PAYMENT_GATEWAY_SECRET thì báo lỗi khi khởi động', () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    expect(
      () =>
        new PaymentsService(
          paymentRepository as never,
          { findById, updateOrderStatus } as unknown as OrdersService,
          config,
          {} as DataSource,
        ),
    ).toThrow('PAYMENT_GATEWAY_SECRET is required');
  });
});
