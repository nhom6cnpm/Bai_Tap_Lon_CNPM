import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderHistory1792627200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar NOT NULL UNIQUE,
        "passwordHash" varchar NOT NULL, "loyaltyPoints" integer NOT NULL DEFAULT 0
      );
      CREATE TABLE orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code varchar NOT NULL UNIQUE,
        "userId" uuid NOT NULL REFERENCES users(id),
        status varchar NOT NULL DEFAULT 'PENDING' CHECK (status IN
          ('PENDING','PAID','PAYMENT_FAILED','PREPARING','READY','COMPLETED','CANCELLED')),
        total integer NOT NULL CHECK (total >= 0), "pickupCode" varchar,
        "paymentMethod" varchar, "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "IDX_orders_user_created" ON orders ("userId", "createdAt" DESC);
      CREATE TABLE order_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "orderId" uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        "productId" varchar NOT NULL, name varchar NOT NULL, size varchar NOT NULL,
        toppings text NOT NULL DEFAULT '[]', qty integer NOT NULL CHECK (qty > 0),
        "lineTotal" integer NOT NULL CHECK ("lineTotal" >= 0)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE order_items; DROP TABLE orders; DROP TABLE users;',
    );
  }
}
