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
import { PaymentRequestKey } from './entities/payment-request-key.entity';
import {
  BankLedgerService,
  type LedgerPayment,
} from '../mock-bank/bank-ledger.service';

interface LedgerRow {
  type: 'IN' | 'REFUND';
  amount: number;
  orderId: string;
  paymentId: string | null;
  content: string;
}

type Row = Record<string, unknown>;

// Supports plain values and In([...]) like TypeORM's where
const matches = (row: Row, where: Row) =>
  Object.entries(where).every(([key, value]) =>
    value instanceof FindOperator
      ? value.type === 'moreThan'
        ? (row[key] as Date) > value.value
        : (value.value as unknown[]).includes(row[key])
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

describe('PaymentsService (ngân hàng giả lập + nhân viên xác nhận)', () => {
  let service: PaymentsService;
  let payments: Payment[];
  let orders: Order[];
  let requestKeys: PaymentRequestKey[];
  let ledgerRows: LedgerRow[];

  // In-memory sao kê of the mock bank
  const balance = (orderId: string) =>
    ledgerRows
      .filter((row) => row.orderId === orderId)
      .reduce(
        (sum, row) => sum + (row.type === 'IN' ? row.amount : -row.amount),
        0,
      );
  const ledger = {
    balanceForOrder: jest.fn(async (orderId: string) => balance(orderId)),
    hasReceived: jest.fn(async (paymentId: string) =>
      ledgerRows.some(
        (row) => row.paymentId === paymentId && row.type === 'IN',
      ),
    ),
    recordIncoming: jest.fn(
      async (payment: LedgerPayment, _manager: unknown, content: string) => {
        ledgerRows.push({
          type: 'IN',
          amount: payment.amount,
          orderId: payment.orderId,
          paymentId: payment.id,
          content,
        });
      },
    ),
    refundOrder: jest.fn(
      async (
        orderId: string,
        _manager: unknown,
        reason: string,
        _now: Date,
        paymentId: string | null = null,
      ) => {
        const amount = balance(orderId);
        if (amount <= 0) return 0;
        ledgerRows.push({
          type: 'REFUND',
          amount,
          orderId,
          paymentId,
          content: reason,
        });
        return amount;
      },
    ),
  };

  const paymentRepository = memoryRepository<Payment>(() => payments);
  const orderRepository = memoryRepository<Order>(() => orders);
  const keyRepository = memoryRepository<PaymentRequestKey>(() => requestKeys);
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
      entity === Order
        ? orderRepository
        : entity === PaymentRequestKey
          ? keyRepository
          : paymentRepository,
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
      createdAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    }) as unknown as Order;

  const create = (key = 'key-1', method: 'WALLET' | 'CARD' = 'WALLET') =>
    service.createPayment('user-1', { orderId: 'ORD-123', method }, key);

  beforeEach(async () => {
    payments = [];
    orders = [orderWith('PENDING')];
    requestKeys = [];
    ledgerRows = [];
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
            getRepository: manager.getRepository,
            transaction: jest.fn(
              async (work: (m: typeof manager) => Promise<unknown>) =>
                work(manager),
            ),
          },
        },
        {
          provide: OrdersService,
          useValue: {
            updateOrderStatus,
            expireIfNeeded: async () => false,
            ensureInventoryReservation: async () => undefined,
            databaseNow: async () => new Date(),
          },
        },
        { provide: BankLedgerService, useValue: ledger },
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
      const originalDeadline = new Date(orders[0].expiresAt);
      const res = await create();
      expect(res.status).toBe('PENDING');
      expect(res.amount).toBe(75000);
      expect(res.orderStatus).toBe('PENDING');
      expect(res.expiresAt).toEqual(originalDeadline);
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

  describe('Ngân hàng giả lập (receiveTransfer)', () => {
    it('chuyển tiền: tiền vào sao kê đúng tổng đơn, phiên TRANSFER_RECEIVED, đơn vẫn PENDING', async () => {
      const { paymentId } = await create();
      const res = await service.receiveTransfer(paymentId);
      expect(res.status).toBe('TRANSFER_RECEIVED');
      expect(res.receivedAt).toBeInstanceOf(Date);
      expect(orders[0].status).toBe('PENDING');
      expect(updateOrderStatus).not.toHaveBeenCalled();
      expect(ledgerRows).toEqual([
        expect.objectContaining({
          type: 'IN',
          amount: 75000,
          orderId: 'ORD-123',
          paymentId,
          content: 'ORD-123',
        }),
      ]);
    });

    it('bấm "Chuyển tiền" 2 lần chỉ ghi nhận tiền 1 lần', async () => {
      const { paymentId } = await create();
      await service.receiveTransfer(paymentId);
      const again = await service.receiveTransfer(paymentId);
      expect(again.status).toBe('TRANSFER_RECEIVED');
      expect(ledgerRows).toHaveLength(1);
    });

    it('chuyển tiền không làm đơn thành PAID: chỉ nhân viên mới xác nhận', async () => {
      const { paymentId } = await create();
      await service.receiveTransfer(paymentId);
      expect(orders[0].status).toBe('PENDING');
      expect(payments[0].status).not.toBe('SUCCESS');
    });

    it('thẻ thanh toán tại quầy, không chuyển khoản được', async () => {
      const { paymentId } = await create('card', 'CARD');
      await expect(service.receiveTransfer(paymentId)).rejects.toThrow(
        BadRequestException,
      );
      expect(ledgerRows).toHaveLength(0);
    });

    it('không chuyển được khi đơn đã hết hạn/hủy', async () => {
      const { paymentId } = await create();
      orders[0].status = 'CANCELLED';
      await expect(service.receiveTransfer(paymentId)).rejects.toThrow(
        BadRequestException,
      );
      expect(ledgerRows).toHaveLength(0);
    });

    it('không chuyển được khi nhân viên đã xử lý phiên', async () => {
      const { paymentId } = await create();
      await service.review('admin-1', paymentId, 'REJECT');
      await expect(service.receiveTransfer(paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('màn hình ngân hàng: số tiền và nội dung lấy từ phiên thanh toán', async () => {
      const { paymentId } = await create();
      const info = await service.getTransferInfo(paymentId);
      expect(info).toMatchObject({
        amount: 75000,
        transferContent: 'ORD-123',
        status: 'PENDING',
        orderStatus: 'PENDING',
      });
      expect(info.account.accountName).toBeTruthy();
      await expect(service.getTransferInfo('PAY-404')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Admin xác nhận / từ chối (review)', () => {
    it('xác nhận: phiên SUCCESS, đơn PENDING → PAID, lưu người duyệt', async () => {
      const { paymentId } = await create();
      await service.receiveTransfer(paymentId);
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
      await service.receiveTransfer(paymentId);
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
      ).resolves.toMatchObject({ status: 'SUCCESS', orderStatus: 'PAID' });
      expect(payments[0].reviewedBy).toBe('admin-1');
      expect(orders[0].status).toBe('PAID');
    });

    it('state machine chặn xác nhận đơn đã bị hủy (CANCELLED → PAID)', async () => {
      const { paymentId } = await create();
      orders[0].status = 'CANCELLED';
      await expect(
        service.review('admin-1', paymentId, 'CONFIRM'),
      ).rejects.toThrow('Đơn đã hết hạn hoặc bị hủy');
    });

    it('404 khi phiên không tồn tại', async () => {
      await expect(
        service.review('admin-1', 'PAY-404', 'CONFIRM'),
      ).rejects.toThrow(NotFoundException);
    });

    it('luồng đầy đủ: từ chối (hoàn tiền) → khách thử lại → chuyển lại → xác nhận', async () => {
      const first = await create('k1');
      await service.receiveTransfer(first.paymentId);
      await service.review('admin-1', first.paymentId, 'REJECT');
      expect(orders[0].status).toBe('PAYMENT_FAILED');

      const second = await create('k2');
      expect(second.paymentId).not.toBe(first.paymentId);
      expect(orders[0].status).toBe('PENDING');

      await service.receiveTransfer(second.paymentId);
      await service.review('admin-1', second.paymentId, 'CONFIRM');
      expect(orders[0].status).toBe('PAID');
      // 75k in, 75k refunded, 75k in again: the shop holds exactly one payment
      expect(ledgerRows.map((row) => row.type)).toEqual(['IN', 'REFUND', 'IN']);
      expect(balance('ORD-123')).toBe(75000);
    });

    it('xác nhận sau khi tiền đã về: không ghi tiền vào lần nữa', async () => {
      const { paymentId } = await create();
      await service.receiveTransfer(paymentId);
      await service.review('admin-1', paymentId, 'CONFIRM');
      expect(ledgerRows.filter((row) => row.type === 'IN')).toHaveLength(1);
      expect(balance('ORD-123')).toBe(75000);
    });

    it('xác nhận thẻ tại quầy: ghi tiền vào sao kê để hủy sau này hoàn được', async () => {
      const { paymentId } = await create('card', 'CARD');
      await service.review('admin-1', paymentId, 'CONFIRM');
      expect(ledgerRows).toEqual([
        expect.objectContaining({
          type: 'IN',
          amount: 75000,
          content: 'Quẹt thẻ tại quầy ORD-123',
        }),
      ]);
    });

    it('từ chối sau khi tiền đã về: hoàn đủ số tiền đã nhận', async () => {
      const { paymentId } = await create();
      await service.receiveTransfer(paymentId);
      await service.review('admin-1', paymentId, 'REJECT', 'Sai thông tin');
      expect(ledgerRows.at(-1)).toMatchObject({
        type: 'REFUND',
        amount: 75000,
      });
      expect(balance('ORD-123')).toBe(0);
    });

    it('từ chối khi chưa có tiền: không có gì để hoàn', async () => {
      const { paymentId } = await create();
      await service.review('admin-1', paymentId, 'REJECT');
      expect(ledgerRows).toHaveLength(0);
    });
  });

  describe('GET /admin/payments (listForAdmin)', () => {
    it('mặc định chỉ lấy phiên đang chờ, phiên đã có tiền về lên đầu', async () => {
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
      await service.receiveTransfer(b.paymentId);
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
