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
import { Payment } from '../src/payments/entities/payment.entity';
import { PaymentsService } from '../src/payments/payments.service';
import { Product } from '../src/products/product.entity';

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
    const callback = (
      paymentId: string,
      result: 'SUCCESS' | 'FAILED' = 'SUCCESS',
    ) =>
      payments.processCallback({
        paymentId,
        result,
        signature: payments.generateSignature(paymentId, result),
      });

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
          OrderInventoryReservation,
        ],
        migrations: [
          InitialSchema1761580800000,
          AddInventory1761650000000,
          AddPayments1761750000000,
          OrderInventoryReservations1761830000000,
          OrderItemDisplaySnapshot1761840000000,
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
            PAYMENT_GATEWAY_SECRET: 'task10-database-test-gateway',
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
        'TRUNCATE order_ingredient_reservations, order_items, payments, orders, users CASCADE',
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
      token = app.get(JwtService).sign({ sub: user.id, email: user.email });
    });

    afterAll(async () => {
      if (app) await app.close();
      if (database?.isInitialized) await database.destroy();
    });

    it('deducts size/topping quantities, stores their snapshot and returns a five-minute deadline', async () => {
      const created = await create([
        item({ size: 'L', toppingIds: ['cream'], qty: 2 }),
      ]);
      expect((await stock()).quantity).toBe(940);
      expect((await stock('condensed-milk')).quantity).toBe(910);
      expect((await stock('cream')).quantity).toBe(960);
      expect((await stock()).version).toBe(2);
      expect(created.expiresAt.getTime() - created.createdAt.getTime()).toBe(
        300000,
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
      await callback(first.paymentId, 'FAILED');
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
      await callback(second.paymentId);
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

    it('rejects a late SUCCESS callback while committing the refund', async () => {
      const created = await create();
      const payment = await payments.createPayment(
        userId,
        { orderId: created.orderId, method: 'WALLET' },
        randomUUID(),
      );
      await expire(created.orderId);
      await expect(callback(payment.paymentId)).rejects.toThrow(
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
      ).toBe('PENDING');
    });

    it('serializes a callback racing with expiry so a cancelled order cannot become PAID', async () => {
      const created = await create();
      const payment = await payments.createPayment(
        userId,
        { orderId: created.orderId, method: 'CARD' },
        randomUUID(),
      );
      await expire(created.orderId);
      await Promise.allSettled([
        callback(payment.paymentId),
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
      await callback(payment.paymentId);
      await expire(created.orderId);
      expect(await orders.expireUnpaidOrders()).toBe(0);
      expect((await getOrder(created.orderId)).status).toBe('PAID');
      expect((await stock()).quantity).toBe(980);
    });

    it('checks the deadline after obtaining the lock, even if the callback arrived before expiry', async () => {
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
        const result = callback(payment.paymentId).then(
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

    it('does not run duplicate successful callbacks or deduct stock a second time', async () => {
      const created = await create();
      const payment = await payments.createPayment(
        userId,
        { orderId: created.orderId, method: 'CARD' },
        randomUUID(),
      );
      const results = await Promise.all(
        Array.from({ length: 8 }, () => callback(payment.paymentId)),
      );
      expect(
        results.filter((r) => r.message === 'Xử lý callback thành công'),
      ).toHaveLength(1);
      expect((await stock()).quantity).toBe(980);
      expect((await stock()).version).toBe(2);
      expect((await getOrder(created.orderId)).status).toBe('PAID');
    });

    it('allows the state-machine cancellation of PAID and returns stock once', async () => {
      const created = await create();
      await orders.updateOrderStatus(created.orderId, 'PAID');
      await orders.cancelOrder(userId, created.orderId);
      await orders.cancelOrder(userId, created.orderId);
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
      await database.undoLastMigration();
      await database.undoLastMigration();
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
      expect(await database.getRepository(User).count()).toBe(1);
    });

    it('reserves a still-valid legacy order on payment without extending its original deadline', async () => {
      await database.query(
        `INSERT INTO orders (id, "userId", status, total)
      VALUES ('LEGACY-VALID', $1, 'PAYMENT_FAILED', 35000)`,
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
      await callback(payment.paymentId);
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
        ).toBe(300000);
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
        await callback(payment.paymentId);
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
        await database.undoLastMigration();
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

    describe('Task 10d payment idempotency', () => {
      const checkout = (orderId: string, key: string, method = 'WALLET') =>
        request(app.getHttpServer())
          .post('/payments')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', key)
          .send({ orderId, method });
      const signedCallback = (
        paymentId: string,
        result: 'SUCCESS' | 'FAILED',
      ) =>
        request(app.getHttpServer())
          .post('/payments/callback')
          .send({
            paymentId,
            result,
            signature: payments.generateSignature(paymentId, result),
          });

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
          await signedCallback(first.body.paymentId, 'SUCCESS').expect(201);
          if (status === 'CANCELLED')
            await orders.cancelOrder(userId, created.orderId);
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
            gatewayUrl: first.body.gatewayUrl,
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
        await signedCallback(first.body.paymentId, 'FAILED').expect(201);
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

      it('replays an expired attempt without creating another payment or restoring the five-minute window', async () => {
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
        await signedCallback(first.body.paymentId, 'SUCCESS').expect(400);
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

      it('serializes mixed success/failure callbacks and acknowledges only the first outcome', async () => {
        const created = await create();
        const first = await checkout(created.orderId, randomUUID()).expect(201);
        const responses = await Promise.all(
          Array.from({ length: 10 }, (_, index) =>
            signedCallback(
              first.body.paymentId,
              index % 2 ? 'FAILED' : 'SUCCESS',
            ),
          ),
        );
        expect(responses.every((response) => response.status === 201)).toBe(
          true,
        );
        expect(
          new Set(responses.map((response) => response.body.status)).size,
        ).toBe(1);
        expect(
          responses.filter(
            (response) => response.body.message === 'Xử lý callback thành công',
          ),
        ).toHaveLength(1);
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
          await signedCallback(first.body.paymentId, 'SUCCESS').expect(500);
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
        await signedCallback(first.body.paymentId, 'SUCCESS').expect(201);
        expect((await getOrder(created.orderId)).status).toBe('PAID');
      });

      it('does not let a callback from an older failed attempt undo a successful retry', async () => {
        const created = await create();
        const first = await checkout(created.orderId, randomUUID()).expect(201);
        await signedCallback(first.body.paymentId, 'FAILED').expect(201);
        const second = await checkout(
          created.orderId,
          randomUUID(),
          'CARD',
        ).expect(201);
        await signedCallback(second.body.paymentId, 'SUCCESS').expect(201);
        const late = await signedCallback(
          first.body.paymentId,
          'FAILED',
        ).expect(201);
        expect(late.body.status).toBe('FAILED');
        expect((await getOrder(created.orderId)).status).toBe('PAID');
        expect((await stock()).version).toBe(2);
      });

      it('serializes successful callbacks racing with cancellation and refunds at most once', async () => {
        const created = await create();
        const first = await checkout(created.orderId, randomUUID()).expect(201);
        await Promise.allSettled([
          callback(first.body.paymentId),
          orders.cancelOrder(userId, created.orderId),
          orders.cancelOrder(userId, created.orderId),
        ]);
        expect((await getOrder(created.orderId)).status).toBe('CANCELLED');
        expect((await stock()).quantity).toBe(1000);
        expect((await stock()).version).toBe(3);
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
  },
);
