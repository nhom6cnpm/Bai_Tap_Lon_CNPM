import { MigrationInterface, QueryRunner } from 'typeorm';

// Task 8: payments table for the mock payment gateway
export class AddPayments1761750000000 implements MigrationInterface {
  name = 'AddPayments1761750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" character varying(64) NOT NULL,
        "orderId" character varying(64) NOT NULL,
        "userId" character varying(64) NOT NULL,
        "idempotencyKey" character varying(128) NOT NULL,
        "amount" integer NOT NULL,
        "method" character varying(16) NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'PENDING',
        "gatewayUrl" character varying(500) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "FK_payments_order" FOREIGN KEY ("orderId")
          REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_orderId" ON "payments" ("orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payments"`);
  }
}
