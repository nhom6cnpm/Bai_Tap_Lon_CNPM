import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { ConfigService } from '@nestjs/config';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase('AppController (e2e, dedicated test database)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    if (!new URL(databaseUrl!).pathname.endsWith('_test')) {
      throw new Error(
        'TEST_DATABASE_URL must point to a dedicated database ending in _test',
      );
    }
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          DATABASE_URL: databaseUrl,
          JWT_SECRET: 'task10-smoke-test-jwt',
          PAYMENT_GATEWAY_SECRET: 'task10-smoke-test-gateway',
          NODE_ENV: 'production',
        }),
      )
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello BrewLite!');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
