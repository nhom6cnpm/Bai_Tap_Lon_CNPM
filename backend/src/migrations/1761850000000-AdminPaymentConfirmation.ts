import { MigrationInterface, QueryRunner } from 'typeorm';

// Task 8 (cập nhật 30/10): nhân viên (ADMIN) xác nhận thanh toán thay cho cổng giả lập
export class AdminPaymentConfirmation1761850000000 implements MigrationInterface {
  name = 'AdminPaymentConfirmation1761850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" character varying(16) NOT NULL DEFAULT 'CUSTOMER'`,
    );

    // CUSTOMER_REPORTED does not fit in varchar(16)
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "status" TYPE character varying(32)`,
    );
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "gatewayUrl"`);
    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD "reportedAt" TIMESTAMP WITH TIME ZONE,
        ADD "reviewedAt" TIMESTAMP WITH TIME ZONE,
        ADD "reviewedBy" character varying(64),
        ADD "reviewNote" character varying(255)
    `);
    // createdAt/updatedAt are filled by now() on the DB server (UTC) but a
    // plain TIMESTAMP is read back in the backend's local time zone (+7 when
    // run on a dev machine): store them with the time zone instead
    await queryRunner.query(`
      ALTER TABLE "payments"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP WITH TIME ZONE USING "createdAt" AT TIME ZONE 'UTC',
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP WITH TIME ZONE USING "updatedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_status" ON "payments" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_payments_status"`);
    await queryRunner.query(`
      ALTER TABLE "payments"
        ALTER COLUMN "createdAt" TYPE TIMESTAMP USING "createdAt" AT TIME ZONE 'UTC',
        ALTER COLUMN "updatedAt" TYPE TIMESTAMP USING "updatedAt" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`
      ALTER TABLE "payments"
        DROP COLUMN "reviewNote",
        DROP COLUMN "reviewedBy",
        DROP COLUMN "reviewedAt",
        DROP COLUMN "reportedAt"
    `);
    await queryRunner.query(
      `ALTER TABLE "payments" ADD "gatewayUrl" character varying(500) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `UPDATE "payments" SET "status" = 'PENDING' WHERE "status" = 'CUSTOMER_REPORTED'`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "status" TYPE character varying(16)`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
  }
}
