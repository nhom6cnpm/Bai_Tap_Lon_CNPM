import { MigrationInterface, QueryRunner } from 'typeorm';

// Task 10 (b): POST /orders gửi 2 lần cùng Idempotency-Key chỉ tạo 1 đơn
export class OrderRequestKeys1761900000000 implements MigrationInterface {
  name = 'OrderRequestKeys1761900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "order_request_keys" (
        "userId" character varying(64) NOT NULL,
        "idempotencyKey" character varying(128) NOT NULL,
        "orderId" character varying(64) NOT NULL,
        "requestHash" character varying(64) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_order_request_keys" PRIMARY KEY ("userId", "idempotencyKey"),
        -- Checked at COMMIT: the key is claimed before the order row exists
        CONSTRAINT "FK_order_request_keys_order" FOREIGN KEY ("orderId")
          REFERENCES "orders"("id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_request_keys_orderId" ON "order_request_keys" ("orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_request_keys"`);
  }
}
