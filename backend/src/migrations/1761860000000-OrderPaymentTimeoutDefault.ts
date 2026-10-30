import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderPaymentTimeoutDefault1761860000000 implements MigrationInterface {
  name = 'OrderPaymentTimeoutDefault1761860000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    // Existing orders keep their original deadline; new application orders use configuration.
    await queryRunner.query(
      `ALTER TABLE orders ALTER COLUMN "expiresAt" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '15 minutes')`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE orders ALTER COLUMN "expiresAt" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes')`,
    );
  }
}
