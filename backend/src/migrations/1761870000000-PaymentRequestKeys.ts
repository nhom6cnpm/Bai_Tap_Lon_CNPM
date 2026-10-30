import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentRequestKeys1761870000000 implements MigrationInterface {
  name = 'PaymentRequestKeys1761870000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE payment_request_keys (
      id varchar(128) PRIMARY KEY,
      "paymentId" varchar(64) NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
      "orderId" varchar(64) NOT NULL,
      "userId" varchar(64) NOT NULL,
      method varchar(16) NOT NULL CHECK (method IN ('WALLET', 'CARD'))
    )`);
    await queryRunner.query(`INSERT INTO payment_request_keys (id, "paymentId", "orderId", "userId", method)
      SELECT "idempotencyKey", id, "orderId", "userId", method FROM payments`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE payment_request_keys');
  }
}
