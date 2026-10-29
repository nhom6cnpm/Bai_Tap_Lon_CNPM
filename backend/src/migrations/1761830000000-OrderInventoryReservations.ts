import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderInventoryReservations1761830000000 implements MigrationInterface {
  name = 'OrderInventoryReservations1761830000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN "expiresAt" timestamptz,
        ADD COLUMN "inventoryReservedAt" timestamptz,
        ADD COLUMN "inventoryReleasedAt" timestamptz,
        ADD COLUMN "cancelledAt" timestamptz,
        ADD COLUMN "cancelReason" varchar(32)
    `);
    // Existing Docker deployments store the legacy createdAt timestamp in UTC.
    // Old orders have no reservation: expiry/cancellation must not invent a refund.
    await queryRunner.query(`
      UPDATE "orders" SET "expiresAt" =
        ("createdAt" AT TIME ZONE 'UTC') + INTERVAL '5 minutes'
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ALTER COLUMN "expiresAt" SET NOT NULL,
        ALTER COLUMN "expiresAt" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes')
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_orders_unpaid_expiry" ON "orders" ("expiresAt", "id")
      WHERE "status" IN ('PENDING', 'PAYMENT_FAILED')
    `);
    await queryRunner.query(`
      CREATE TABLE "order_ingredient_reservations" (
        "orderId" varchar(64) NOT NULL,
        "ingredientId" varchar(64) NOT NULL,
        "amount" integer NOT NULL,
        CONSTRAINT "PK_order_ingredient_reservations" PRIMARY KEY ("orderId", "ingredientId"),
        CONSTRAINT "CHK_order_reservation_amount" CHECK ("amount" > 0),
        CONSTRAINT "FK_order_reservation_order" FOREIGN KEY ("orderId")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_reservation_ingredient" FOREIGN KEY ("ingredientId")
          REFERENCES "ingredients"("id") ON DELETE RESTRICT
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "order_ingredient_reservations"');
    await queryRunner.query('DROP INDEX "IDX_orders_unpaid_expiry"');
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN "expiresAt", DROP COLUMN "inventoryReservedAt",
        DROP COLUMN "inventoryReleasedAt", DROP COLUMN "cancelledAt", DROP COLUMN "cancelReason"
    `);
  }
}
