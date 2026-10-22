import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { AuthService } from '../auth/auth.service';
import { OrderEntity, UserEntity } from './entities';

async function seedDemo() {
  if (
    process.env.ALLOW_DEMO_SEED !== 'true' ||
    (process.env.DEMO_PASSWORD?.length ?? 0) < 6
  ) {
    throw new Error(
      'Set ALLOW_DEMO_SEED=true and DEMO_PASSWORD (at least 6 characters) to seed sample orders.',
    );
  }
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const dataSource = app.get(DataSource);
    const users = dataSource.getRepository(UserEntity);
    const email = 'demo@brewlite.test';
    let user = await users.findOneBy({ email });
    if (!user) {
      await app
        .get(AuthService)
        .register({ email, password: process.env.DEMO_PASSWORD! });
      user = await users.findOneByOrFail({ email });
    }
    const orders = dataSource.getRepository(OrderEntity);
    const samples = [
      {
        code: 'DEMO-BL1042',
        status: 'PREPARING' as const,
        total: 159000,
        pickupCode: 'A-42',
        age: 0,
        items: [
          {
            productId: '3',
            name: 'Cappuccino',
            size: 'M',
            toppings: ['Kem béo'],
            qty: 2,
            lineTotal: 110000,
          },
          {
            productId: '4',
            name: 'Trà đào',
            size: 'L',
            toppings: [],
            qty: 1,
            lineTotal: 49000,
          },
        ],
      },
      {
        code: 'DEMO-BL1028',
        status: 'COMPLETED' as const,
        total: 35000,
        pickupCode: 'A-28',
        age: 1,
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
      },
      {
        code: 'DEMO-BL1015',
        status: 'PAYMENT_FAILED' as const,
        total: 40000,
        pickupCode: null,
        age: 2,
        items: [
          {
            productId: '2',
            name: 'Americano',
            size: 'S',
            toppings: [],
            qty: 1,
            lineTotal: 40000,
          },
        ],
      },
    ];
    for (const sample of samples) {
      if (await orders.existsBy({ code: sample.code })) continue;
      await orders.save(
        orders.create({
          ...sample,
          userId: user.id,
          paymentMethod: 'WALLET',
          createdAt: new Date(Date.now() - sample.age * 86400000),
        }),
      );
    }
  } finally {
    await app.close();
  }
}

void seedDemo().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
