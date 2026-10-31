import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task 8 — ngân hàng giả lập:
 * - bank_transactions: sao kê tài khoản của quán (IN = tiền vào, REFUND = hoàn tiền)
 * - payments: CUSTOMER_REPORTED → TRANSFER_RECEIVED (tiền đã về, do ngân hàng
 *   giả lập ghi nhận thay cho nút "Tôi đã chuyển tiền"); reportedAt → receivedAt
 * - Backfill IN rows so that every PAID order and every TRANSFER_RECEIVED
 *   payment has its money on the statement, and cancelling it later refunds it.
 */
export class MockBankLedger1761890000000 implements MigrationInterface {
  name = 'MockBankLedger1761890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bank_transactions" (
        "id" character varying(64) NOT NULL,
        "type" character varying(16) NOT NULL,
        "amount" integer NOT NULL,
        "orderId" character varying(64) NOT NULL,
        "paymentId" character varying(64),
        "content" character varying(255) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bank_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_bank_transactions_type" CHECK ("type" IN ('IN', 'REFUND')),
        CONSTRAINT "CHK_bank_transactions_amount" CHECK ("amount" > 0),
        CONSTRAINT "FK_bank_transactions_order" FOREIGN KEY ("orderId")
          REFERENCES "orders"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_bank_transactions_orderId" ON "bank_transactions" ("orderId")`,
    );
    // A payment is credited at most once
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bank_transactions_payment_in" ON "bank_transactions" ("paymentId") WHERE "type" = 'IN'`,
    );

    await queryRunner.query(
      `ALTER TABLE "payments" RENAME COLUMN "reportedAt" TO "receivedAt"`,
    );
    await queryRunner.query(
      `UPDATE "payments" SET "status" = 'TRANSFER_RECEIVED', "receivedAt" = COALESCE("receivedAt", "updatedAt") WHERE "status" = 'CUSTOMER_REPORTED'`,
    );

    // Money already received before the ledger existed
    await queryRunner.query(`
      INSERT INTO "bank_transactions" ("id", "type", "amount", "orderId", "paymentId", "content", "createdAt")
      SELECT 'TXN-MIG-' || p."id", 'IN', p."amount", p."orderId", p."id",
             CASE WHEN p."method" = 'CARD' THEN 'Quẹt thẻ tại quầy ' ELSE '' END || p."orderId",
             COALESCE(p."receivedAt", p."reviewedAt", p."updatedAt")
        FROM "payments" p
        JOIN "orders" o ON o."id" = p."orderId"
       WHERE p."amount" > 0
         AND (p."status" = 'TRANSFER_RECEIVED'
              OR (p."status" = 'SUCCESS' AND o."status" <> 'CANCELLED'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "payments" SET "status" = 'CUSTOMER_REPORTED' WHERE "status" = 'TRANSFER_RECEIVED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" RENAME COLUMN "receivedAt" TO "reportedAt"`,
    );
    await queryRunner.query(`DROP TABLE "bank_transactions"`);
  }
}
