import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task 10: voucher mẫu có sẵn ngay khi chạy `docker compose up` trên database
 * mới, để demo không cần chạy thêm `npm run vouchers:seed`.
 * - Hạn dùng 30 ngày tính từ lúc migration chạy; gia hạn bằng
 *   `npm run vouchers:seed -- --update` (cấu hình ở backend/voucher-samples.json)
 * - Mã đã có thì giữ nguyên (ON CONFLICT DO NOTHING): không ghi đè dữ liệu cũ
 * - Voucher dùng chung cho mọi tài khoản, mỗi tài khoản tối đa 3 lần/mã
 * Values are copied here on purpose: a migration must not change when the
 * sample JSON is edited later.
 */
const SAMPLE_VOUCHERS = [
  {
    code: 'THU5K',
    title: 'Ưu đãi mẫu: giảm 5.000đ cho đơn từ 30.000đ',
    discountType: 'FIXED',
    discountValue: 5000,
    minSubtotal: 30000,
    maxDiscount: null,
    isPublic: true,
  },
  {
    code: 'BREW10',
    title: 'Ưu đãi mẫu: giảm 10%, tối đa 10.000đ',
    discountType: 'PERCENT',
    discountValue: 10,
    minSubtotal: 50000,
    maxDiscount: 10000,
    isPublic: true,
  },
  {
    code: 'NHOM15K',
    title: 'Ưu đãi mẫu: giảm 15.000đ cho đơn từ 100.000đ',
    discountType: 'FIXED',
    discountValue: 15000,
    minSubtotal: 100000,
    maxDiscount: null,
    isPublic: true,
  },
  {
    // Not listed in the app: customers type the code by hand
    code: 'NHAP7K',
    title: 'Ưu đãi nhập mã mẫu: giảm 7.000đ cho đơn từ 35.000đ',
    discountType: 'FIXED',
    discountValue: 7000,
    minSubtotal: 35000,
    maxDiscount: null,
    isPublic: false,
  },
] as const;

const VALID_DAYS = 30;
const MAX_USES_PER_USER = 3;

export class SeedSampleVouchers1761910000000 implements MigrationInterface {
  name = 'SeedSampleVouchers1761910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const voucher of SAMPLE_VOUCHERS) {
      await queryRunner.query(
        `INSERT INTO vouchers
           (code, title, "discountType", "discountValue", "minSubtotal", "maxDiscount",
            "startsAt", "endsAt", "isActive", "isPublic", "maxUsesPerUser")
         VALUES ($1, $2, $3, $4, $5, $6, now(), now() + make_interval(days => $7),
                 true, $8, $9)
         ON CONFLICT (code) DO NOTHING`,
        [
          voucher.code,
          voucher.title,
          voucher.discountType,
          voucher.discountValue,
          voucher.minSubtotal,
          voucher.maxDiscount,
          VALID_DAYS,
          voucher.isPublic,
          MAX_USES_PER_USER,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only remove sample codes nobody has used yet
    await queryRunner.query(
      `DELETE FROM vouchers v
        WHERE v.code = ANY($1)
          AND NOT EXISTS (SELECT 1 FROM voucher_user_quotas q WHERE q."voucherCode" = v.code)`,
      [SAMPLE_VOUCHERS.map((voucher) => voucher.code)],
    );
  }
}
