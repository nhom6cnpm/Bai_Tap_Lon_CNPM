import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/auth/user.entity';
import { Ingredient } from '../src/inventory/ingredient.entity';
import { RecipeItem } from '../src/inventory/recipe-item.entity';
import { ToppingRecipe } from '../src/inventory/topping-recipe.entity';
import { InitialSchema1761580800000 } from '../src/migrations/1761580800000-InitialSchema';
import { AddInventory1761650000000 } from '../src/migrations/1761650000000-AddInventory';
import { AddPayments1761750000000 } from '../src/migrations/1761750000000-AddPayments';
import { OrderInventoryReservations1761830000000 } from '../src/migrations/1761830000000-OrderInventoryReservations';
import { OrderItemDisplaySnapshot1761840000000 } from '../src/migrations/1761840000000-OrderItemDisplaySnapshot';
import { OrderExpiryService } from '../src/orders/order-expiry.service';
import { OrderInventoryReservation } from '../src/orders/order-inventory-reservation.entity';
import { OrderItem } from '../src/orders/order-item.entity';
import { Order } from '../src/orders/order.entity';
import { OrdersService } from '../src/orders/orders.service';
import { PaymentRequestKey } from '../src/payments/entities/payment-request-key.entity';
import { AdminPaymentConfirmation1761850000000 } from '../src/migrations/1761850000000-AdminPaymentConfirmation';
import { OrderPaymentTimeoutDefault1761860000000 } from '../src/migrations/1761860000000-OrderPaymentTimeoutDefault';
import { PaymentRequestKeys1761870000000 } from '../src/migrations/1761870000000-PaymentRequestKeys';
import { Payment } from '../src/payments/entities/payment.entity';
import { PaymentsService } from '../src/payments/payments.service';
import { Product } from '../src/products/product.entity';
import { Voucher } from '../src/vouchers/voucher.entity';
import { BenefitsFoundation1761880000000 } from '../src/migrations/1761880000000-BenefitsFoundation';
import { VoucherUsage } from '../src/vouchers/voucher-usage.entity';
import { VoucherUserQuota } from '../src/vouchers/voucher-user-quota.entity';
import { AddVouchers1761850000000 } from '../src/migrations/1761850000000-AddVouchers';
import { MockBankLedger1761890000000 } from '../src/migrations/1761890000000-MockBankLedger';
import { BankTransaction } from '../src/mock-bank/bank-transaction.entity';
import { OrderRequestKeys1761900000000 } from '../src/migrations/1761900000000-OrderRequestKeys';
import { SeedSampleVouchers1761910000000 } from '../src/migrations/1761910000000-SeedSampleVouchers';
import { OrderRequestKey } from '../src/orders/order-request-key.entity';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase(
  'Task 9 / Task 10 with real PostgreSQL (dedicated _test database)',
  () => {
    let database: DataSource;
    let app: INestApplication;
    let orders: OrdersService;
    let payments: PaymentsService;
    let userId: string;
    let token: string;
    let adminId: string;
    let adminToken: string;
    const item = (
      overrides: Partial<{
        productId: string;
        size: 'S' | 'M' | 'L';
        toppingIds: ('cream' | 'pearls')[];
        qty: number;
      }> = {},
    ) => ({
      productId: '1',
      size: 'S' as const,
      toppingIds: [] as ('cream' | 'pearls')[],
      qty: 1,
      ...overrides,
    });
    const create = (items = [item()]) => orders.createOrder(userId, { items });
    const stock = (id = 'coffee') =>
      database.getRepository(Ingredient).findOneByOrFail({ id });
    const getOrder = (id: string) =>
      database.getRepository(Order).findOneByOrFail({ id });
    const expire = (id: string) =>
      database.query(
        `UPDATE orders SET "expiresAt" = clock_timestamp() - INTERVAL '1 second' WHERE id = $1`,
        [id],
      );
    // Sao kê of the mock bank for one order, oldest first
    const statement = (orderId: string) =>
      database.getRepository(BankTransaction).find({
        where: { orderId },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
    const staffReview = (
      paymentId: string,
      result: 'SUCCESS' | 'FAILED' = 'SUCCESS',
    ) =>
      payments.review(
        adminId,
        paymentId,
        result === 'SUCCESS' ? 'CONFIRM' : 'REJECT',
      );

    const undoThrough = async (name: string) => {
      for (;;) {
        const [last] = await database.query(
          'SELECT name FROM migrations ORDER BY id DESC LIMIT 1',
        );
        if (!last) throw new Error(`Migration not found: ${name}`);
        await database.undoLastMigration();
        if (last.name === name) break;
      }
    };

    beforeAll(async () => {
      const url = new URL(databaseUrl!);
      if (!url.pathname.endsWith('_test')) {
        throw new Error(
          'TEST_DATABASE_URL must point to a dedicated database ending in _test',
        );
      }
      database = new DataSource({
        type: 'postgres',
        url: databaseUrl,
        entities: [
          Product,
          User,
          Order,
          OrderItem,
          Ingredient,
          RecipeItem,
          ToppingRecipe,
          Payment,
          PaymentRequestKey,
          OrderInventoryReservation,
          Voucher,
          VoucherUsage,
          VoucherUserQuota,
          BankTransaction,
          OrderRequestKey,
        ],
        migrations: [
          InitialSchema1761580800000,
          AddInventory1761650000000,
          AddPayments1761750000000,
          OrderInventoryReservations1761830000000,
          OrderItemDisplaySnapshot1761840000000,
          AddVouchers1761850000000,
          AdminPaymentConfirmation1761850000000,
          OrderPaymentTimeoutDefault1761860000000,
          PaymentRequestKeys1761870000000,
          BenefitsFoundation1761880000000,
          MockBankLedger1761890000000,
          OrderRequestKeys1761900000000,
          SeedSampleVouchers1761910000000,
        ],
        synchronize: false,
        logging: false,
      });
      await database.initialize();
      await database.runMigrations();
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(DataSource)
        .useValue(database)
        .overrideProvider(OrderExpiryService)
        .useValue({})
        .overrideProvider(ConfigService)
        .useValue(
          new ConfigService({
            JWT_SECRET: 'task10-database-test-jwt',
            ORDER_PAYMENT_TIMEOUT_MINUTES: '15',
            FRONTEND_URL: 'http://localhost:3000',
          }),
        )
        .compile();
      app = module.createNestApplication();
      app.useGlobalPipes(new ValidationPipe());
      app.useLogger(false);
      // Bind once so concurrent Supertest requests share one listening server.
      await app.listen(0, '127.0.0.1');
      orders = app.get(OrdersService);
      payments = app.get(PaymentsService);
    }, 30000);

    beforeEach(async () => {
      // The URL guard above is mandatory: this suite owns all rows in its test DB.
      await database.query(
        'TRUNCATE order_request_keys, bank_transactions, vouchers, order_ingredient_reservations, order_items, payments, orders, users CASCADE',
      );
      await database.query(
        'UPDATE ingredients SET quantity = 1000, version = 1',
      );
      await database.query(
        `UPDATE recipe_items SET amount = 20 WHERE "productId" = '1' AND "ingredientId" = 'coffee'`,
      );
      const user = await database.getRepository(User).save({
        email: `${randomUUID()}@task10.test`,
        passwordHash: 'not-used-for-login',
        loyaltyPoints: 0,
      });
      userId = user.id;
      token = app
        .get(JwtService)
        .sign({ sub: user.id, email: user.email, role: 'CUSTOMER' });
      const admin = await database.getRepository(User).save({
        email: `${randomUUID()}@staff.test`,
        passwordHash: 'not-used-for-login',
        loyaltyPoints: 0,
        role: 'ADMIN',
      });
      adminId = admin.id;
      adminToken = app
        .get(JwtService)
        .sign({ sub: admin.id, email: admin.email, role: 'ADMIN' });
    });

    afterAll(async () => {
      if (app) await app.close();
      if (database?.isInitialized) await database.destroy();
    });

    it('deducts size/topping quantities, stores their snapshot and returns a fifteen-minute deadline', async () => {
      const created = await create([
        item({ size: 'L', toppingIds: ['cream'], qty: 2 }),
      ]);
      expect((await stock()).quantity).toBe(940);
      expect((await stock('condensed-milk')).quantity).toBe(910);
      expect((await stock('cream')).quantity).toBe(960);
      expect((await stock()).version).toBe(2);
      expect(created.expiresAt.getTime() - created.createdAt.getTime()).toBe(
        900000,
      );
      expect(
        await database
          .getRepository(OrderInventoryReservation)
          .findBy({ orderId: created.orderId }),
      ).toHaveLength(3);
    });

    it('rolls back every deduction, order, item and snapshot if a later ingredient is insufficient', async () => {
      await database.query(
        `UPDATE ingredients SET quantity = 0 WHERE id = 'condensed-milk'`,
      );
      await expect(create()).rejects.toThrow('không đủ nguyên liệu');
      expect((await stock()).quantity).toBe(1000);
      expect((await stock()).version).toBe(1);
      for (const entity of [Order, OrderItem, OrderInventoryReservation]) {
        expect(await database.getRepository(entity).count()).toBe(0);
      }
    });

    it('aggregates ingredients shared by different items before checking stock', async () => {
      await database.query(
        `UPDATE ingredients SET quantity = 30 WHERE id = 'coffee'`,
      );
      await expect(create([item(), item({ productId: '2' })])).rejects.toThrow(
        'không đủ nguyên liệu',
      );
      expect((await stock()).quantity).toBe(30);
      expect(await database.getRepository(Order).count()).toBe(0);
    });

    it('never oversells the last cup when 20 customers order at once', async () => {
      await database.query(
        `UPDATE ingredients SET quantity = 20 WHERE id = 'coffee'`,
      );
      const outcomes = await Promise.allSettled(
        Array.from({ length: 20 }, () => create()),
      );
      expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await stock()).quantity).toBe(0);
      expect((await stock()).version).toBe(2);
      expect(await database.getRepository(Order).count()).toBe(1);
      expect(await database.getRepository(OrderItem).count()).toBe(1);
    }, 30000);

    it('generates distinct order IDs and commits concurrent orders when stock is sufficient', async () => {
      const results = await Promise.all(
        Array.from({ length: 12 }, () => create()),
      );
      expect(new Set(results.map((r) => r.orderId)).size).toBe(12);
      expect((await stock()).quantity).toBe(760);
      expect((await stock()).version).toBe(13);
    }, 30000);

    it('returns the original snapshot exactly once even after recipes change and cancellation repeats', async () => {
      const created = await create([item({ qty: 2 })]);
      await database.query(
        `UPDATE recipe_items SET amount = 99 WHERE "productId" = '1' AND "ingredientId" = 'coffee'`,
      );
      await Promise.all(
        Array.from({ length: 8 }, () =>
          orders.cancelOrder(userId, created.orderId),
        ),
      );
      expect((await stock()).quantity).toBe(1000);
      expect((await stock()).version).toBe(3);
      expect((await getOrder(created.orderId)).cancelReason).toBe(
        'USER_CANCELLED',
      );
      expect(
        await database.getRepository(OrderInventoryReservation).count(),
      ).toBe(2);
    });

    it('preserves concurrent reservations while another order returns ingredients', async () => {
      const first = await create();
      const [, second] = await Promise.all([
        orders.cancelOrder(userId, first.orderId),
        create(),
      ]);
      expect((await stock()).quantity).toBe(980);
      expect((await getOrder(second.orderId)).status).toBe('PENDING');
      expect((await stock()).version).toBe(4);
    });

    it('failure holds stock; retry keeps the deadline; PAID never deducts twice', async () => {
      const created = await create();
      const first = await payments.createPayment(
        userId,
        { orderId: created.orderId, method: 'WALLET' },
        randomUUID(),
      );
      await staffReview(first.paymentId, 'FAILED');
      expect((await getOrder(created.orderId)).status).toBe('PAYMENT_FAILED');
      expect((await stock()).quantity).toBe(980);
      const second = await payments.createPayment(
        userId,
        { orderId: created.orderId, method: 'CARD' },
        randomUUID(),
      );
      expect((await getOrder(created.orderId)).status).toBe('PENDING');
      expect((await getOrder(created.orderId)).expiresAt.getTime()).toBe(
        created.expiresAt.getTime(),
      );
      await staffReview(second.paymentId);
      expect((await getOrder(created.orderId)).status).toBe('PAID');
      expect((await stock()).quantity).toBe(980);
      expect((await stock()).version).toBe(2);
    });

    it('expires PENDING and PAYMENT_FAILED orders and refunds each once across concurrent scans', async () => {
      const first = await create();
      const second = await create();
      await orders.updateOrderStatus(second.orderId, 'PAYMENT_FAILED');
      await expire(first.orderId);
      await expire(second.orderId);
      await Promise.all([
        orders.expireUnpaidOrders(),
        orders.expireUnpaidOrders(),
        orders.expireUnpaidOrders(),
      ]);
      expect((await stock()).quantity).toBe(1000);
      for (const id of [first.orderId, second.orderId]) {
        expect(await getOrder(id)).toMatchObject({
          status: 'CANCELLED',
          cancelReason: 'PAYMENT_TIMEOUT',
        });
      }
      const version = (await stock()).version;
      expect(await orders.expireUnpaidOrders()).toBe(0);
      expect((await stock()).version).toBe(version);
    });

    it('commits timeout/refund before rejecting a new payment or retry', async () => {
      const created = await create();
      await orders.updateOrderStatus(created.orderId, 'PAYMENT_FAILED');
      await expire(created.orderId);
      await expect(
        payments.createPayment(
          userId,
          { orderId: created.orderId, method: 'WALLET' },
          randomUUID(),
        ),
      ).rejects.toThrow('Đơn đã hết hạn');
      expect((await getOrder(created.orderId)).status).toBe('CANCELLED');
      expect((await stock()).quantity).toBe(1000);
      expect(await database.getRepository(Payment).count()).toBe(0);
    });

    it('rejects a late SUCCESS staff decision while committing the refund', async () => {
      const created = await create();
      const payment = await payments.createPayment(
        userId,
        { orderId: created.orderId, method: 'WALLET' },
        randomUUID(),
      );
      await expire(created.orderId);
      await expect(staffReview(payment.paymentId)).rejects.toThrow(
        'Đơn đã hết hạn',
      );
      expect((await getOrder(created.orderId)).status).toBe('CANCELLED');
      expect((await stock()).quantity).toBe(1000);
      expect(
        (
          await database
            .getRepository(Payment)
            .findOneByOrFail({ id: payment.paymentId })
        ).status,
      ).toBe('FAILED');
    });

    it('serializes a staff decision racing with expiry so a cancelled order cannot become PAID', async () => {
      const created = await create();
      const payment = await payments.createPayment(
        userId,
        { orderId: created.orderId, method: 'CARD' },
        randomUUID(),
      );
      await expire(created.orderId);
      await Promise.allSettled([
        staffReview(payment.paymentId),
        orders.expireUnpaidOrders(),
        orders.expireUnpaidOrders(),
      ]);
      expect((await getOrder(created.orderId)).status).toBe('CANCELLED');
      expect((await stock()).quantity).toBe(1000);
      expect((await stock()).version).toBe(3);
    });

    it('never expires PAID orders even when a later scan sees a past deadline', async () => {
      const created = await create();
      const payment = await payments.createPayment(
        userId,
        { orderId: created.orderId, method: 'CARD' },
        randomUUID(),
      );
      await staffReview(payment.paymentId);
      await expire(created.orderId);
      expect(await orders.expireUnpaidOrders()).toBe(0);
      expect((await getOrder(created.orderId)).status).toBe('PAID');
      expect((await stock()).quantity).toBe(980);
    });

    it('checks the deadline after obtaining the lock, even if the staff decision arrived before expiry', async () => {
      const created = await create();
      const payment = await payments.createPayment(
        userId,
        { orderId: created.orderId, method: 'CARD' },
        randomUUID(),
      );
      const blocker = database.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      try {
        await blocker.query(
          `UPDATE orders SET "expiresAt" = clock_timestamp() + INTERVAL '200 milliseconds' WHERE id = $1`,
          [created.orderId],
        );
        const result = staffReview(payment.paymentId).then(
          () => 'paid',
          () => 'rejected',
        );
        await blocker.query('SELECT pg_sleep(0.3)');
        await blocker.commitTransaction();
        expect(await result).toBe('rejected');
        expect((await getOrder(created.orderId)).status).toBe('CANCELLED');
        expect((await stock()).quantity).toBe(1000);
      } finally {
        if (blocker.isTransactionActive) await blocker.rollbackTransaction();
        await blocker.release();
      }
    });

    it('does not run duplicate successful staff decisions or deduct stock a second time', async () => {
      const created = await create();
      const payment = await payments.createPayment(
        userId,
        { orderId: created.orderId, method: 'CARD' },
        randomUUID(),
      );
      const results = await Promise.all(
        Array.from({ length: 8 }, () => staffReview(payment.paymentId)),
      );
      expect(results.every((result) => result.status === 'SUCCESS')).toBe(true);
      expect((await stock()).quantity).toBe(980);
      expect((await stock()).version).toBe(2);
      expect((await getOrder(created.orderId)).status).toBe('PAID');
    });

    it('keeps internal PAID cancellation in the state machine and returns stock once', async () => {
      const created = await create();
      await orders.updateOrderStatus(created.orderId, 'PAID');
      await orders.updateOrderStatus(created.orderId, 'CANCELLED');
      await orders.updateOrderStatus(created.orderId, 'CANCELLED');
      expect((await stock()).quantity).toBe(1000);
      expect((await stock()).version).toBe(3);
    });

    it('rejects cancellation after PREPARING without refunding ingredients', async () => {
      const created = await create();
      await orders.updateOrderStatus(created.orderId, 'PAID');
      await orders.updateOrderStatus(created.orderId, 'PREPARING');
      await expect(orders.cancelOrder(userId, created.orderId)).rejects.toThrow(
        'Không thể chuyển',
      );
      expect((await stock()).quantity).toBe(980);
    });

    it('supports an expiry worker restarting and automatically scanning past deadlines', async () => {
      const created = await create();
      const worker = new OrderExpiryService(orders);
      const scan = jest.spyOn(orders, 'expireUnpaidOrders');
      worker.onApplicationBootstrap();
      try {
        await scan.mock.results[0].value;
        await expire(created.orderId);
        const until = Date.now() + 7000;
        while (
          (await getOrder(created.orderId)).status !== 'CANCELLED' &&
          Date.now() < until
        ) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        expect((await getOrder(created.orderId)).status).toBe('CANCELLED');
        expect((await stock()).quantity).toBe(1000);
        expect(scan.mock.calls.length).toBeGreaterThanOrEqual(2);
      } finally {
        await worker.onModuleDestroy();
        scan.mockRestore();
      }
    }, 10000);

    it('preserves legacy rows through down/up migration and never refunds stock that was not deducted', async () => {
      await undoThrough('OrderInventoryReservations1761830000000');
      await database.query(
        `INSERT INTO orders (id, "userId", status, total, "createdAt")
      VALUES ('LEGACY-EXPIRED', $1, 'PENDING', 35000, CURRENT_TIMESTAMP - INTERVAL '10 minutes')`,
        [userId],
      );
      await database.runMigrations();
      expect((await getOrder('LEGACY-EXPIRED')).inventoryReservedAt).toBeNull();
      await orders.expireUnpaidOrders();
      expect((await getOrder('LEGACY-EXPIRED')).status).toBe('CANCELLED');
      expect((await stock()).quantity).toBe(1000);
      expect((await stock()).version).toBe(1);
      expect(await database.getRepository(User).count()).toBe(2);
    });

    it('reserves a still-valid legacy order on payment without extending its original deadline', async () => {
      await database.query(
        `INSERT INTO orders (id, "userId", status, subtotal, total)
      VALUES ('LEGACY-VALID', $1, 'PAYMENT_FAILED', 35000, 35000)`,
        [userId],
      );
      await database.query(`INSERT INTO order_items (id, "orderId", "productId", size, "toppingIds", qty, "unitPrice", "lineTotal")
      VALUES ('legacy-item', 'LEGACY-VALID', '1', 'S', '[]', 1, 35000, 35000)`);
      const original = await getOrder('LEGACY-VALID');
      const payment = await payments.createPayment(
        userId,
        { orderId: original.id, method: 'CARD' },
        randomUUID(),
      );
      expect((await stock()).quantity).toBe(980);
      expect((await getOrder(original.id)).expiresAt.getTime()).toBe(
        original.expiresAt.getTime(),
      );
      await staffReview(payment.paymentId);
      expect((await stock()).quantity).toBe(980);
    });

    it('rejects missing recipes instead of creating an unreserved order', async () => {
      await database.getRepository(Product).save({
        id: 'no-recipe',
        name: 'No recipe',
        price: 1000,
        imageUrl: '/images/coffee.jpg',
      });
      try {
        await expect(
          create([item({ productId: 'no-recipe' })]),
        ).rejects.toThrow('chưa có công thức');
        expect(await database.getRepository(Order).count()).toBe(0);
      } finally {
        await database.getRepository(Product).delete({ id: 'no-recipe' });
      }
    });

    it('keeps optimistic stock updates atomic under an injected database failure', async () => {
      await database.query(`CREATE FUNCTION task10_fail_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'task10 forced snapshot failure'; END $$`);
      await database.query(`CREATE TRIGGER task10_fail_reservation BEFORE INSERT ON order_ingredient_reservations
      FOR EACH ROW EXECUTE FUNCTION task10_fail_reservation()`);
      try {
        await expect(create()).rejects.toThrow(
          'task10 forced snapshot failure',
        );
        expect((await stock()).quantity).toBe(1000);
        expect((await stock()).version).toBe(1);
        expect(await database.getRepository(Order).count()).toBe(0);
      } finally {
        await database.query(
          'DROP TRIGGER task10_fail_reservation ON order_ingredient_reservations',
        );
        await database.query('DROP FUNCTION task10_fail_reservation()');
      }
    });

    describe('Task 9 own-order history and details', () => {
      const history = () =>
        request(app.getHttpServer())
          .get('/orders/me')
          .set('Authorization', `Bearer ${token}`);
      const detail = (id: string) =>
        request(app.getHttpServer())
          .get(`/orders/${id}`)
          .set('Authorization', `Bearer ${token}`);

      it('requires JWT for both read endpoints', async () => {
        await request(app.getHttpServer()).get('/orders/me').expect(401);
        await request(app.getHttpServer()).get('/orders/unknown').expect(401);
      });

      it('returns an empty array for a user without orders and disables shared caching', async () => {
        const response = await history().expect(200);
        expect(response.body).toEqual([]);
        expect(response.headers['cache-control']).toBe('private, no-store');
      });

      it('returns only own orders with newest first and deterministic ordering for ties', async () => {
        const first = await create();
        const second = await create();
        const other = await database
          .getRepository(User)
          .save({ email: 'other@history.test', passwordHash: 'unused' });
        await orders.createOrder(other.id, { items: [item()] });
        const sameTime = new Date();
        await database
          .getRepository(Order)
          .update({ id: first.orderId }, { createdAt: sameTime });
        await database
          .getRepository(Order)
          .update({ id: second.orderId }, { createdAt: sameTime });
        const response = await history().expect(200);
        expect(response.body.map((entry: { id: string }) => entry.id)).toEqual(
          [first.orderId, second.orderId].sort().reverse(),
        );
        const entry = response.body[0];
        expect(entry.items[0].name).toBe('Cà phê sữa');
        expect(entry).not.toHaveProperty('userId');
        expect(entry).not.toHaveProperty('inventoryReservedAt');
        expect(entry).not.toHaveProperty('gatewaySecret');
      });

      it('returns the correct detail with stored prices, items, deadline and backend clock', async () => {
        const created = await create([
          item({ size: 'M', toppingIds: ['cream'], qty: 2 }),
        ]);
        const response = await detail(created.orderId).expect(200);
        expect(response.body.id).toBe(created.orderId);
        expect(response.body.total).toBe(90000);
        expect(response.body.items[0]).toMatchObject({
          name: 'Cà phê sữa',
          size: 'M',
          qty: 2,
          unitPrice: 45000,
          lineTotal: 90000,
          toppingIds: ['cream'],
        });
        expect(
          Date.parse(response.body.expiresAt) -
            Date.parse(response.body.createdAt),
        ).toBe(900000);
        expect(Number.isFinite(Date.parse(response.body.serverTime))).toBe(
          true,
        );
        expect(response.body.canPay).toBe(true);
      });

      it('does not reveal whether an inaccessible order belongs to another account', async () => {
        const other = await database
          .getRepository(User)
          .save({ email: 'private@history.test', passwordHash: 'unused' });
        const hidden = await orders.createOrder(other.id, { items: [item()] });
        const foreign = await detail(hidden.orderId).expect(404);
        const missing = await detail('ORD-missing').expect(404);
        expect(foreign.body.message).toBe(missing.body.message);
      });

      it('rejects expired tokens', async () => {
        const expiredToken = app
          .get(JwtService)
          .sign(
            { sub: userId, email: 'expired@history.test' },
            { expiresIn: -1 },
          );
        await request(app.getHttpServer())
          .get('/orders/me')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);
      });

      it('rejects a deleted account even when its old JWT signature is valid', async () => {
        await database.getRepository(User).delete({ id: userId });
        await history().expect(401);
      });

      it('rejects malformed subjects without sending invalid UUIDs to PostgreSQL', async () => {
        const malformed = app
          .get(JwtService)
          .sign({ sub: 'invalid-subject', email: 'bad@history.test' });
        await request(app.getHttpServer())
          .get('/orders/me')
          .set('Authorization', `Bearer ${malformed}`)
          .expect(401);
      });

      it('keeps the purchased name, image and price when the menu changes', async () => {
        const created = await create();
        await database.getRepository(Product).update(
          { id: '1' },
          {
            name: 'Renamed drink',
            price: 999999,
            imageUrl: '/images/americano.jpg',
          },
        );
        try {
          const response = await detail(created.orderId).expect(200);
          expect(response.body.items[0]).toMatchObject({
            name: 'Cà phê sữa',
            imageUrl: '/images/coffee.jpg',
            unitPrice: 35000,
            lineTotal: 35000,
          });
          expect(response.body.total).toBe(35000);
        } finally {
          await database.getRepository(Product).update(
            { id: '1' },
            {
              name: 'Cà phê sữa',
              price: 35000,
              imageUrl: '/images/coffee.jpg',
            },
          );
        }
      });

      it('includes all seven statuses and only permits payment for live unpaid orders', async () => {
        const statuses = [
          'PENDING',
          'PAYMENT_FAILED',
          'PAID',
          'PREPARING',
          'READY',
          'COMPLETED',
          'CANCELLED',
        ] as const;
        for (const status of statuses) {
          const created = await create();
          await database
            .getRepository(Order)
            .update({ id: created.orderId }, { status });
        }
        const response = await history().expect(200);
        expect(response.body).toHaveLength(7);
        for (const entry of response.body as {
          status: string;
          canPay: boolean;
        }[]) {
          expect(entry.canPay).toBe(
            ['PENDING', 'PAYMENT_FAILED'].includes(entry.status),
          );
        }
      });

      it('hides the pay action at the exact expiry even before the background worker scans', async () => {
        const created = await create();
        await expire(created.orderId);
        const response = await detail(created.orderId).expect(200);
        expect(response.body.status).toBe('PENDING');
        expect(response.body.canPay).toBe(false);
      });

      it('exposes timeout cancellation reasons and the real successful payment method', async () => {
        const unpaid = await create();
        await expire(unpaid.orderId);
        await orders.expireUnpaidOrders();
        const cancelled = await detail(unpaid.orderId).expect(200);
        expect(cancelled.body).toMatchObject({
          status: 'CANCELLED',
          cancelReason: 'PAYMENT_TIMEOUT',
          canPay: false,
        });
        expect(cancelled.body.cancelledAt).toBeDefined();
        const paid = await create();
        const payment = await payments.createPayment(
          userId,
          { orderId: paid.orderId, method: 'WALLET' },
          randomUUID(),
        );
        await staffReview(payment.paymentId);
        const response = await detail(paid.orderId).expect(200);
        expect(response.body).toMatchObject({
          status: 'PAID',
          paymentMethod: 'WALLET',
          canPay: false,
        });
        const paymentResponse = await request(app.getHttpServer())
          .get(`/payments/${payment.paymentId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(paymentResponse.body.expiresAt).toBe(response.body.expiresAt);
        expect(paymentResponse.body.orderStatus).toBe('PAID');
      });

      it('backfills legacy item display fields without recalculating historical money', async () => {
        await undoThrough('OrderItemDisplaySnapshot1761840000000');
        await database.query(
          `INSERT INTO orders (id, "userId", status, total) VALUES ('LEGACY-HISTORY', $1, 'COMPLETED', 12345)`,
          [userId],
        );
        await database.query(`INSERT INTO order_items (id, "orderId", "productId", size, "toppingIds", qty, "unitPrice", "lineTotal")
          VALUES ('legacy-history-item', 'LEGACY-HISTORY', '1', 'S', '[]', 1, 12345, 12345)`);
        await database.runMigrations();
        const response = await detail('LEGACY-HISTORY').expect(200);
        expect(response.body.items[0]).toMatchObject({
          name: 'Cà phê sữa',
          imageUrl: '/images/coffee.jpg',
          unitPrice: 12345,
        });
        expect(response.body.total).toBe(12345);
      });
    });

    describe('voucher selection, pricing and immutable payment totals', () => {
      const voucher = (overrides: Partial<Voucher> = {}) =>
        database.getRepository(Voucher).save({
          code: 'TEST10K',
          title: 'Test database only',
          discountType: 'FIXED',
          discountValue: 10000,
          minSubtotal: 0,
          maxDiscount: null,
          startsAt: new Date(Date.now() - 60000),
          endsAt: new Date(Date.now() + 3600000),
          isActive: true,
          isPublic: true,
          ...overrides,
        });
      const quote = (
        voucherCode?: unknown,
        extra: Record<string, unknown> = {},
      ) =>
        request(app.getHttpServer())
          .post('/vouchers/quote')
          .send({
            items: [item()],
            ...(voucherCode === undefined ? {} : { voucherCode }),
            ...extra,
          });
      const orderWithVoucher = (voucherCode: string) =>
        request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', randomUUID())
          .send({ items: [item()], voucherCode, total: 1, discount: 999999 });

      it('shows an empty list without seeding arbitrary business promotions', async () => {
        const response = await quote().expect(200);
        expect(response.headers['cache-control']).toBe('private, no-store');
        expect(response.body).toMatchObject({
          subtotal: 35000,
          discount: 0,
          total: 35000,
          voucherCode: null,
          vouchers: [],
        });
        expect(await database.getRepository(Order).count()).toBe(0);
      });

      it('quotes server prices and normalizes entered codes without reserving inventory', async () => {
        await voucher();
        const response = await quote(' test10k ', {
          subtotal: 1,
          discount: 34999,
          total: 1,
        }).expect(200);
        expect(response.body).toMatchObject({
          subtotal: 35000,
          discount: 10000,
          total: 25000,
          voucherCode: 'TEST10K',
        });
        expect(response.body.vouchers[0]).toMatchObject({
          code: 'TEST10K',
          unavailableReason: null,
        });
        expect((await stock()).quantity).toBe(1000);
        expect((await stock()).version).toBe(1);
        expect(await database.getRepository(Order).count()).toBe(0);
      });

      it('uses size/topping quantities and recalculates the minimum after a cart change', async () => {
        await voucher({ minSubtotal: 60000 });
        const one = await quote().expect(200);
        expect(one.body.vouchers[0].unavailableReason).toContain('tối thiểu');
        await quote('TEST10K').expect(400);
        const two = await quote('TEST10K', {
          items: [item({ size: 'L', toppingIds: ['cream'], qty: 2 })],
        }).expect(200);
        expect(two.body).toMatchObject({
          subtotal: 100000,
          discount: 10000,
          total: 90000,
        });
      });

      it('supports capped percentages with whole-dong rounding and caps fixed discounts at the subtotal', async () => {
        await voucher({
          discountType: 'PERCENT',
          discountValue: 15,
          maxDiscount: 5000,
        });
        expect((await quote('TEST10K').expect(200)).body.total).toBe(30000);
        await voucher({ discountValue: 999999 });
        expect((await quote('TEST10K').expect(200)).body).toMatchObject({
          total: 0,
          discount: 35000,
        });
      });

      it('allows entering an active private code without disclosing it in the public list', async () => {
        await voucher({ isPublic: false });
        expect((await quote().expect(200)).body.vouchers).toEqual([]);
        expect((await quote('TEST10K').expect(200)).body.total).toBe(25000);
      });

      it('rounds fractional percentage discounts down to whole dong', async () => {
        await voucher({ discountType: 'PERCENT', discountValue: 10 });
        await database.getRepository(Product).update('1', { price: 35001 });
        try {
          expect((await quote('TEST10K').expect(200)).body).toMatchObject({
            subtotal: 35001,
            discount: 3500,
            total: 31501,
          });
        } finally {
          await database.getRepository(Product).update('1', { price: 35000 });
        }
      });

      it('rechecks expiry after waiting for a voucher row lock and rolls stock back', async () => {
        await voucher();
        const runner = database.createQueryRunner();
        await runner.connect();
        await runner.startTransaction();
        await runner.query(
          `UPDATE vouchers SET "endsAt" = clock_timestamp() + interval '200 milliseconds' WHERE code = 'TEST10K'`,
        );
        const pending = orders.createOrder(userId, {
          items: [item()],
          voucherCode: 'TEST10K',
        });
        // Attach a rejection handler immediately; the row lock below controls completion.
        const outcome = pending.then(
          () => null,
          (error: unknown) => error,
        );
        try {
          const deadline = Date.now() + 3000;
          let didWait = false;
          while (Date.now() < deadline) {
            const [waiting] = await database.query<Array<{ count: number }>>(
              `SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%vouchers%'`,
            );
            if (waiting.count) {
              didWait = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          await runner.query('SELECT pg_sleep(0.25)');
          await runner.commitTransaction();
          expect(didWait).toBe(true);
          expect(await outcome).toBeInstanceOf(Error);
          expect((await stock()).quantity).toBe(1000);
          expect(await database.getRepository(Order).count()).toBe(0);
        } finally {
          if (runner.isTransactionActive) await runner.rollbackTransaction();
          await runner.release();
          await outcome;
        }
      });

      it.each([
        { code: 'UNKNOWN' },
        { isActive: false },
        { startsAt: new Date(Date.now() + 60000) },
        { endsAt: new Date(Date.now() - 1000) },
        { minSubtotal: 35001 },
      ])(
        'rejects an unavailable code and rolls back the order and stock: %j',
        async (overrides) => {
          await voucher(overrides);
          await orderWithVoucher('TEST10K').expect(400);
          expect(await database.getRepository(Order).count()).toBe(0);
          expect((await stock()).quantity).toBe(1000);
          expect((await stock()).version).toBe(1);
        },
      );

      it.each([123, {}, [], 'bad code', 'X'.repeat(33)])(
        'validates malformed voucher input %j',
        async (code) => {
          await quote(code).expect(400);
        },
      );

      it('rejects invalid quote items instead of accepting a client subtotal', async () => {
        await quote(undefined, { items: [item({ qty: 0 })] }).expect(400);
        await quote(undefined, { items: [] }).expect(400);
        await quote(undefined, {
          items: [item({ productId: 'unknown' })],
        }).expect(400);
      });

      it('revalidates a previously quoted code when the order is created', async () => {
        await voucher();
        await quote('TEST10K').expect(200);
        await database
          .getRepository(Voucher)
          .update('TEST10K', { isActive: false });
        await orderWithVoucher('TEST10K').expect(400);
        expect(await database.getRepository(Order).count()).toBe(0);
        expect((await stock()).version).toBe(1);
      });

      it('snapshots the discount and pays the original amount even if the voucher changes or is archived', async () => {
        await voucher();
        const created = await orderWithVoucher('TEST10K').expect(201);
        expect(created.body).toMatchObject({
          subtotal: 35000,
          discount: 10000,
          total: 25000,
          voucherCode: 'TEST10K',
        });
        await expect(
          database.getRepository(Voucher).delete('TEST10K'),
        ).rejects.toMatchObject({ driverError: { code: '23503' } });
        await database.getRepository(Voucher).update('TEST10K', {
          isActive: false,
          discountValue: 1000,
          title: 'Archived campaign',
        });
        const session = await payments.createPayment(
          userId,
          { orderId: created.body.orderId, method: 'WALLET' },
          randomUUID(),
        );
        expect(
          (await payments.getPaymentById(session.paymentId, userId)).amount,
        ).toBe(25000);
        await Promise.all([
          staffReview(session.paymentId),
          staffReview(session.paymentId),
        ]);
        const history = await request(app.getHttpServer())
          .get(`/orders/${created.body.orderId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(history.body).toMatchObject({
          status: 'PAID',
          subtotal: 35000,
          discount: 10000,
          total: 25000,
          voucherCode: 'TEST10K',
        });
        expect((await stock()).quantity).toBe(980);
        expect(await database.getRepository(Payment).count()).toBe(1);
      });

      it('retries a failed payment on the discounted order without extending its deadline', async () => {
        await voucher();
        const created = await orderWithVoucher('TEST10K').expect(201);
        const first = await payments.createPayment(
          userId,
          { orderId: created.body.orderId, method: 'CARD' },
          randomUUID(),
        );
        await staffReview(first.paymentId, 'FAILED');
        await database
          .getRepository(Voucher)
          .update('TEST10K', { isActive: false });
        const retry = await payments.createPayment(
          userId,
          { orderId: created.body.orderId, method: 'WALLET' },
          randomUUID(),
        );
        expect(
          (await payments.getPaymentById(retry.paymentId, userId)).amount,
        ).toBe(25000);
        expect(
          (await getOrder(created.body.orderId)).expiresAt.toISOString(),
        ).toBe(created.body.expiresAt);
        await staffReview(retry.paymentId);
        expect((await stock()).quantity).toBe(980);
      });

      it('keeps the discounted snapshot through expiry and refunds ingredients once', async () => {
        await voucher();
        const created = await orderWithVoucher('TEST10K').expect(201);
        await expire(created.body.orderId);
        await orders.expireUnpaidOrders();
        await orders.cancelOrder(userId, created.body.orderId);
        expect(await getOrder(created.body.orderId)).toMatchObject({
          status: 'CANCELLED',
          total: 25000,
          discount: 10000,
        });
        expect((await stock()).quantity).toBe(1000);
        expect((await stock()).version).toBe(3);
      });

      it('backfills existing order totals through the voucher migration and only seeds the documented sample codes', async () => {
        const created = await create();
        await database
          .getRepository(Order)
          .update(created.orderId, { benefitsPolicyVersion: 0 });
        await undoThrough('AddVouchers1761850000000');
        await database.runMigrations();
        expect(await getOrder(created.orderId)).toMatchObject({
          subtotal: 35000,
          discount: 0,
          total: 35000,
          voucherCode: null,
        });
        // SeedSampleVouchers: exactly the four samples listed in the README
        const seeded = await database
          .getRepository(Voucher)
          .find({ order: { code: 'ASC' } });
        expect(seeded.map((voucher) => voucher.code)).toEqual([
          'BREW10',
          'NHAP7K',
          'NHOM15K',
          'THU5K',
        ]);
        expect(
          seeded.find((voucher) => voucher.code === 'NHAP7K')?.isPublic,
        ).toBe(false);
      });
    });

    describe('Task 10d payment idempotency', () => {
      const checkout = (orderId: string, key: string, method = 'WALLET') =>
        request(app.getHttpServer())
          .post('/payments')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', key)
          .send({ orderId, method });
      const staffDecision = (paymentId: string, result: 'SUCCESS' | 'FAILED') =>
        request(app.getHttpServer())
          .post(
            `/admin/payments/${paymentId}/${result === 'SUCCESS' ? 'confirm' : 'reject'}`,
          )
          .set('Authorization', `Bearer ${adminToken}`)
          .send({});

      it('creates exactly one payment for twelve simultaneous HTTP requests with the same key', async () => {
        const created = await create();
        const key = randomUUID();
        const responses = await Promise.all(
          Array.from({ length: 12 }, () => checkout(created.orderId, key)),
        );
        expect(responses.map((response) => response.status)).toEqual(
          Array(12).fill(201),
        );
        expect(
          new Set(responses.map((response) => response.body.paymentId)).size,
        ).toBe(1);
        expect(await database.getRepository(Payment).count()).toBe(1);
        expect((await stock()).quantity).toBe(980);
        expect((await stock()).version).toBe(2);
        expect((await getOrder(created.orderId)).expiresAt.getTime()).toBe(
          created.expiresAt.getTime(),
        );
      });

      it.each([
        'PAID',
        'PREPARING',
        'READY',
        'COMPLETED',
        'CANCELLED',
      ] as const)(
        'replays the original payment after the order reaches %s without repeating business effects',
        async (status) => {
          const created = await create();
          const key = randomUUID();
          const first = await checkout(created.orderId, key).expect(201);
          await staffDecision(first.body.paymentId, 'SUCCESS').expect(200);
          if (status === 'CANCELLED')
            await orders.updateOrderStatus(created.orderId, 'CANCELLED');
          else {
            for (const next of ['PREPARING', 'READY', 'COMPLETED'] as const) {
              if (status === 'PAID') break;
              await orders.updateOrderStatus(created.orderId, next);
              if (next === status) break;
            }
          }
          const before = await stock();
          const replay = await checkout(created.orderId, key).expect(201);
          expect(replay.body).toMatchObject({
            paymentId: first.body.paymentId,
            status: 'SUCCESS',
          });
          expect(await database.getRepository(Payment).count()).toBe(1);
          expect((await getOrder(created.orderId)).status).toBe(status);
          expect((await getOrder(created.orderId)).expiresAt.getTime()).toBe(
            created.expiresAt.getTime(),
          );
          expect(await stock()).toMatchObject({
            quantity: before.quantity,
            version: before.version,
          });
          await checkout(created.orderId, randomUUID()).expect(400);
        },
      );

      it('replays a failed attempt unchanged; only a new key starts a new attempt on the same order', async () => {
        const created = await create();
        const key = randomUUID();
        const first = await checkout(created.orderId, key).expect(201);
        await staffDecision(first.body.paymentId, 'FAILED').expect(200);
        const replay = await checkout(created.orderId, key).expect(201);
        expect(replay.body).toMatchObject({
          paymentId: first.body.paymentId,
          status: 'FAILED',
        });
        expect((await getOrder(created.orderId)).status).toBe('PAYMENT_FAILED');
        const retried = await checkout(
          created.orderId,
          randomUUID(),
          'CARD',
        ).expect(201);
        expect(retried.body.paymentId).not.toBe(first.body.paymentId);
        expect((await getOrder(created.orderId)).status).toBe('PENDING');
        expect((await getOrder(created.orderId)).expiresAt.getTime()).toBe(
          created.expiresAt.getTime(),
        );
        expect((await stock()).version).toBe(2);
        expect(await database.getRepository(Payment).count()).toBe(2);
      });

      it('replays an expired attempt without creating another payment or restoring the fifteen-minute window', async () => {
        const created = await create();
        const key = randomUUID();
        const first = await checkout(created.orderId, key).expect(201);
        await expire(created.orderId);
        const deadline = (await getOrder(created.orderId)).expiresAt.getTime();
        const responses = await Promise.all(
          Array.from({ length: 4 }, () => checkout(created.orderId, key)),
        );
        for (const response of responses) {
          expect(response.status).toBe(201);
          expect(response.body.paymentId).toBe(first.body.paymentId);
        }
        expect((await getOrder(created.orderId)).status).toBe('CANCELLED');
        expect((await getOrder(created.orderId)).expiresAt.getTime()).toBe(
          deadline,
        );
        expect(await database.getRepository(Payment).count()).toBe(1);
        expect((await stock()).quantity).toBe(1000);
        expect((await stock()).version).toBe(3);
        await staffDecision(first.body.paymentId, 'SUCCESS').expect(400);
      });

      it('rejects reusing a key with a different payment method instead of returning an unrelated session', async () => {
        const created = await create();
        const key = randomUUID();
        const first = await checkout(created.orderId, key).expect(201);
        await checkout(created.orderId, key, 'CARD').expect(400);
        expect(await database.getRepository(Payment).count()).toBe(1);
        expect(
          await database
            .getRepository(Payment)
            .findOneByOrFail({ id: first.body.paymentId }),
        ).toMatchObject({ method: 'WALLET', status: 'PENDING' });
        expect((await stock()).version).toBe(2);
      });

      it('rejects a key owned by another order, including simultaneous inserts on different orders', async () => {
        const first = await create();
        const second = await create();
        const key = randomUUID();
        const responses = await Promise.all([
          checkout(first.orderId, key),
          checkout(second.orderId, key),
        ]);
        expect(
          responses.map((response) => response.status).sort((a, b) => a - b),
        ).toEqual([201, 400]);
        expect(await database.getRepository(Payment).count()).toBe(1);
        expect(
          responses.find((response) => response.status === 400)!.body.paymentId,
        ).toBeUndefined();
        expect((await stock()).quantity).toBe(960);
        expect((await stock()).version).toBe(3);
      });

      it('does not disclose another account payment when its key is reused', async () => {
        const first = await create();
        const key = randomUUID();
        await checkout(first.orderId, key).expect(201);
        const other = await database.getRepository(User).save({
          email: `${randomUUID()}@task10.test`,
          passwordHash: 'not-used',
          loyaltyPoints: 0,
        });
        const own = await orders.createOrder(other.id, { items: [item()] });
        const otherToken = app
          .get(JwtService)
          .sign({ sub: other.id, email: other.email });
        const response = await request(app.getHttpServer())
          .post('/payments')
          .set('Authorization', `Bearer ${otherToken}`)
          .set('Idempotency-Key', key)
          .send({ orderId: own.orderId, method: 'WALLET' })
          .expect(400);
        expect(response.body.paymentId).toBeUndefined();
        expect(await database.getRepository(Payment).count()).toBe(1);
        expect((await getOrder(own.orderId)).status).toBe('PENDING');
      });

      it('validates the key boundary before writing rather than returning a database error', async () => {
        const created = await create();
        await checkout(created.orderId, 'x'.repeat(129)).expect(400);
        await checkout(created.orderId, '   ').expect(400);
        expect(await database.getRepository(Payment).count()).toBe(0);
        await checkout(created.orderId, 'x'.repeat(128)).expect(201);
      });

      it('serializes mixed success/failure staff decisions and acknowledges only the first outcome', async () => {
        const created = await create();
        const first = await checkout(created.orderId, randomUUID()).expect(201);
        const responses = await Promise.all(
          Array.from({ length: 10 }, (_, index) =>
            staffDecision(
              first.body.paymentId,
              index % 2 ? 'FAILED' : 'SUCCESS',
            ),
          ),
        );
        expect(responses.every((response) => response.status === 200)).toBe(
          true,
        );
        expect(
          new Set(responses.map((response) => response.body.status)).size,
        ).toBe(1);
        expect(
          (
            await database
              .getRepository(Payment)
              .findOneByOrFail({ id: first.body.paymentId })
          ).reviewedBy,
        ).toBe(adminId);
        const payment = await database
          .getRepository(Payment)
          .findOneByOrFail({ id: first.body.paymentId });
        expect((await getOrder(created.orderId)).status).toBe(
          payment.status === 'SUCCESS' ? 'PAID' : 'PAYMENT_FAILED',
        );
        expect((await stock()).quantity).toBe(980);
        expect((await stock()).version).toBe(2);
      });

      it('rolls the order back if persisting the payment outcome fails, then safely accepts a retry', async () => {
        const created = await create();
        const first = await checkout(created.orderId, randomUUID()).expect(201);
        await database.query(
          `ALTER TABLE payments ADD CONSTRAINT task10d_reject_success CHECK (status <> 'SUCCESS')`,
        );
        try {
          await staffDecision(first.body.paymentId, 'SUCCESS').expect(500);
          expect((await getOrder(created.orderId)).status).toBe('PENDING');
          expect(
            (
              await database
                .getRepository(Payment)
                .findOneByOrFail({ id: first.body.paymentId })
            ).status,
          ).toBe('PENDING');
          expect((await stock()).version).toBe(2);
        } finally {
          await database.query(
            'ALTER TABLE payments DROP CONSTRAINT task10d_reject_success',
          );
        }
        await staffDecision(first.body.paymentId, 'SUCCESS').expect(200);
        expect((await getOrder(created.orderId)).status).toBe('PAID');
      });

      it('does not let a staff decision from an older failed attempt undo a successful retry', async () => {
        const created = await create();
        const first = await checkout(created.orderId, randomUUID()).expect(201);
        await staffDecision(first.body.paymentId, 'FAILED').expect(200);
        const second = await checkout(
          created.orderId,
          randomUUID(),
          'CARD',
        ).expect(201);
        await staffDecision(second.body.paymentId, 'SUCCESS').expect(200);
        const late = await staffDecision(first.body.paymentId, 'FAILED').expect(
          200,
        );
        expect(late.body.status).toBe('FAILED');
        expect((await getOrder(created.orderId)).status).toBe('PAID');
        expect((await stock()).version).toBe(2);
      });

      it('serializes successful staff decisions racing with cancellation and refunds at most once', async () => {
        const created = await create();
        const first = await checkout(created.orderId, randomUUID()).expect(201);
        await Promise.allSettled([
          staffReview(first.body.paymentId),
          orders.cancelOrder(userId, created.orderId),
          orders.cancelOrder(userId, created.orderId),
        ]);
        const final = await getOrder(created.orderId);
        expect(['CANCELLED', 'PAID']).toContain(final.status);
        expect((await stock()).quantity).toBe(
          final.status === 'CANCELLED' ? 1000 : 980,
        );
        expect((await stock()).version).toBe(
          final.status === 'CANCELLED' ? 3 : 2,
        );
      });
    });

    describe('POST /orders with Idempotency-Key (Task 10, tiêu chí b)', () => {
      const place = (key: string | null, items = [item()], jwt = token) => {
        const call = request(app.getHttpServer())
          .post('/orders')
          .set('Authorization', `Bearer ${jwt}`);
        if (key !== null) call.set('Idempotency-Key', key);
        return call.send({ items });
      };
      const orderCount = () => database.getRepository(Order).count();

      it('requires the Idempotency-Key header', async () => {
        await place(null).expect(400);
        await place('   ').expect(400);
        await place('x'.repeat(129)).expect(400);
        expect(await orderCount()).toBe(0);
      });

      it('sending the same key twice creates one order and reserves stock once', async () => {
        const key = randomUUID();
        const first = await place(key).expect(201);
        const second = await place(key).expect(201);
        expect(second.body.orderId).toBe(first.body.orderId);
        expect(second.body.expiresAt).toBe(first.body.expiresAt);
        expect(await orderCount()).toBe(1);
        expect((await stock()).quantity).toBe(980);
      });

      it('ten simultaneous requests with the same key create exactly one order', async () => {
        const key = randomUUID();
        const responses = await Promise.all(
          Array.from({ length: 10 }, () => place(key)),
        );
        responses.forEach((response) => expect(response.status).toBe(201));
        expect(new Set(responses.map((r) => r.body.orderId)).size).toBe(1);
        expect(await orderCount()).toBe(1);
        expect(await database.getRepository(OrderRequestKey).count()).toBe(1);
        expect((await stock()).quantity).toBe(980);
      });

      it('rejects the same key with a different cart instead of returning an unrelated order', async () => {
        const key = randomUUID();
        await place(key).expect(201);
        await place(key, [item({ qty: 2 })]).expect(409);
        expect(await orderCount()).toBe(1);
        expect((await stock()).quantity).toBe(980);
      });

      it('different keys create different orders, and keys are per account', async () => {
        const key = randomUUID();
        const mine = await place(key).expect(201);
        const theirs = await place(key, [item()], adminToken).expect(201);
        const another = await place(randomUUID()).expect(201);
        expect(
          new Set([
            mine.body.orderId,
            theirs.body.orderId,
            another.body.orderId,
          ]).size,
        ).toBe(3);
        expect((await stock()).quantity).toBe(940);
      });

      it('a failed attempt (out of stock) does not use up the key', async () => {
        await database.getRepository(Ingredient).update('coffee', {
          quantity: 0,
        });
        const key = randomUUID();
        expect((await place(key)).status).toBeGreaterThanOrEqual(400);
        expect(await database.getRepository(OrderRequestKey).count()).toBe(0);
        await database.getRepository(Ingredient).update('coffee', {
          quantity: 1000,
        });
        await place(key).expect(201);
        expect(await orderCount()).toBe(1);
      });
    });

    it('exposes authenticated create/cancel APIs and hides orders owned by another account', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({ items: [item()] })
        .expect(401);
      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', randomUUID())
        .send({ items: [item()] })
        .expect(201);
      expect(response.body.expiresAt).toBeDefined();
      const strangerToken = app
        .get(JwtService)
        .sign({ sub: randomUUID(), email: 'other@task10.test' });
      await request(app.getHttpServer())
        .post(`/orders/${response.body.orderId}/cancel`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(404);
      await request(app.getHttpServer())
        .post(`/orders/${response.body.orderId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((await stock()).quantity).toBe(1000);
    });
    describe('benefits foundation and customer cancellation guard', () => {
      const cancel = (id: string, jwt = token) =>
        request(app.getHttpServer())
          .post(`/orders/${id}/cancel`)
          .set('Authorization', `Bearer ${jwt}`);
      const addVoucher = () =>
        database.getRepository(Voucher).save({
          code: 'FOUND3',
          title: 'Foundation fixture',
          discountType: 'FIXED',
          discountValue: 1000,
          minSubtotal: 0,
          maxDiscount: null,
          startsAt: new Date(Date.now() - 60000),
          endsAt: new Date(Date.now() + 3600000),
          isActive: true,
          isPublic: true,
        });

      it('preserves legacy defaults while new orders enable voucher reservation without awarding points before PAID', async () => {
        const voucher = await addVoucher();
        expect(voucher.maxUsesPerUser).toBe(3);
        await database.query(
          `INSERT INTO orders (id, "userId", total, subtotal) VALUES ('LEGACY-BENEFITS', $1, 35000, 35000)`,
          [userId],
        );
        expect((await getOrder('LEGACY-BENEFITS')).benefitsPolicyVersion).toBe(
          0,
        );
        const created = await orders.createOrder(userId, {
          items: [item()],
          voucherCode: voucher.code,
        });
        expect(await getOrder(created.orderId)).toMatchObject({
          benefitsPolicyVersion: 1,
          pointsEarned: 0,
          pointsReversed: 0,
          pointsAwardedAt: null,
          pointsReversedAt: null,
          cancelRequestId: null,
          cancelRequestStatus: null,
          cancelReason: null,
        });
        expect(await database.getRepository(VoucherUsage).count()).toBe(1);
        expect(
          (await database.getRepository(User).findOneByOrFail({ id: userId }))
            .loyaltyPoints,
        ).toBe(0);
      });

      it('supports multiple uses per account, preserves released history, and rejects duplicate usage for one order', async () => {
        const voucher = await addVoucher();
        const ids: string[] = [];
        for (let index = 0; index < 3; index++) {
          const created = await orders.createOrder(userId, {
            items: [item()],
            voucherCode: voucher.code,
          });
          ids.push(created.orderId);
        }
        expect(
          await database
            .getRepository(VoucherUsage)
            .countBy({ userId, voucherCode: voucher.code }),
        ).toBe(3);
        await expect(
          database
            .getRepository(VoucherUsage)
            .insert({ orderId: ids[0], userId, voucherCode: voucher.code }),
        ).rejects.toMatchObject({ driverError: { code: '23505' } });
        await expect(
          database
            .getRepository(VoucherUserQuota)
            .insert({ userId, voucherCode: voucher.code }),
        ).rejects.toMatchObject({ driverError: { code: '23505' } });
        await database
          .getRepository(VoucherUsage)
          .update({ orderId: ids[0] }, { status: 'USED', usedAt: new Date() });
        await database
          .getRepository(VoucherUsage)
          .update(
            { orderId: ids[0] },
            { status: 'RELEASED', releasedAt: new Date() },
          );
        expect(
          await database
            .getRepository(VoucherUsage)
            .findOneByOrFail({ orderId: ids[0] }),
        ).toMatchObject({
          status: 'RELEASED',
          usedAt: expect.any(Date),
          releasedAt: expect.any(Date),
        });
      });

      it('rejects invalid limits, incomplete usage state, unaudited points and incomplete cancellation metadata', async () => {
        const voucher = await addVoucher();
        const created = await create();
        await database
          .getRepository(VoucherUserQuota)
          .insert({ userId, voucherCode: voucher.code });
        await expect(
          database
            .getRepository(Voucher)
            .update(voucher.code, { maxUsesPerUser: 0 }),
        ).rejects.toMatchObject({ driverError: { code: '23514' } });
        await expect(
          database.getRepository(VoucherUsage).insert({
            orderId: created.orderId,
            userId,
            voucherCode: voucher.code,
            status: 'USED',
          }),
        ).rejects.toMatchObject({ driverError: { code: '23514' } });
        await expect(
          database
            .getRepository(Order)
            .update(created.orderId, { pointsEarned: 7 }),
        ).rejects.toMatchObject({ driverError: { code: '23514' } });
        await expect(
          database
            .getRepository(Order)
            .update(created.orderId, { pointsEarned: -1 }),
        ).rejects.toMatchObject({ driverError: { code: '23514' } });
        await expect(
          database
            .getRepository(Order)
            .update(created.orderId, { cancelRequestStatus: 'PENDING' }),
        ).rejects.toMatchObject({ driverError: { code: '23514' } });
        await expect(
          database
            .getRepository(VoucherUserQuota)
            .insert({ userId: randomUUID(), voucherCode: voucher.code }),
        ).rejects.toMatchObject({ driverError: { code: '23503' } });
      });

      it('refuses a destructive downgrade after workflow data has been recorded', async () => {
        const created = await create();
        await database.getRepository(Order).update(created.orderId, {
          benefitsPolicyVersion: 1,
          pointsAwardedAt: new Date(),
        });
        const runner = database.createQueryRunner();
        await runner.connect();
        try {
          await expect(
            new BenefitsFoundation1761880000000().down(runner),
          ).rejects.toThrow('Cannot revert');
          expect((await getOrder(created.orderId)).benefitsPolicyVersion).toBe(
            1,
          );
          expect(await database.getRepository(VoucherUsage).count()).toBe(0);
        } finally {
          await runner.release();
        }
      });

      it.each(['WALLET', 'CARD'] as const)(
        'allows immediate cancellation of an unreported %s payment, without changing the deadline',
        async (method) => {
          const created = await create();
          const payment = await payments.createPayment(
            userId,
            { orderId: created.orderId, method },
            randomUUID(),
          );
          await cancel(created.orderId).expect(200);
          await cancel(created.orderId).expect(200);
          expect((await getOrder(created.orderId)).expiresAt.getTime()).toBe(
            created.expiresAt.getTime(),
          );
          expect((await stock()).quantity).toBe(1000);
          expect((await stock()).version).toBe(3);
          await expect(
            payments.review(adminId, payment.paymentId, 'CONFIRM'),
          ).rejects.toThrow();
        },
      );

      it('does not let a customer cancel a reported or PAID order through the immediate API', async () => {
        const created = await create();
        const payment = await payments.createPayment(
          userId,
          { orderId: created.orderId, method: 'WALLET' },
          randomUUID(),
        );
        await payments.receiveTransfer(payment.paymentId);
        const reported = await cancel(created.orderId).expect(409);
        expect(reported.body.code).toBe('CANCELLATION_REQUIRES_REVIEW');
        expect((await getOrder(created.orderId)).status).toBe('PENDING');
        await staffReview(payment.paymentId);
        await cancel(created.orderId).expect(409);
        expect((await getOrder(created.orderId)).status).toBe('PAID');
        expect((await stock()).quantity).toBe(980);
        expect((await stock()).version).toBe(2);
      });

      it('allows cancelling PAYMENT_FAILED (money refunded) and never auto-expires an order whose money already arrived', async () => {
        const failed = await create();
        const first = await payments.createPayment(
          userId,
          { orderId: failed.orderId, method: 'WALLET' },
          randomUUID(),
        );
        await payments.receiveTransfer(first.paymentId);
        await staffReview(first.paymentId, 'FAILED');
        expect(
          (await statement(failed.orderId)).map((row) => [
            row.type,
            row.amount,
          ]),
        ).toEqual([
          ['IN', failed.total],
          ['REFUND', failed.total],
        ]);
        await cancel(failed.orderId).expect(200);
        expect(await statement(failed.orderId)).toHaveLength(2);

        const paidInTime = await create();
        const second = await payments.createPayment(
          userId,
          { orderId: paidInTime.orderId, method: 'WALLET' },
          randomUUID(),
        );
        await payments.receiveTransfer(second.paymentId);
        await expire(paidInTime.orderId);
        expect(await orders.expireUnpaidOrders()).toBe(0);
        expect((await getOrder(paidInTime.orderId)).status).toBe('PENDING');
        const blocked = await cancel(paidInTime.orderId).expect(409);
        expect(blocked.body.code).toBe('CANCELLATION_REQUIRES_REVIEW');
        // Staff may still confirm after the deadline because the money arrived in time
        await staffReview(second.paymentId);
        expect((await getOrder(paidInTime.orderId)).status).toBe('PAID');
        expect(await statement(paidInTime.orderId)).toHaveLength(1);
        expect((await stock()).quantity).toBe(980);
      });

      it('blocks immediate cancellation when a request is pending and keeps ownership private', async () => {
        const created = await create();
        await database.getRepository(Order).update(created.orderId, {
          cancelRequestId: randomUUID(),
          cancelRequestedAt: new Date(),
          cancelRequestReason: 'Please review',
          cancelRequestStatus: 'PENDING',
        });
        const response = await cancel(created.orderId).expect(409);
        expect(response.body.code).toBe('CANCELLATION_REQUEST_PENDING');
        const foreign = app
          .get(JwtService)
          .sign({ sub: adminId, email: 'staff@test.local', role: 'ADMIN' });
        await cancel(created.orderId, foreign).expect(404);
        expect((await stock()).quantity).toBe(980);
      });

      it('serializes reporting against immediate cancellation so only one path succeeds', async () => {
        const created = await create();
        const payment = await payments.createPayment(
          userId,
          { orderId: created.orderId, method: 'WALLET' },
          randomUUID(),
        );
        const results = await Promise.allSettled([
          payments.receiveTransfer(payment.paymentId),
          orders.cancelOrder(userId, created.orderId),
        ]);
        expect(
          results.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
        const final = await getOrder(created.orderId);
        expect(['CANCELLED', 'PENDING']).toContain(final.status);
        expect((await stock()).quantity).toBe(
          final.status === 'CANCELLED' ? 1000 : 980,
        );
        expect((await stock()).version).toBe(
          final.status === 'CANCELLED' ? 3 : 2,
        );
      });
    });

    describe('staff preparation board and customer progress', () => {
      const advance = (id: string, status: string, bearer = adminToken) =>
        request(app.getHttpServer())
          .patch(`/admin/orders/${id}/status`)
          .set('Authorization', `Bearer ${bearer}`)
          .send({ status });
      const list = (
        query = 'status=PAID,PREPARING,READY',
        bearer = adminToken,
      ) =>
        request(app.getHttpServer())
          .get(`/admin/orders?${query}`)
          .set('Authorization', `Bearer ${bearer}`);
      const paid = async (customer = userId, voucher = false) => {
        if (voucher)
          await database.getRepository(Voucher).save({
            code: 'PREP5K',
            title: 'Preparation fixture',
            discountType: 'FIXED',
            discountValue: 5000,
            minSubtotal: 0,
            maxDiscount: null,
            maxUsesPerUser: 3,
            startsAt: new Date(Date.now() - 86400000),
            endsAt: new Date(Date.now() + 86400000),
            isActive: true,
            isPublic: true,
          });
        const order = await orders.createOrder(customer, {
          items: [item()],
          ...(voucher ? { voucherCode: 'PREP5K' } : {}),
        });
        const payment = await payments.createPayment(
          customer,
          { orderId: order.orderId, method: 'CARD' },
          randomUUID(),
        );
        await staffReview(payment.paymentId);
        return { order, payment };
      };

      it('restricts the board and status mutations to ADMIN and rejects unknown orders', async () => {
        const { order } = await paid();
        await request(app.getHttpServer())
          .patch(`/admin/orders/${order.orderId}/status`)
          .send({ status: 'PREPARING' })
          .expect(401);
        await advance(order.orderId, 'PREPARING', token).expect(403);
        await list(undefined, token).expect(403);
        await request(app.getHttpServer())
          .get('/admin/orders?status=PAID')
          .expect(401);
        await advance('ORD-missing', 'PREPARING').expect(404);
        expect((await getOrder(order.orderId)).status).toBe('PAID');
      });

      it.each([
        'PAID',
        'CANCELLED',
        'PENDING',
        'PAYMENT_FAILED',
        'UNKNOWN',
        '',
      ])(
        'rejects target %s instead of bypassing payment or cancellation APIs',
        async (target) => {
          const created = await create();
          await advance(created.orderId, target).expect(400);
          expect((await getOrder(created.orderId)).status).toBe('PENDING');
          expect((await stock()).quantity).toBe(980);
        },
      );

      it('validates list filters and keeps unpaid cancellation requests separate from preparation orders', async () => {
        for (const query of [
          'status=CANCELLED',
          'status=PENDING',
          'status=PAID,BOGUS',
          'status=',
          'status=READY&cancelRequestStatus=PENDING',
          'cancelRequestStatus=ALL',
        ])
          await list(query).expect(400);
        const waiting = await create();
        const payment = await payments.createPayment(
          userId,
          { orderId: waiting.orderId, method: 'WALLET' },
          randomUUID(),
        );
        await payments.receiveTransfer(payment.paymentId);
        await orders.requestCancellation(
          userId,
          waiting.orderId,
          'Waiting customer request',
        );
        const first = await paid();
        const second = await paid();
        await advance(second.order.orderId, 'PREPARING').expect(200);
        expect(
          (await list().expect(200)).body.map(
            (entry: { id: string }) => entry.id,
          ),
        ).toEqual([first.order.orderId, second.order.orderId]);
        expect(
          (await list('status=PREPARING').expect(200)).body.map(
            (entry: { id: string }) => entry.id,
          ),
        ).toEqual([second.order.orderId]);
        expect(
          (await list('cancelRequestStatus=PENDING').expect(200)).body.map(
            (entry: { id: string }) => entry.id,
          ),
        ).toEqual([waiting.orderId]);
      });

      it('advances all stages without changing money, paid payment, stock, benefits or deadline, and removes COMPLETED from the board', async () => {
        const { order, payment } = await paid(userId, true);
        const before = await getOrder(order.orderId);
        const version = (await stock()).version;
        for (const target of ['PREPARING', 'READY', 'COMPLETED']) {
          const result = await advance(order.orderId, target).expect(200);
          expect(result.body).toMatchObject({
            status: target,
            total: before.total,
            subtotal: before.subtotal,
            discount: before.discount,
            voucherCode: before.voucherCode,
            pointsEarned: before.pointsEarned,
            pointsAwardedAt: before.pointsAwardedAt!.toISOString(),
            expiresAt: before.expiresAt.toISOString(),
            canCancelImmediately: false,
            canRequestCancellation: false,
          });
          await advance(order.orderId, target).expect(200);
          expect((await stock()).quantity).toBe(980);
          expect((await stock()).version).toBe(version);
          expect(
            (await database.getRepository(User).findOneByOrFail({ id: userId }))
              .loyaltyPoints,
          ).toBe(3);
          expect(
            (
              await database
                .getRepository(VoucherUsage)
                .findOneByOrFail({ orderId: order.orderId })
            ).status,
          ).toBe('USED');
          expect(
            (
              await database
                .getRepository(Payment)
                .findOneByOrFail({ id: payment.paymentId })
            ).status,
          ).toBe('SUCCESS');
          const own = await request(app.getHttpServer())
            .get(`/orders/${order.orderId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
          expect(own.body.status).toBe(target);
        }
        expect((await list().expect(200)).body).toEqual([]);
        const history = await request(app.getHttpServer())
          .get('/orders/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(history.body[0].status).toBe('COMPLETED');
      });

      it('rejects skipped, reversed and stale transitions without moving an already advanced order backwards', async () => {
        const { order } = await paid();
        await advance(order.orderId, 'READY').expect(400);
        await advance(order.orderId, 'COMPLETED').expect(400);
        await advance(order.orderId, 'PREPARING').expect(200);
        await advance(order.orderId, 'COMPLETED').expect(400);
        await advance(order.orderId, 'READY').expect(200);
        await advance(order.orderId, 'PREPARING').expect(400);
        await advance(order.orderId, 'COMPLETED').expect(200);
        await advance(order.orderId, 'READY').expect(400);
        expect((await getOrder(order.orderId)).status).toBe('COMPLETED');
      });

      it('serializes concurrent duplicate staff actions at each stage', async () => {
        const { order } = await paid();
        for (const target of ['PREPARING', 'READY', 'COMPLETED']) {
          const responses = await Promise.all([
            advance(order.orderId, target),
            advance(order.orderId, target),
          ]);
          expect(responses.map((entry) => entry.status)).toEqual([200, 200]);
          expect((await getOrder(order.orderId)).status).toBe(target);
        }
        expect((await stock()).version).toBe(2);
      });

      it('blocks preparation until staff resolve a cancellation request and prevents cancellations after preparation', async () => {
        const { order } = await paid();
        await orders.requestCancellation(
          userId,
          order.orderId,
          'Please cancel',
        );
        const pending = await getOrder(order.orderId);
        const blocked = await advance(order.orderId, 'PREPARING').expect(409);
        expect(blocked.body.code).toBe('CANCELLATION_REQUEST_PENDING');
        expect((await list().expect(200)).body[0].cancelRequest.status).toBe(
          'PENDING',
        );
        await orders.reviewCancellation(
          adminId,
          order.orderId,
          pending.cancelRequestId!,
          'REJECTED',
          'Continue order',
        );
        await advance(order.orderId, 'PREPARING').expect(200);
        for (const target of ['READY', 'COMPLETED']) {
          await advance(order.orderId, target).expect(200);
          await request(app.getHttpServer())
            .post(`/orders/${order.orderId}/cancel-request`)
            .set('Authorization', `Bearer ${token}`)
            .send({ reason: 'Too late' })
            .expect(409);
          await request(app.getHttpServer())
            .post(`/orders/${order.orderId}/cancel`)
            .set('Authorization', `Bearer ${token}`)
            .send({})
            .expect(400);
        }
      });

      it('serializes the preparation API against a new cancellation request', async () => {
        const { order } = await paid();
        const results = await Promise.all([
          advance(order.orderId, 'PREPARING'),
          request(app.getHttpServer())
            .post(`/orders/${order.orderId}/cancel-request`)
            .set('Authorization', `Bearer ${token}`)
            .send({ reason: 'Concurrent request' }),
        ]);
        expect(
          results.map((entry) => entry.status).sort((a, b) => a - b),
        ).toEqual([200, 409]);
        const current = await getOrder(order.orderId);
        expect(current.status === 'PREPARING').toBe(
          current.cancelRequestStatus !== 'PENDING',
        );
        expect((await stock()).quantity).toBe(980);
      });

      it('never starts an unpaid or cancelled order and commits expiry before rejecting a stale action', async () => {
        const created = await create();
        await advance(created.orderId, 'PREPARING').expect(400);
        const payment = await payments.createPayment(
          userId,
          { orderId: created.orderId, method: 'CARD' },
          randomUUID(),
        );
        await staffReview(payment.paymentId, 'FAILED');
        await advance(created.orderId, 'PREPARING').expect(400);
        await expire(created.orderId);
        await advance(created.orderId, 'PREPARING').expect(409);
        expect((await getOrder(created.orderId)).status).toBe('CANCELLED');
        expect((await stock()).quantity).toBe(1000);
        await advance(created.orderId, 'PREPARING').expect(400);
        expect((await stock()).version).toBe(3);
      });

      it('lists all customers in FIFO order and retains saved item names even after the catalog changes', async () => {
        const first = await paid();
        const second = await paid(adminId);
        const product = await database
          .getRepository(Product)
          .findOneByOrFail({ id: '1' });
        try {
          await database
            .getRepository(Product)
            .update('1', { name: 'Changed catalog name' });
          const response = await list().expect(200);
          expect(response.headers['cache-control']).toBe('private, no-store');
          expect(
            response.body.map((entry: { id: string }) => entry.id),
          ).toEqual([first.order.orderId, second.order.orderId]);
          expect(response.body[0].items[0].name).toBe(product.name);
          expect(response.body[1].items[0].name).toBe(product.name);
          expect(response.body[0]).not.toHaveProperty('userId');
        } finally {
          await database
            .getRepository(Product)
            .update('1', { name: product.name });
        }
      });
    });

    describe('customer and staff cancellation workflow', () => {
      const own = (id: string, bearer = token) =>
        request(app.getHttpServer())
          .get(`/orders/${id}`)
          .set('Authorization', `Bearer ${bearer}`);
      const ask = (id: string, reason = 'Đổi kế hoạch', bearer = token) =>
        request(app.getHttpServer())
          .post(`/orders/${id}/cancel-request`)
          .set('Authorization', `Bearer ${bearer}`)
          .send({ reason });
      const approve = (
        id: string,
        requestId: string,
        note?: string,
        bearer = adminToken,
      ) =>
        request(app.getHttpServer())
          .post(`/admin/orders/${id}/cancel`)
          .set('Authorization', `Bearer ${bearer}`)
          .send({ requestId, ...(note ? { note } : {}) });
      const reject = (
        id: string,
        requestId: string,
        reason = 'Đã đối chiếu, xin tiếp tục đơn',
      ) =>
        request(app.getHttpServer())
          .post(`/admin/orders/${id}/cancel-request/reject`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ requestId, reason });
      const open = async (paid = false, voucher = false) => {
        if (voucher)
          await database.getRepository(Voucher).save({
            code: 'CANCEL5K',
            title: 'Cancellation fixture',
            discountType: 'FIXED',
            discountValue: 5000,
            minSubtotal: 0,
            maxDiscount: null,
            maxUsesPerUser: 3,
            startsAt: new Date(Date.now() - 86400000),
            endsAt: new Date(Date.now() + 86400000),
            isActive: true,
            isPublic: true,
          });
        const order = await orders.createOrder(userId, {
          items: [item()],
          ...(voucher ? { voucherCode: 'CANCEL5K' } : {}),
        });
        const payment = await payments.createPayment(
          userId,
          { orderId: order.orderId, method: 'WALLET' },
          randomUUID(),
        );
        await payments.receiveTransfer(payment.paymentId);
        if (paid) await staffReview(payment.paymentId);
        return { order, payment };
      };

      it('reports capabilities from current payment/deadline and prevents requests for immediately cancellable or foreign orders', async () => {
        const created = await create();
        expect((await own(created.orderId).expect(200)).body).toMatchObject({
          canCancelImmediately: true,
          canRequestCancellation: false,
          cancelRequest: null,
        });
        await ask(created.orderId).expect(409);
        await ask(created.orderId, 'Other account', adminToken).expect(404);
        const payment = await payments.createPayment(
          userId,
          { orderId: created.orderId, method: 'WALLET' },
          randomUUID(),
        );
        expect((await own(created.orderId)).body.canCancelImmediately).toBe(
          true,
        );
        await payments.receiveTransfer(payment.paymentId);
        expect((await own(created.orderId)).body).toMatchObject({
          canCancelImmediately: false,
          canRequestCancellation: true,
        });
        // Money arrived in time: after the deadline the customer can still ask staff
        await expire(created.orderId);
        expect((await own(created.orderId)).body).toMatchObject({
          canCancelImmediately: false,
          canRequestCancellation: true,
        });
        // Without money, an expired order offers nothing
        const unpaid = await create();
        await expire(unpaid.orderId);
        expect((await own(unpaid.orderId)).body).toMatchObject({
          canCancelImmediately: false,
          canRequestCancellation: false,
        });
      });

      it('creates one pending request for concurrent submissions, blocks payment actions and leaves its deadline and benefits reserved', async () => {
        const { order, payment } = await open(false, true);
        const responses = await Promise.all([
          ask(order.orderId),
          ask(order.orderId, 'Second reason'),
        ]);
        responses.forEach((response) => expect(response.status).toBe(200));
        expect(responses[0].body.cancelRequest).toEqual(
          responses[1].body.cancelRequest,
        );
        const stored = await getOrder(order.orderId);
        expect(stored.expiresAt.getTime()).toBe(order.expiresAt.getTime());
        expect((await own(order.orderId)).body).toMatchObject({
          status: 'PENDING',
          canPay: false,
          canCancelImmediately: false,
          canRequestCancellation: false,
        });
        for (const decision of ['CONFIRM', 'REJECT'] as const)
          await expect(
            payments.review(adminId, payment.paymentId, decision),
          ).rejects.toThrow('Đơn đang chờ duyệt hủy');
        await expect(
          payments.createPayment(
            userId,
            { orderId: order.orderId, method: 'CARD' },
            randomUUID(),
          ),
        ).rejects.toThrow('Đơn đang chờ duyệt hủy');
        await expect(
          orders.cancelOrder(userId, order.orderId),
        ).rejects.toThrow();
        expect((await stock()).quantity).toBe(980);
        expect(
          (
            await database
              .getRepository(VoucherUsage)
              .findOneByOrFail({ orderId: order.orderId })
          ).status,
        ).toBe('RESERVED');
        const list = await request(app.getHttpServer())
          .get('/admin/orders?cancelRequestStatus=PENDING')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(list.body.map((row: { id: string }) => row.id)).toEqual([
          order.orderId,
        ]);
      });

      it('requires staff privileges and validates reason/request identifiers without exposing other customers', async () => {
        const { order } = await open();
        await ask(order.orderId, '   ').expect(400);
        await ask(order.orderId, 'x'.repeat(501)).expect(400);
        const result = await ask(order.orderId, '  Cần đổi lịch  ').expect(200);
        expect(result.body.cancelRequest.reason).toBe('Cần đổi lịch');
        await request(app.getHttpServer()).get('/admin/orders').expect(401);
        await request(app.getHttpServer())
          .get('/admin/orders')
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
        await request(app.getHttpServer())
          .get('/admin/orders?cancelRequestStatus=ALL')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
        await approve(
          order.orderId,
          result.body.cancelRequest.id,
          undefined,
          token,
        ).expect(403);
        await approve(order.orderId, 'bad-id').expect(400);
        await approve(order.orderId, randomUUID()).expect(409);
        await reject(order.orderId, result.body.cancelRequest.id, ' ').expect(
          400,
        );
        expect((await getOrder(order.orderId)).cancelRequestStatus).toBe(
          'PENDING',
        );
      });

      it('rejects with a visible reason, repeats safely and prevents stale staff actions after a new request', async () => {
        const { order, payment } = await open();
        const first = (await ask(order.orderId).expect(200)).body.cancelRequest;
        const rejected = await reject(order.orderId, first.id).expect(200);
        expect(rejected.body).toMatchObject({
          status: 'PENDING',
          canPay: true,
          canRequestCancellation: true,
          cancelRequest: {
            status: 'REJECTED',
            reviewedBy: adminId,
            reviewNote: 'Đã đối chiếu, xin tiếp tục đơn',
          },
        });
        const repeated = await reject(
          order.orderId,
          first.id,
          'Must not overwrite',
        ).expect(200);
        expect(repeated.body.cancelRequest).toEqual(
          rejected.body.cancelRequest,
        );
        const second = (await ask(order.orderId, 'Yêu cầu mới').expect(200))
          .body.cancelRequest;
        expect(second.id).not.toBe(first.id);
        await approve(order.orderId, first.id).expect(409);
        await reject(order.orderId, first.id).expect(409);
        await reject(order.orderId, second.id).expect(200);
        await staffReview(payment.paymentId);
        expect((await getOrder(order.orderId)).status).toBe('PAID');
      });

      it('approves an unpaid request once, closes payment and releases inventory and voucher exactly once', async () => {
        const { order, payment } = await open(false, true);
        const pending = (await ask(order.orderId)).body.cancelRequest;
        const results = await Promise.all([
          approve(order.orderId, pending.id),
          approve(order.orderId, pending.id),
        ]);
        results.forEach((result) => expect(result.status).toBe(200));
        expect(results[0].body.cancelRequest).toEqual(
          results[1].body.cancelRequest,
        );
        expect((await getOrder(order.orderId)).cancelRequestStatus).toBe(
          'APPROVED',
        );
        expect((await stock()).quantity).toBe(1000);
        expect((await stock()).version).toBe(3);
        expect(
          (
            await database
              .getRepository(Payment)
              .findOneByOrFail({ id: payment.paymentId })
          ).status,
        ).toBe('FAILED');
        expect(
          (
            await database
              .getRepository(VoucherUsage)
              .findOneByOrFail({ orderId: order.orderId })
          ).status,
        ).toBe('RELEASED');
        await expect(
          payments.receiveTransfer(payment.paymentId),
        ).rejects.toThrow();
        await expect(staffReview(payment.paymentId)).rejects.toThrow();
        expect(await orders.expireUnpaidOrders()).toBe(0);
      });

      it('refunds a PAID cancellation exactly once through the mock bank and keeps the successful payment and price snapshot', async () => {
        const { order, payment } = await open(true, true);
        const paid = await getOrder(order.orderId);
        expect(paid.pointsEarned).toBe(3);
        const pending = (await ask(order.orderId)).body.cancelRequest;
        await approve(
          order.orderId,
          pending.id,
          'Đã ghi nhận cần đối chiếu tiền tại quầy',
        ).expect(200);
        await approve(order.orderId, pending.id, 'Repeated action').expect(200);
        expect(
          (await statement(order.orderId)).map((row) => [row.type, row.amount]),
        ).toEqual([
          ['IN', paid.total],
          ['REFUND', paid.total],
        ]);
        const cancelled = await getOrder(order.orderId);
        expect(cancelled).toMatchObject({
          status: 'CANCELLED',
          pointsEarned: 0,
          pointsReversed: 3,
          cancelRequestStatus: 'APPROVED',
          cancelReviewedBy: adminId,
          cancelReviewNote: 'Đã ghi nhận cần đối chiếu tiền tại quầy',
          subtotal: paid.subtotal,
          total: paid.total,
          discount: paid.discount,
          voucherCode: paid.voucherCode,
        });
        expect(
          (await database.getRepository(User).findOneByOrFail({ id: userId }))
            .loyaltyPoints,
        ).toBe(0);
        expect(
          (
            await database
              .getRepository(Payment)
              .findOneByOrFail({ id: payment.paymentId })
          ).status,
        ).toBe('SUCCESS');
        expect(
          (
            await database
              .getRepository(VoucherUsage)
              .findOneByOrFail({ orderId: order.orderId })
          ).status,
        ).toBe('RELEASED');
        expect((await stock()).version).toBe(3);
      });

      it('rolls back approval metadata, stock, usage and status when reward reversal fails', async () => {
        const { order } = await open(true, true);
        const pending = (await ask(order.orderId)).body.cancelRequest;
        await database.getRepository(User).update(userId, { loyaltyPoints: 0 });
        await approve(order.orderId, pending.id, 'Đối chiếu tại quầy').expect(
          409,
        );
        expect(await getOrder(order.orderId)).toMatchObject({
          status: 'PAID',
          cancelRequestStatus: 'PENDING',
          cancelReviewedAt: null,
          pointsEarned: 3,
        });
        expect((await stock()).quantity).toBe(980);
        expect((await stock()).version).toBe(2);
        expect(
          (
            await database
              .getRepository(VoucherUsage)
              .findOneByOrFail({ orderId: order.orderId })
          ).status,
        ).toBe('USED');
      });

      it('never expires an unpaid request whose money arrived; approval cancels and refunds once', async () => {
        const { order, payment } = await open(false, true);
        const pending = (await ask(order.orderId)).body.cancelRequest;
        await expire(order.orderId);
        expect(await orders.expireUnpaidOrders()).toBe(0);
        expect((await getOrder(order.orderId)).status).toBe('PENDING');
        await approve(order.orderId, pending.id).expect(200);
        await approve(order.orderId, pending.id).expect(200);
        expect(await getOrder(order.orderId)).toMatchObject({
          status: 'CANCELLED',
          cancelReason: 'USER_CANCELLED',
          cancelRequestStatus: 'APPROVED',
          cancelReviewedBy: adminId,
        });
        expect(
          (
            await database
              .getRepository(Payment)
              .findOneByOrFail({ id: payment.paymentId })
          ).status,
        ).toBe('FAILED');
        expect(
          (await statement(order.orderId)).map((row) => [row.type, row.amount]),
        ).toEqual([
          ['IN', order.total],
          ['REFUND', order.total],
        ]);
        expect((await stock()).quantity).toBe(1000);
        await reject(order.orderId, pending.id).expect(409);
        await orders.expireUnpaidOrders();
        expect((await stock()).version).toBe(3);
      });

      it('commits timeout cancellation before returning a request error and does not time out PAID requests', async () => {
        // A PAYMENT_FAILED order has no money left (refunded on rejection)
        const { order, payment } = await open();
        await staffReview(payment.paymentId, 'FAILED');
        await expire(order.orderId);
        await ask(order.orderId).expect(409);
        expect((await getOrder(order.orderId)).status).toBe('CANCELLED');
        const paid = await open(true);
        await expire(paid.order.orderId);
        await ask(paid.order.orderId).expect(200);
        await orders.expireUnpaidOrders();
        expect((await getOrder(paid.order.orderId)).status).toBe('PAID');
      });

      it('serializes a payment confirmation racing a request without losing the pending request', async () => {
        const { order, payment } = await open();
        const results = await Promise.allSettled([
          payments.review(adminId, payment.paymentId, 'CONFIRM'),
          orders.requestCancellation(userId, order.orderId, 'Race request'),
        ]);
        expect(results[1].status).toBe('fulfilled');
        const current = await getOrder(order.orderId);
        expect(current.cancelRequestStatus).toBe('PENDING');
        expect(['PENDING', 'PAID']).toContain(current.status);
        expect(current.status === 'PAID').toBe(
          results[0].status === 'fulfilled',
        );
        await expect(
          payments.review(adminId, payment.paymentId, 'REJECT'),
        ).rejects.toThrow();
      });

      it('serializes preparation against cancellation requests and refuses requests after preparation', async () => {
        const { order } = await open(true);
        const results = await Promise.allSettled([
          orders.updateOrderStatus(order.orderId, 'PREPARING'),
          orders.requestCancellation(userId, order.orderId, 'Race preparing'),
        ]);
        expect(
          results.filter((entry) => entry.status === 'fulfilled'),
        ).toHaveLength(1);
        const current = await getOrder(order.orderId);
        if (current.status === 'PAID') {
          expect(current.cancelRequestStatus).toBe('PENDING');
          await reject(order.orderId, current.cancelRequestId!).expect(200);
          await orders.updateOrderStatus(order.orderId, 'PREPARING');
        }
        await ask(order.orderId).expect(409);
        expect((await own(order.orderId)).body).toMatchObject({
          canCancelImmediately: false,
          canRequestCancellation: false,
        });
      });

      it('allows only one of competing approve/reject decisions, and keeps the winning review immutable', async () => {
        const { order } = await open();
        const pending = (await ask(order.orderId)).body.cancelRequest;
        const results = await Promise.all([
          approve(order.orderId, pending.id),
          reject(order.orderId, pending.id),
        ]);
        expect(
          results.map((entry) => entry.status).sort((a, b) => a - b),
        ).toEqual([200, 409]);
        const current = await getOrder(order.orderId);
        expect(current.status).toBe(
          current.cancelRequestStatus === 'APPROVED' ? 'CANCELLED' : 'PENDING',
        );
        expect((await stock()).quantity).toBe(
          current.status === 'CANCELLED' ? 1000 : 980,
        );
      });
    });

    describe('voucher quotas and loyalty settlement', () => {
      const campaign = (overrides: Partial<Voucher> = {}) =>
        database.getRepository(Voucher).save({
          code: 'REWARD3',
          title: 'Rewards fixture',
          discountType: 'FIXED',
          discountValue: 5000,
          minSubtotal: 0,
          maxDiscount: null,
          maxUsesPerUser: 3,
          startsAt: new Date(Date.now() - 86400000),
          endsAt: new Date(Date.now() + 86400000),
          isActive: true,
          isPublic: true,
          ...overrides,
        });
      const discounted = (items = [item()]) =>
        orders.createOrder(userId, { items, voucherCode: 'REWARD3' });
      const usage = (orderId: string) =>
        database.getRepository(VoucherUsage).findOneByOrFail({ orderId });
      const points = async () =>
        (await database.getRepository(User).findOneByOrFail({ id: userId }))
          .loyaltyPoints;
      const pay = async (orderId: string) => {
        const payment = await payments.createPayment(
          userId,
          { orderId, method: 'CARD' },
          randomUUID(),
        );
        await staffReview(payment.paymentId);
        return payment;
      };
      const ownQuote = (voucherCode?: string) =>
        request(app.getHttpServer())
          .post('/vouchers/quote')
          .set('Authorization', `Bearer ${token}`)
          .send({ items: [item()], ...(voucherCode ? { voucherCode } : {}) });

      it('quotes guest and account availability without reserving uses; rejects invalid or deleted-account tokens', async () => {
        await campaign();
        const quote = await ownQuote('REWARD3').expect(200);
        expect(quote.body.voucherUsage).toMatchObject({
          maxUsesPerUser: 3,
          availableUses: 3,
          reservedUses: 0,
          usedUses: 0,
        });
        expect(quote.headers['cache-control']).toBe('private, no-store');
        expect(quote.headers.vary).toContain('Authorization');
        const guest = await request(app.getHttpServer())
          .post('/vouchers/quote')
          .send({ items: [item()] })
          .expect(200);
        expect(guest.body.vouchers[0].usage).toBeNull();
        await request(app.getHttpServer())
          .post('/vouchers/quote')
          .set('Authorization', 'Bearer bad-token')
          .send({ items: [item()] })
          .expect(401);
        const deleted = app.get(JwtService).sign({
          sub: randomUUID(),
          email: 'deleted@test.local',
          role: 'CUSTOMER',
        });
        await request(app.getHttpServer())
          .post('/vouchers/quote')
          .set('Authorization', `Bearer ${deleted}`)
          .send({ items: [item()] })
          .expect(401);
        expect(await database.getRepository(VoucherUserQuota).count()).toBe(0);
        expect(await database.getRepository(VoucherUsage).count()).toBe(0);
        expect((await stock()).quantity).toBe(1000);
      });

      it('accepts only three of four simultaneous orders with different ingredients and rolls back the losing order', async () => {
        await campaign();
        const results = await Promise.allSettled(
          ['1', '3', '5', '6'].map((productId) =>
            discounted([item({ productId })]),
          ),
        );
        expect(
          results.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(3);
        expect(
          results.filter((result) => result.status === 'rejected'),
        ).toHaveLength(1);
        expect(await database.getRepository(Order).count()).toBe(3);
        expect(await database.getRepository(OrderItem).count()).toBe(3);
        expect(
          await database
            .getRepository(VoucherUsage)
            .countBy({ status: 'RESERVED' }),
        ).toBe(3);
        expect(await database.getRepository(VoucherUserQuota).count()).toBe(1);
        const totals = await database.query<
          Array<{ id: string; quantity: number; reserved: number }>
        >(`SELECT i.id, i.quantity, COALESCE(sum(r.amount),0)::int AS reserved
          FROM ingredients i LEFT JOIN order_ingredient_reservations r ON r."ingredientId"=i.id GROUP BY i.id`);
        for (const ingredient of totals)
          expect(ingredient.quantity).toBe(1000 - ingredient.reserved);
        const quote = await ownQuote().expect(200);
        expect(quote.body.vouchers[0]).toMatchObject({
          usage: { availableUses: 0, reservedUses: 3, usedUses: 0 },
        });
        expect(quote.body.vouchers[0].unavailableReason).toContain('đang giữ');
      });

      it('keeps a failed payment reserved, retries the same order and credits only once across repeated staff confirmations', async () => {
        await campaign();
        const created = await discounted();
        await discounted();
        await discounted();
        const first = await payments.createPayment(
          userId,
          { orderId: created.orderId, method: 'WALLET' },
          randomUUID(),
        );
        await payments.receiveTransfer(first.paymentId);
        expect((await usage(created.orderId)).status).toBe('RESERVED');
        expect(await points()).toBe(0);
        await staffReview(first.paymentId, 'FAILED');
        await expect(discounted()).rejects.toThrow('đang giữ');
        const retry = await payments.createPayment(
          userId,
          { orderId: created.orderId, method: 'CARD' },
          randomUUID(),
        );
        expect(retry.amount).toBe(30000);
        await Promise.all(
          Array.from({ length: 8 }, () => staffReview(retry.paymentId)),
        );
        expect((await getOrder(created.orderId)).expiresAt.getTime()).toBe(
          created.expiresAt.getTime(),
        );
        expect((await usage(created.orderId)).status).toBe('USED');
        expect(await points()).toBe(3);
        expect((await getOrder(created.orderId)).pointsEarned).toBe(3);
        expect(await database.getRepository(VoucherUsage).count()).toBe(3);
        expect((await stock()).version).toBe(4);
      });

      it('releases an unpaid reservation once and permits a replacement order without deleting usage history', async () => {
        await campaign();
        const created = await discounted();
        await discounted();
        await discounted();
        await orders.cancelOrder(userId, created.orderId);
        await orders.cancelOrder(userId, created.orderId);
        expect(await usage(created.orderId)).toMatchObject({
          status: 'RELEASED',
          usedAt: null,
          releasedAt: expect.any(Date),
        });
        await discounted();
        expect(await database.getRepository(VoucherUsage).count()).toBe(4);
        expect(
          await database
            .getRepository(VoucherUsage)
            .countBy({ status: 'RESERVED' }),
        ).toBe(3);
        expect(await points()).toBe(0);
        expect((await stock()).quantity).toBe(940);
      });

      it('hides fully used vouchers, restores one use and reverses points on internal approved PAID cancellation', async () => {
        await campaign();
        const ids: string[] = [];
        for (let index = 0; index < 3; index++) {
          const order = await discounted();
          ids.push(order.orderId);
          await pay(order.orderId);
        }
        expect(await points()).toBe(9);
        expect((await ownQuote().expect(200)).body.vouchers).toEqual([]);
        await ownQuote('REWARD3').expect(409);
        await orders.updateOrderStatus(ids[0], 'CANCELLED');
        await orders.updateOrderStatus(ids[0], 'CANCELLED');
        expect(await points()).toBe(6);
        expect(await getOrder(ids[0])).toMatchObject({
          status: 'CANCELLED',
          subtotal: 35000,
          discount: 5000,
          total: 30000,
          voucherCode: 'REWARD3',
          pointsEarned: 0,
          pointsReversed: 3,
          pointsReversedAt: expect.any(Date),
        });
        expect(await usage(ids[0])).toMatchObject({
          status: 'RELEASED',
          usedAt: expect.any(Date),
        });
        const restored = await ownQuote().expect(200);
        expect(restored.body.vouchers[0].usage).toMatchObject({
          usedUses: 2,
          availableUses: 1,
          reservedUses: 0,
        });
        expect(
          (
            await database
              .getRepository(Payment)
              .findOneByOrFail({ orderId: ids[0] })
          ).status,
        ).toBe('SUCCESS');
      });

      it('floors points after the voucher discount and exposes the balance and order audit through existing own APIs', async () => {
        await campaign({ discountValue: 30000 });
        const created = await discounted([item({ qty: 3 })]);
        expect(created.total).toBe(75000);
        await pay(created.orderId);
        const profile = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(profile.body.loyaltyPoints).toBe(7);
        const detail = await request(app.getHttpServer())
          .get(`/orders/${created.orderId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(detail.body).toMatchObject({
          benefitsPolicyVersion: 1,
          pointsEarned: 7,
          pointsReversed: 0,
        });
        expect(detail.body.pointsAwardedAt).toBeTruthy();
        await orders.updateOrderStatus(created.orderId, 'CANCELLED');
        expect(await points()).toBe(0);
        expect((await getOrder(created.orderId)).pointsReversed).toBe(7);
      });

      it('records zero-point settlement and reversal markers without repeating rewards', async () => {
        await campaign({ discountValue: 30000 });
        const created = await discounted();
        expect(created.total).toBe(5000);
        const payment = await pay(created.orderId);
        const before = await getOrder(created.orderId);
        expect(before.pointsEarned).toBe(0);
        expect(before.pointsAwardedAt).toBeInstanceOf(Date);
        await staffReview(payment.paymentId);
        expect(
          (await getOrder(created.orderId)).pointsAwardedAt?.getTime(),
        ).toBe(before.pointsAwardedAt?.getTime());
        await orders.updateOrderStatus(created.orderId, 'CANCELLED');
        expect(
          (await getOrder(created.orderId)).pointsReversedAt,
        ).toBeInstanceOf(Date);
        expect(await points()).toBe(0);
      });

      it('atomically adds and reverses points for many different orders belonging to the same user', async () => {
        await database
          .getRepository(User)
          .update(userId, { loyaltyPoints: 12 });
        const created: string[] = [];
        for (let index = 0; index < 10; index++)
          created.push((await create()).orderId);
        await Promise.all(created.map((id) => pay(id)));
        expect(await points()).toBe(42);
        await Promise.all(
          created
            .slice(0, 5)
            .map((id) => orders.updateOrderStatus(id, 'CANCELLED')),
        );
        expect(await points()).toBe(27);
        expect((await stock()).quantity).toBe(900);
        expect(await database.getRepository(VoucherUsage).count()).toBe(0);
      });

      it('returns reported, failed and pending uses exactly once when expiry workers race', async () => {
        await campaign();
        const created = await Promise.all([
          discounted(),
          discounted(),
          discounted(),
        ]);
        // A payment session without money: expires like an unpaid order
        await payments.createPayment(
          userId,
          { orderId: created[0].orderId, method: 'WALLET' },
          randomUUID(),
        );
        const failed = await payments.createPayment(
          userId,
          { orderId: created[1].orderId, method: 'CARD' },
          randomUUID(),
        );
        await staffReview(failed.paymentId, 'FAILED');
        for (const order of created) await expire(order.orderId);
        await Promise.all([
          orders.expireUnpaidOrders(),
          orders.expireUnpaidOrders(),
        ]);
        await Promise.all(
          created.map((order) => orders.cancelOrder(userId, order.orderId)),
        );
        expect(
          await database
            .getRepository(VoucherUsage)
            .countBy({ status: 'RELEASED' }),
        ).toBe(3);
        expect(
          (await ownQuote().expect(200)).body.vouchers[0].usage.availableUses,
        ).toBe(3);
        expect((await stock()).quantity).toBe(1000);
        expect((await stock()).version).toBe(7);
        expect(await points()).toBe(0);
      });

      it('rolls back order, stock and account rows if persisting a reservation fails', async () => {
        await campaign();
        await database.query(
          `ALTER TABLE voucher_usages ADD CONSTRAINT rewards_reject_reservation CHECK (status <> 'RESERVED')`,
        );
        try {
          await expect(discounted()).rejects.toMatchObject({
            driverError: { code: '23514' },
          });
          expect(await database.getRepository(Order).count()).toBe(0);
          expect(await database.getRepository(VoucherUserQuota).count()).toBe(
            0,
          );
          expect((await stock()).quantity).toBe(1000);
        } finally {
          await database.query(
            'ALTER TABLE voucher_usages DROP CONSTRAINT rewards_reject_reservation',
          );
        }
        await discounted();
        expect(await database.getRepository(VoucherUsage).count()).toBe(1);
      });

      it('rolls back points, voucher usage and PAID together if saving the payment result fails', async () => {
        await campaign();
        const created = await discounted();
        const payment = await payments.createPayment(
          userId,
          { orderId: created.orderId, method: 'CARD' },
          randomUUID(),
        );
        await database.query(
          `ALTER TABLE payments ADD CONSTRAINT rewards_reject_success CHECK (status <> 'SUCCESS')`,
        );
        try {
          await expect(staffReview(payment.paymentId)).rejects.toThrow();
          expect((await getOrder(created.orderId)).status).toBe('PENDING');
          expect((await usage(created.orderId)).status).toBe('RESERVED');
          expect(await points()).toBe(0);
          expect((await getOrder(created.orderId)).pointsAwardedAt).toBeNull();
        } finally {
          await database.query(
            'ALTER TABLE payments DROP CONSTRAINT rewards_reject_success',
          );
        }
        await staffReview(payment.paymentId);
        expect(await points()).toBe(3);
        expect((await usage(created.orderId)).status).toBe('USED');
      });

      it('rolls back stock and voucher release when a corrupted points balance cannot be reversed', async () => {
        await campaign();
        const created = await discounted();
        await pay(created.orderId);
        await database.getRepository(User).update(userId, { loyaltyPoints: 0 });
        await expect(
          orders.updateOrderStatus(created.orderId, 'CANCELLED'),
        ).rejects.toThrow('Số dư điểm');
        expect((await getOrder(created.orderId)).status).toBe('PAID');
        expect((await usage(created.orderId)).status).toBe('USED');
        expect((await stock()).quantity).toBe(980);
        await database.getRepository(User).update(userId, { loyaltyPoints: 3 });
        await orders.updateOrderStatus(created.orderId, 'CANCELLED');
        expect(await points()).toBe(0);
      });

      it('honors the existing order snapshot after the campaign expires and never extends the campaign on release', async () => {
        await campaign();
        const created = await discounted();
        await database.query(
          `UPDATE vouchers SET "endsAt"=clock_timestamp()-interval '1 second' WHERE code='REWARD3'`,
        );
        await pay(created.orderId);
        expect(await points()).toBe(3);
        await orders.updateOrderStatus(created.orderId, 'CANCELLED');
        expect((await ownQuote().expect(200)).body.vouchers).toEqual([]);
        await ownQuote('REWARD3').expect(400);
        expect(await getOrder(created.orderId)).toMatchObject({
          subtotal: 35000,
          discount: 5000,
          total: 30000,
        });
      });

      it('supports a one-use campaign and isolates limits between accounts despite client-supplied userId', async () => {
        await campaign({ maxUsesPerUser: 1 });
        const created = await discounted();
        await pay(created.orderId);
        await expect(discounted()).rejects.toThrow('dùng hết');
        const other = await database.getRepository(User).save({
          email: `${randomUUID()}@other-rewards.test`,
          passwordHash: 'not-used',
          loyaltyPoints: 0,
        });
        const otherToken = app
          .get(JwtService)
          .sign({ sub: other.id, email: other.email, role: 'CUSTOMER' });
        const preview = await request(app.getHttpServer())
          .post('/vouchers/quote')
          .set('Authorization', `Bearer ${otherToken}`)
          .send({ items: [item()], userId })
          .expect(200);
        expect(preview.body.vouchers[0].usage.availableUses).toBe(1);
        await orders.createOrder(other.id, {
          items: [item()],
          voucherCode: 'REWARD3',
        });
        expect(await database.getRepository(VoucherUsage).count()).toBe(2);
      });

      it('does not award or claw back benefits for legacy orders created before the policy cutover', async () => {
        const created = await create();
        await database
          .getRepository(Order)
          .update(created.orderId, { benefitsPolicyVersion: 0 });
        await database.getRepository(User).update(userId, { loyaltyPoints: 9 });
        await pay(created.orderId);
        expect(await points()).toBe(9);
        expect((await getOrder(created.orderId)).pointsAwardedAt).toBeNull();
        await orders.updateOrderStatus(created.orderId, 'CANCELLED');
        expect(await points()).toBe(9);
        expect((await stock()).quantity).toBe(1000);
      });

      it('rechecks campaign expiry after waiting for the account lock and rolls back the order', async () => {
        await campaign({ endsAt: new Date(Date.now() + 3000) });
        await database
          .getRepository(VoucherUserQuota)
          .insert({ userId, voucherCode: 'REWARD3' });
        const runner = database.createQueryRunner();
        await runner.connect();
        await runner.startTransaction();
        await runner.manager.getRepository(VoucherUserQuota).findOneOrFail({
          where: { userId, voucherCode: 'REWARD3' },
          lock: { mode: 'pessimistic_write' },
        });
        const pending = discounted().then(
          (value) => ({ value, error: null }),
          (error: unknown) => ({ value: null, error }),
        );
        try {
          let waiting = false;
          for (let attempt = 0; attempt < 60; attempt++) {
            const [state] = await database.query<Array<{ waiting: boolean }>>(
              `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%voucher_user_quotas%') AS waiting`,
            );
            if (state.waiting) {
              waiting = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
          expect(waiting).toBe(true);
          await database.query(
            `SELECT pg_sleep(GREATEST(0, EXTRACT(EPOCH FROM ("endsAt"-clock_timestamp())))::double precision + 0.05) FROM vouchers WHERE code='REWARD3'`,
          );
        } finally {
          await runner.rollbackTransaction();
          await runner.release();
        }
        const result = await pending;
        expect(result.value).toBeNull();
        expect(result.error).toBeInstanceOf(Error);
        expect(await database.getRepository(Order).count()).toBe(0);
        expect(await database.getRepository(VoucherUsage).count()).toBe(0);
        expect((await stock()).quantity).toBe(1000);
      }, 15000);

      it('does not revoke already reserved uses when the campaign limit is lowered', async () => {
        await campaign();
        const first = await discounted();
        const second = await discounted();
        await database
          .getRepository(Voucher)
          .update('REWARD3', { maxUsesPerUser: 1 });
        await expect(discounted()).rejects.toThrow('đang giữ');
        await pay(first.orderId);
        await pay(second.orderId);
        expect(await points()).toBe(6);
        expect(
          await database
            .getRepository(VoucherUsage)
            .countBy({ status: 'USED' }),
        ).toBe(2);
        expect((await ownQuote().expect(200)).body.vouchers).toEqual([]);
      });
    });

    describe('staff confirmation integration', () => {
      it('filters expired sessions before the 100-row limit so new live payments stay visible', async () => {
        await database.query(
          `INSERT INTO orders (id, "userId", status, total, subtotal, "expiresAt") SELECT 'STALE-' || n, $1, 'PENDING', 35000, 35000, now() - interval '1 hour' FROM generate_series(1,100) n`,
          [userId],
        );
        await database.query(
          `INSERT INTO payments (id, "orderId", "userId", "idempotencyKey", amount, method, status, "createdAt") SELECT 'STALE-PAY-' || n, 'STALE-' || n, $1, 'STALE-KEY-' || n, 35000, 'CARD', 'PENDING', now() - interval '1 day' FROM generate_series(1,100) n`,
          [userId],
        );
        const order = await create();
        const payment = await payments.createPayment(
          userId,
          { orderId: order.orderId, method: 'CARD' },
          randomUUID(),
        );
        const active = await payments.listForAdmin({ status: 'ACTIVE' });
        expect(active.map((row) => row.paymentId)).toEqual([payment.paymentId]);
      });
      // Ngân hàng giả lập: public, opened by scanning the QR on a phone
      const report = (id: string) =>
        request(app.getHttpServer()).post(`/mock-bank/payments/${id}/transfer`);
      const review = (id: string, decision = 'confirm', jwt = adminToken) =>
        request(app.getHttpServer())
          .post(`/admin/payments/${id}/${decision}`)
          .set('Authorization', `Bearer ${jwt}`)
          .send({ note: 'Đã đối chiếu tại quầy' });

      it('only staff may confirm; a mock bank transfer is replay-safe and does not pay or change inventory', async () => {
        const order = await create();
        const payment = await payments.createPayment(
          userId,
          { orderId: order.orderId, method: 'WALLET' },
          randomUUID(),
        );
        const info = await request(app.getHttpServer())
          .get(`/mock-bank/payments/${payment.paymentId}`)
          .expect(200);
        expect(info.body).toMatchObject({
          amount: order.total,
          transferContent: order.orderId,
          status: 'PENDING',
        });
        const first = await report(payment.paymentId).expect(200);
        expect(first.body).toMatchObject({
          status: 'TRANSFER_RECEIVED',
          orderStatus: 'PENDING',
        });
        const repeated = await report(payment.paymentId).expect(200);
        expect(repeated.body.receivedAt).toBe(first.body.receivedAt);
        expect(await statement(order.orderId)).toHaveLength(1);
        await request(app.getHttpServer())
          .get('/admin/bank-transactions')
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
        const ledger = await request(app.getHttpServer())
          .get(`/admin/bank-transactions?orderId=${order.orderId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(ledger.body).toEqual([
          expect.objectContaining({ type: 'IN', amount: order.total }),
        ]);
        await review(payment.paymentId, 'confirm', token).expect(403);
        await request(app.getHttpServer())
          .get('/admin/payments')
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
        await request(app.getHttpServer())
          .post('/payments/callback')
          .send({ paymentId: payment.paymentId, result: 'SUCCESS' })
          .expect(404);
        await request(app.getHttpServer())
          .get(`/mock-gateway/${payment.paymentId}`)
          .expect(404);
        expect((await stock()).version).toBe(2);
        expect((await getOrder(order.orderId)).status).toBe('PENDING');
        await review(payment.paymentId).expect(200);
        const saved = await database
          .getRepository(Payment)
          .findOneByOrFail({ id: payment.paymentId });
        expect(saved.reviewedBy).toBe(adminId);
        expect(saved.reviewedAt).toBeInstanceOf(Date);
        expect((await stock()).version).toBe(2);
      });

      it('keeps one active payment with many keys, with immutable key payloads even after method changes', async () => {
        const order = await create();
        const keys = Array.from({ length: 12 }, () => randomUUID());
        const sessions = await Promise.all(
          keys.map((key) =>
            payments.createPayment(
              userId,
              { orderId: order.orderId, method: 'WALLET' },
              key,
            ),
          ),
        );
        expect(new Set(sessions.map((p) => p.paymentId)).size).toBe(1);
        expect(await database.getRepository(PaymentRequestKey).count()).toBe(
          12,
        );
        const changed = await payments.createPayment(
          userId,
          { orderId: order.orderId, method: 'CARD' },
          randomUUID(),
        );
        expect(changed.paymentId).toBe(sessions[0].paymentId);
        const replay = await payments.createPayment(
          userId,
          { orderId: order.orderId, method: 'WALLET' },
          keys[11],
        );
        expect(replay.method).toBe('CARD');
        await expect(
          payments.createPayment(
            userId,
            { orderId: order.orderId, method: 'CARD' },
            keys[11],
          ),
        ).rejects.toThrow('Idempotency-Key');
        const other = await create();
        await expect(
          payments.createPayment(
            userId,
            { orderId: other.orderId, method: 'WALLET' },
            keys[11],
          ),
        ).rejects.toThrow('Idempotency-Key');
        expect(await database.getRepository(Payment).count()).toBe(1);
      });

      it('credits a payment once for concurrent mock bank transfers and refunds once for concurrent rejections', async () => {
        const order = await create();
        const payment = await payments.createPayment(
          userId,
          { orderId: order.orderId, method: 'WALLET' },
          randomUUID(),
        );
        const transfers = await Promise.all(
          Array.from({ length: 8 }, () => report(payment.paymentId)),
        );
        transfers.forEach((response) => expect(response.status).toBe(200));
        expect(await statement(order.orderId)).toHaveLength(1);
        await Promise.all([
          review(payment.paymentId, 'reject'),
          review(payment.paymentId, 'reject'),
        ]);
        expect(
          (await statement(order.orderId)).map((row) => [row.type, row.amount]),
        ).toEqual([
          ['IN', order.total],
          ['REFUND', order.total],
        ]);
        expect((await getOrder(order.orderId)).status).toBe('PAYMENT_FAILED');
      });

      it.each(['report', 'confirm', 'reject'])(
        'commits timeout cancellation and ingredient refund on expired %s',
        async (action) => {
          const order = await create();
          const payment = await payments.createPayment(
            userId,
            { orderId: order.orderId, method: 'WALLET' },
            randomUUID(),
          );
          await expire(order.orderId);
          if (action === 'report') await report(payment.paymentId).expect(400);
          else await review(payment.paymentId, action).expect(400);
          expect((await getOrder(order.orderId)).status).toBe('CANCELLED');
          expect((await stock()).quantity).toBe(1000);
          expect((await stock()).version).toBe(3);
          await review(payment.paymentId).expect(400);
          expect((await stock()).version).toBe(3);
        },
      );

      it('hides expired/cancelled payments from ACTIVE and retains them under ALL', async () => {
        const order = await create();
        const payment = await payments.createPayment(
          userId,
          { orderId: order.orderId, method: 'CARD' },
          randomUUID(),
        );
        await expire(order.orderId);
        expect(await payments.listForAdmin({ status: 'ACTIVE' })).toEqual([]);
        expect(
          (await payments.listForAdmin({ status: 'ALL' }))[0].paymentId,
        ).toBe(payment.paymentId);
        await orders.expireUnpaidOrders();
        expect(await payments.listForAdmin({ status: 'ACTIVE' })).toEqual([]);
      });
    });
  },
);
