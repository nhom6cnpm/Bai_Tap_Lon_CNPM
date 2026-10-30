import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive foundation only: legacy orders receive no retroactive benefits. */
export class BenefitsFoundation1761880000000 implements MigrationInterface {
  name = 'BenefitsFoundation1761880000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vouchers
      ADD "maxUsesPerUser" integer NOT NULL DEFAULT 3
      CONSTRAINT vouchers_max_uses_positive CHECK ("maxUsesPerUser" > 0)`);

    await queryRunner.query(`ALTER TABLE orders
      ADD "benefitsPolicyVersion" integer NOT NULL DEFAULT 0,
      ADD "pointsEarned" integer NOT NULL DEFAULT 0,
      ADD "pointsReversed" integer NOT NULL DEFAULT 0,
      ADD "pointsAwardedAt" timestamptz,
      ADD "pointsReversedAt" timestamptz,
      ADD "cancelRequestId" uuid,
      ADD "cancelRequestedAt" timestamptz,
      ADD "cancelRequestReason" varchar(500),
      ADD "cancelRequestStatus" varchar(16),
      ADD "cancelReviewedAt" timestamptz,
      ADD "cancelReviewedBy" uuid REFERENCES users(id),
      ADD "cancelReviewNote" varchar(500),
      ADD CONSTRAINT orders_benefits_policy CHECK ("benefitsPolicyVersion" IN (0, 1)),
      ADD CONSTRAINT orders_points_nonnegative CHECK ("pointsEarned" >= 0 AND "pointsReversed" >= 0),
      ADD CONSTRAINT orders_points_audit CHECK (
        ("pointsEarned" = 0 OR "pointsAwardedAt" IS NOT NULL) AND
        ("pointsReversed" = 0 OR ("pointsAwardedAt" IS NOT NULL AND "pointsReversedAt" IS NOT NULL))
      ),
      ADD CONSTRAINT orders_cancel_request_fields CHECK (
        ("cancelRequestId" IS NULL AND "cancelRequestedAt" IS NULL AND
         "cancelRequestReason" IS NULL AND "cancelRequestStatus" IS NULL AND
         "cancelReviewedAt" IS NULL AND "cancelReviewedBy" IS NULL AND "cancelReviewNote" IS NULL)
        OR
        ("cancelRequestId" IS NOT NULL AND "cancelRequestedAt" IS NOT NULL AND
         "cancelRequestReason" IS NOT NULL AND length(btrim("cancelRequestReason")) > 0 AND
         "cancelRequestStatus" IS NOT NULL AND "cancelRequestStatus" IN ('PENDING','APPROVED','REJECTED','EXPIRED') AND
         (("cancelRequestStatus" = 'PENDING' AND "cancelReviewedAt" IS NULL AND "cancelReviewedBy" IS NULL AND "cancelReviewNote" IS NULL) OR
          ("cancelRequestStatus" IN ('APPROVED','REJECTED') AND "cancelReviewedAt" IS NOT NULL AND "cancelReviewedBy" IS NOT NULL AND
           ("cancelRequestStatus" <> 'REJECTED' OR ("cancelReviewNote" IS NOT NULL AND length(btrim("cancelReviewNote")) > 0))) OR
          ("cancelRequestStatus" = 'EXPIRED' AND "cancelReviewedAt" IS NOT NULL AND "cancelReviewedBy" IS NULL)))
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_orders_cancel_request_id" ON orders ("cancelRequestId") WHERE "cancelRequestId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_pending_cancel_requests" ON orders ("cancelRequestedAt") WHERE "cancelRequestStatus" = 'PENDING'`,
    );

    await queryRunner.query(`CREATE TABLE voucher_user_quotas (
      "userId" uuid NOT NULL REFERENCES users(id),
      "voucherCode" varchar(32) NOT NULL REFERENCES vouchers(code),
      "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("userId", "voucherCode")
    )`);
    await queryRunner.query(`CREATE TABLE voucher_usages (
      "orderId" varchar(64) PRIMARY KEY REFERENCES orders(id),
      "userId" uuid NOT NULL,
      "voucherCode" varchar(32) NOT NULL,
      status varchar(16) NOT NULL DEFAULT 'RESERVED',
      "reservedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "usedAt" timestamptz,
      "releasedAt" timestamptz,
      FOREIGN KEY ("userId", "voucherCode") REFERENCES voucher_user_quotas("userId", "voucherCode"),
      CONSTRAINT voucher_usages_state CHECK (
        (status = 'RESERVED' AND "usedAt" IS NULL AND "releasedAt" IS NULL) OR
        (status = 'USED' AND "usedAt" IS NOT NULL AND "releasedAt" IS NULL) OR
        (status = 'RELEASED' AND "releasedAt" IS NOT NULL)
      )
    )`);
    await queryRunner.query(`CREATE INDEX "IDX_voucher_usages_active_account"
      ON voucher_usages ("userId", "voucherCode", status) WHERE status IN ('RESERVED', 'USED')`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Rolling back after activation would silently discard customer entitlements.
    const [state] = await queryRunner.manager.query<
      Array<{ active: boolean }>
    >(`SELECT
      EXISTS(SELECT 1 FROM voucher_usages) OR EXISTS(SELECT 1 FROM voucher_user_quotas) OR
      EXISTS(SELECT 1 FROM orders WHERE "benefitsPolicyVersion" <> 0 OR "pointsAwardedAt" IS NOT NULL OR
        "pointsReversedAt" IS NOT NULL OR "cancelRequestId" IS NOT NULL) AS active`);
    if (state.active)
      throw new Error(
        'Cannot revert benefits foundation after workflow data has been recorded',
      );
    await queryRunner.query('DROP TABLE voucher_usages');
    await queryRunner.query('DROP TABLE voucher_user_quotas');
    await queryRunner.query('DROP INDEX "IDX_orders_pending_cancel_requests"');
    await queryRunner.query('DROP INDEX "IDX_orders_cancel_request_id"');
    await queryRunner.query(`ALTER TABLE orders
      DROP CONSTRAINT orders_cancel_request_fields,
      DROP CONSTRAINT orders_points_audit,
      DROP CONSTRAINT orders_points_nonnegative,
      DROP CONSTRAINT orders_benefits_policy,
      DROP COLUMN "cancelReviewNote", DROP COLUMN "cancelReviewedBy",
      DROP COLUMN "cancelReviewedAt", DROP COLUMN "cancelRequestStatus",
      DROP COLUMN "cancelRequestReason", DROP COLUMN "cancelRequestedAt",
      DROP COLUMN "cancelRequestId", DROP COLUMN "pointsReversedAt",
      DROP COLUMN "pointsAwardedAt", DROP COLUMN "pointsReversed",
      DROP COLUMN "pointsEarned", DROP COLUMN "benefitsPolicyVersion"`);
    await queryRunner.query(
      'ALTER TABLE vouchers DROP COLUMN "maxUsesPerUser"',
    );
  }
}
