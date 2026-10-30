import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, FindOperator } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../orders/order.entity';
import { assertTransition, type OrderStatus } from '../orders/order-status';
import { User } from '../auth/user.entity';
import { Payment } from './entities/payment.entity';

type Row = Record<string, unknown>;

// Supports plain values and In([...]) like TypeORM's where
const matches = (row: Row, where: Row) =>
  Object.entries(where).every(([key, value]) =>
    value instanceof FindOperator
      ? (value.value as unknown[]).includes(row[key])
      : row[key] === value,
  );

// Small in-memory stand-in for a TypeORM repository
function memoryRepository<T extends { id: string }>(rows: () => T[]) {
  return {
    findOneBy: jest.fn(
      async (where: Row) =>
        rows().find((r) => matches(r as unknown as Row, where)) ?? null,
    ),
    findOne: jest.fn(
      async ({ where }: { where: Row }) =>
        rows().find((r) => matches(r as unknown as Row, where)) ?? null,
    ),
    find: jest.fn(async ({ where }: { where: Row }) =>
      rows().filter((r) => matches(r as unknown as Row, where)),
    ),
    create: jest.fn((data: Partial<T>) => ({ ...data }) as T),
    save: jest.fn(async (row: T) => {
      const list = rows();
      const index = list.findIndex((r) => r.id === row.id);
      const saved = { createdAt: new Date(), ...row };
      if (index >= 0) list[index] = saved;
      else list.push(saved);
      return saved;
    }),
  };
}

describe('PaymentsService (nhân viên xác nhận thanh toán)', () => {
  let service: PaymentsService;
  let payments: Payment[];
  let orders: Order[];

  const paymentRepository = memoryRepository<Payment>(() => payments);
  const orderRepository = memoryRepository<Order>(() => orders);
  const userRepository = memoryRepository<User>(() => [
    { id: 'user-1', email: 'khach@brewlite.vn' } as User,
  ]);

  // Real state machine: an invalid transition throws like in production
  const updateOrderStatus = jest.fn(
    async (orderId: string, status: OrderStatus) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) throw new BadRequestException('not found');
      assertTransition(order.status, status);
      order.status = status;
      return order;
    },
  );

  const manager = {
    getRepository: (entity: unknown) =>
      entity === Order ? orderRepository : paymentRepository,
  };

  const orderWith = (
    status: OrderStatus,
    userId = 'user-1',
    id = 'ORD-123',
  ): Order =>
    ({
      id,
      userId,
      status,
      total: 75000,
      items: [{ qty: 2 }],
      createdAt: new Date('2026-10-30T08:00:00Z'),
    }) as unknown as Order;

  const create = (key = 'key-1', method: 'WALLET' | 'CARD' = 'WALLET') =>
    service.createPayment('user-1', { orderId: 'ORD-123', method }, key);

  beforeEach(async () => {
    payments = [];
    orders = [orderWith('PENDING')];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepository },
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(
              async (work: (m: typeof manager) => Promise<unknown>) =>
                work(manager),
            ),
          },
        },
        { provide: OrdersService, useValue: { updateOrderStatus } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'ORDER_PAYMENT_TIMEOUT_MINUTES' ? '15' : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('POST /payments (createPayment)', () => {
    it('tạo phiên PENDING, số tiền lấy từ đơn hàng, đơn vẫn PENDING', async () => {
      const res = await create();
      expect(res.status).toBe('PENDING');
      expect(res.amount).toBe(75000);
      expect(res.orderStatus).toBe('PENDING');
      expect(res.expiresAt).toEqual(new Date('2026-10-30T08:15:00Z'));
      expect(updateOrderStatus).not.toHaveBeenCalled();
    });

    it('idempotency: cùng Idempotency-Key gửi 2 lần chỉ tạo 1 phiên', async () => {
      const first = await create('repeat');
      const second = await create('repeat');
      expect(second.paymentId).toBe(first.paymentId);
      expect(payments).toHaveLength(1);
    });

    it('mỗi đơn chỉ có 1 phiên đang chờ: key khác vẫn trả phiên cũ (đổi phương thức)', async () => {
      const first = await create('key-a', 'WALLET');
      const second = await create('key-b', 'CARD');
      expect(second.paymentId).toBe(first.paymentId);
      expect(second.method).toBe('CARD');
      expect(payments).toHaveLength(1);
    });

    it('báo lỗi khi thiếu Idempotency-Key', async () => {
      await expect(create('  ')).rejects.toThrow(BadRequestException);
    });

    it('báo lỗi khi Idempotency-Key đã dùng cho đơn khác', async () => {
      await create('shared');
      orders.push(orderWith('PENDING', 'user-1', 'ORD-999'));
      await expect(
        service.createPayment(
          'user-1',
          { orderId: 'ORD-999', method: 'WALLET' },
          'shared',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('404 khi đơn không tồn tại, 403 khi đơn của người khác', async () => {
      await expect(
        service.createPayment(
          'user-1',
          { orderId: 'ORD-404', method: 'WALLET' },
          'k',
        ),
      ).rejects.toThrow(NotFoundException);
      orders = [orderWith('PENDING', 'user-2')];
      await expect(create()).rejects.toThrow(ForbiddenException);
    });

    it.each<OrderStatus>(['PAID', 'PREPARING', 'CANCELLED'])(
      'không cho thanh toán đơn ở trạng thái %s',
      async (status) => {
        orders = [orderWith(status)];
        await expect(create()).rejects.toThrow(BadRequestException);
      },
    );

    it('thử lại sau khi bị từ chối: PAYMENT_FAILED → PENDING rồi tạo phiên mới', async () => {
      orders = [orderWith('PAYMENT_FAILED')];
      const res = await create('retry');
      expect(updateOrderStatus).toHaveBeenCalledWith(
        'ORD-123',
        'PENDING',
        manager,
      );
      expect(res.orderStatus).toBe('PENDING');
      expect(res.status).toBe('PENDING');
    });
  });

  describe('POST /payments/:id/report-paid (khách báo đã chuyển tiền)', () => {
    it('chỉ đổi phiên sang CUSTOMER_REPORTED, đơn vẫn PENDING', async () => {
      const { paymentId } = await create();
      const res = await service.reportPaid('user-1', paymentId);
      expect(res.status).toBe('CUSTOMER_REPORTED');
      expect(res.reportedAt).toBeInstanceOf(Date);
      expect(orders[0].status).toBe('PENDING');
      expect(updateOrderStatus).not.toHaveBeenCalled();
    });

    it('bấm 2 lần không lỗi', async () => {
      const { paymentId } = await create();
      await service.reportPaid('user-1', paymentId);
      const again = await service.reportPaid('user-1', paymentId);
      expect(again.status).toBe('CUSTOMER_REPORTED');
    });

    it('khách không thể tự làm đơn thành PAID', async () => {
      const { paymentId } = await create();
      await service.reportPaid('user-1', paymentId);
      expect(orders[0].status).not.toBe('PAID');
    });

    it('403 với phiên của người khác', async () => {
      const { paymentId } = await create();
      await expect(service.reportPaid('user-2', paymentId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('không báo được khi đơn đã hết hạn/hủy', async () => {
      const { paymentId } = await create();
      orders[0].status = 'CANCELLED';
      await expect(service.reportPaid('user-1', paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('không báo được khi nhân viên đã xử lý', async () => {
      const { paymentId } = await create();
      await service.review('admin-1', paymentId, 'REJECT');
      await expect(service.reportPaid('user-1', paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Admin xác nhận / từ chối (review)', () => {
    it('xác nhận: phiên SUCCESS, đơn PENDING → PAID, lưu người duyệt', async () => {
      const { paymentId } = await create();
      await service.reportPaid('user-1', paymentId);
      const res = await service.review('admin-1', paymentId, 'CONFIRM');
      expect(res.status).toBe('SUCCESS');
      expect(res.orderStatus).toBe('PAID');
      expect(updateOrderStatus).toHaveBeenCalledWith(
        'ORD-123',
        'PAID',
        manager,
      );
      expect(payments[0].reviewedBy).toBe('admin-1');
    });

    it('xác nhận được cả phiên PENDING (khách trả bằng Thẻ tại quầy)', async () => {
      const { paymentId } = await create('card', 'CARD');
      const res = await service.review('admin-1', paymentId, 'CONFIRM');
      expect(res.orderStatus).toBe('PAID');
    });

    it('từ chối: phiên FAILED, đơn PENDING → PAYMENT_FAILED, có lý do', async () => {
      const { paymentId } = await create();
      await service.reportPaid('user-1', paymentId);
      const res = await service.review(
        'admin-1',
        paymentId,
        'REJECT',
        'Chưa nhận được tiền',
      );
      expect(res.status).toBe('FAILED');
      expect(res.orderStatus).toBe('PAYMENT_FAILED');
      expect(res.reviewNote).toBe('Chưa nhận được tiền');
    });

    it('không xử lý lại phiên đã duyệt (bấm 2 lần / 2 nhân viên)', async () => {
      const { paymentId } = await create();
      await service.review('admin-1', paymentId, 'CONFIRM');
      await expect(
        service.review('admin-2', paymentId, 'REJECT'),
      ).rejects.toThrow(BadRequestException);
      expect(orders[0].status).toBe('PAID');
    });

    it('state machine chặn xác nhận đơn đã bị hủy (CANCELLED → PAID)', async () => {
      const { paymentId } = await create();
      orders[0].status = 'CANCELLED';
      await expect(
        service.review('admin-1', paymentId, 'CONFIRM'),
      ).rejects.toThrow('Không thể chuyển đơn hàng từ CANCELLED sang PAID');
    });

    it('404 khi phiên không tồn tại', async () => {
      await expect(
        service.review('admin-1', 'PAY-404', 'CONFIRM'),
      ).rejects.toThrow(NotFoundException);
    });

    it('luồng đầy đủ: từ chối → khách thử lại → báo lại → xác nhận', async () => {
      const first = await create('k1');
      await service.reportPaid('user-1', first.paymentId);
      await service.review('admin-1', first.paymentId, 'REJECT');
      expect(orders[0].status).toBe('PAYMENT_FAILED');

      const second = await create('k2');
      expect(second.paymentId).not.toBe(first.paymentId);
      expect(orders[0].status).toBe('PENDING');

      await service.reportPaid('user-1', second.paymentId);
      await service.review('admin-1', second.paymentId, 'CONFIRM');
      expect(orders[0].status).toBe('PAID');
    });
  });

  describe('GET /admin/payments (listForAdmin)', () => {
    it('mặc định chỉ lấy phiên đang chờ, khách đã báo chuyển tiền lên đầu', async () => {
      orders.push(orderWith('PENDING', 'user-1', 'ORD-2'));
      orders.push(orderWith('PENDING', 'user-1', 'ORD-3'));
      const a = await create('a');
      const b = await service.createPayment(
        'user-1',
        { orderId: 'ORD-2', method: 'WALLET' },
        'b',
      );
      const c = await service.createPayment(
        'user-1',
        { orderId: 'ORD-3', method: 'CARD' },
        'c',
      );
      await service.reportPaid('user-1', b.paymentId);
      await service.review('admin-1', c.paymentId, 'CONFIRM');

      const rows = await service.listForAdmin({});
      expect(rows.map((r) => r.paymentId)).toEqual([b.paymentId, a.paymentId]);
      expect(rows[0].customerEmail).toBe('khach@brewlite.vn');
      expect(rows[0].itemCount).toBe(2);
    });

    it('lọc theo mã đơn (quét QR của khách)', async () => {
      const a = await create();
      const rows = await service.listForAdmin({ orderId: ' ORD-123 ' });
      expect(rows.map((r) => r.paymentId)).toEqual([a.paymentId]);
    });
  });

  describe('GET /payments/:id', () => {
    it('trả trạng thái phiên và trạng thái đơn cho chủ đơn', async () => {
      const { paymentId } = await create();
      const res = await service.getPaymentById(paymentId, 'user-1');
      expect(res.status).toBe('PENDING');
      expect(res.orderStatus).toBe('PENDING');
    });

    it('403 với người khác, 404 khi không có', async () => {
      const { paymentId } = await create();
      await expect(service.getPaymentById(paymentId, 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getPaymentById('PAY-404', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
