import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVouchers1761850000000 implements MigrationInterface {
  name = 'AddVouchers1761850000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE vouchers (
      code varchar(32) PRIMARY KEY CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
      title varchar(160) NOT NULL,
      "discountType" varchar(16) NOT NULL CHECK ("discountType" IN ('FIXED', 'PERCENT')),
      "discountValue" integer NOT NULL CHECK ("discountValue" > 0 AND ("discountType" <> 'PERCENT' OR "discountValue" <= 100)),
      "minSubtotal" integer NOT NULL DEFAULT 0 CHECK ("minSubtotal" >= 0),
      "maxDiscount" integer CHECK ("maxDiscount" > 0),
      "startsAt" timestamptz NOT NULL,
      "endsAt" timestamptz NOT NULL CHECK ("endsAt" > "startsAt"),
      "isActive" boolean NOT NULL DEFAULT false,
      "isPublic" boolean NOT NULL DEFAULT true
    )`);
    await queryRunner.query(
      `ALTER TABLE orders ADD COLUMN subtotal integer, ADD COLUMN discount integer NOT NULL DEFAULT 0, ADD COLUMN "voucherCode" varchar(32), ADD COLUMN "voucherTitle" varchar(160)`,
    );
    await queryRunner.query('UPDATE orders SET subtotal = total');
    await queryRunner.query(
      `ALTER TABLE orders ALTER COLUMN subtotal SET NOT NULL, ADD CONSTRAINT orders_discount_totals CHECK (subtotal >= 0 AND discount >= 0 AND discount <= subtotal AND total = subtotal - discount)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders DROP CONSTRAINT orders_discount_totals, DROP COLUMN subtotal, DROP COLUMN discount, DROP COLUMN "voucherCode", DROP COLUMN "voucherTitle"`,
    );
    await queryRunner.query('DROP TABLE vouchers');
  }
}
