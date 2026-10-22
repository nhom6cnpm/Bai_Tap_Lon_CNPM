import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { OrderEntity, UserEntity } from '../src/database/entities';

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseTests = databaseUrl ? describe : describe.skip;

databaseTests('Order history with PostgreSQL and real JWT', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const suffix = randomUUID();
  const password = 'Test-BrewLite-123';
  const email = `history-${suffix}@example.test`;
  const otherEmail = `other-${suffix}@example.test`;
  let userId: string;
  let otherUserId: string;
  let token: string;
  let orderId: string;
  let foreignOrderId: string;

  async function createApp() {
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const instance = fixture.createNestApplication<INestApplication<App>>();
    instance.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await instance.init();
    return instance;
  }

  beforeAll(async () => {
    if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must point to a separate database ending in _test.',
      );
    }
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = 'order-history-integration-test-secret';
    app = await createApp();
    dataSource = app.get(DataSource);
    const first = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    userId = (first.body as { id: string }).id;
    expect(first.body).not.toHaveProperty('passwordHash');
    const second = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: otherEmail, password })
      .expect(201);
    otherUserId = (second.body as { id: string }).id;
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    token = (login.body as { access_token: string }).access_token;
    const orders = dataSource.getRepository(OrderEntity);
    const firstOrder = await orders.save(
      orders.create({
        code: `TEST-${suffix}`,
        userId,
        status: 'PAID',
        total: 35000,
        pickupCode: 'A-01',
        paymentMethod: 'WALLET',
        items: [
          {
            productId: '1',
            name: 'Cà phê sữa',
            size: 'S',
            toppings: [],
            qty: 1,
            lineTotal: 35000,
          },
        ],
      }),
    );
    orderId = firstOrder.id;
    const otherOrder = await orders.save(
      orders.create({
        code: `FOREIGN-${suffix}`,
        userId: otherUserId,
        status: 'PENDING',
        total: 40000,
        items: [],
      }),
    );
    foreignOrderId = otherOrder.id;
  }, 30000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      for (const id of [userId, otherUserId].filter(Boolean)) {
        await dataSource.getRepository(OrderEntity).delete({ userId: id });
        await dataSource.getRepository(UserEntity).delete({ id });
      }
    }
    await app?.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/orders/me').expect(401);
    await request(app.getHttpServer()).get(`/orders/${orderId}`).expect(401);
  });

  it('returns only the current user orders, snapshots and no internal user fields', async () => {
    const result = await request(app.getHttpServer())
      .get(`/orders/me?userId=${otherUserId}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(result.body).toHaveLength(1);
    expect(result.body[0]).toMatchObject({
      id: orderId,
      status: 'PAID',
      total: 35000,
      items: [{ name: 'Cà phê sữa', qty: 1 }],
    });
    expect(result.body[0]).not.toHaveProperty('userId');
    expect(result.body[0]).not.toHaveProperty('user');
  });

  it('rejects another user order without revealing its existence', async () => {
    await request(app.getHttpServer())
      .get(`/orders/${foreignOrderId}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/orders/${randomUUID()}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
  });

  it('validates order identifiers', async () => {
    await request(app.getHttpServer())
      .get('/orders/not-a-uuid')
      .auth(token, { type: 'bearer' })
      .expect(400);
  });

  it('rejects a malformed token', async () => {
    await request(app.getHttpServer())
      .get('/orders/me')
      .auth('invalid', { type: 'bearer' })
      .expect(401);
  });

  it('returns an empty history for an account without orders', async () => {
    await dataSource.getRepository(OrderEntity).delete({ userId: otherUserId });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: otherEmail, password })
      .expect(201);
    const result = await request(app.getHttpServer())
      .get('/orders/me')
      .auth((login.body as { access_token: string }).access_token, {
        type: 'bearer',
      })
      .expect(200);
    expect(result.body).toEqual([]);
  });

  it('keeps users, tokens and orders valid after restarting the application', async () => {
    await app.close();
    app = await createApp();
    dataSource = app.get(DataSource);
    const result = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(result.body).toMatchObject({ id: orderId, total: 35000 });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
  }, 30000);
});
