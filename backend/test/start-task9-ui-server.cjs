const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { DataSource } = require('typeorm');

async function start() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!url.pathname.endsWith('_ui_test'))
    throw new Error('UI test server requires a dedicated _ui_test database');
  const { AppModule } = require('../dist/app.module');
  const app = await NestFactory.create(AppModule, { logger: false });
  const database = app.get(DataSource);
  const [actual] = await database.query('SELECT current_database() AS name');
  if (!actual.name.endsWith('_ui_test')) {
    await app.close();
    throw new Error('Refusing to reset a non-test database');
  }
  await database.query(
    'TRUNCATE order_ingredient_reservations, order_items, payments, orders, users CASCADE',
  );
  await database.query('UPDATE ingredients SET quantity = 10000, version = 1');
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({ origin: 'http://127.0.0.1:3200' });
  app.enableShutdownHooks();
  await app.listen(3201, '127.0.0.1');
  process.stdout.write('Task 9 UI test API ready on 3201\n');
}
start().catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
