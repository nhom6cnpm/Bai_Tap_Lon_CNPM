require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const args = process.argv.slice(2);
const update = args.includes('--update');
const configArg = args.find((arg) => arg.startsWith('--config='));
if (args.some((arg) => arg !== '--update' && !arg.startsWith('--config=')))
  throw new Error('Supported options: --update, --config=path');
const filename = configArg
  ? path.resolve(configArg.slice('--config='.length))
  : path.join(__dirname, '../voucher-samples.json');
const rows = JSON.parse(fs.readFileSync(filename, 'utf8'));
const integer = (value) =>
  Number.isSafeInteger(value) && value >= 0 && value <= 2147483647;
if (!Array.isArray(rows) || !rows.length)
  throw new Error('Voucher configuration must be a nonempty array');
const codes = new Set();
for (const row of rows) {
  if (
    !row ||
    typeof row.code !== 'string' ||
    !/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(row.code) ||
    codes.has(row.code)
  )
    throw new Error('Invalid or duplicate voucher code');
  codes.add(row.code);
  if (
    typeof row.title !== 'string' ||
    !row.title.trim() ||
    row.title.length > 160 ||
    !['FIXED', 'PERCENT'].includes(row.discountType) ||
    !integer(row.discountValue) ||
    row.discountValue === 0 ||
    (row.discountType === 'PERCENT' && row.discountValue > 100) ||
    !integer(row.minSubtotal) ||
    (row.maxDiscount !== null &&
      (!integer(row.maxDiscount) || row.maxDiscount === 0)) ||
    typeof row.isActive !== 'boolean' ||
    typeof row.isPublic !== 'boolean' ||
    !Number.isInteger(row.validDays) ||
    row.validDays < 1 ||
    row.validDays > 3650 ||
    (row.startsAt !== undefined &&
      (typeof row.startsAt !== 'string' ||
        !/(Z|[+-]\d{2}:\d{2})$/.test(row.startsAt) ||
        !Number.isFinite(Date.parse(row.startsAt)))) ||
    (row.endsAt !== undefined &&
      (typeof row.endsAt !== 'string' ||
        !/(Z|[+-]\d{2}:\d{2})$/.test(row.endsAt) ||
        !Number.isFinite(Date.parse(row.endsAt))))
  )
    throw new Error(`Invalid configuration for ${row.code}`);
}

async function main() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://brewlite:brewlite@localhost:5432/brewlite',
  });
  await client.connect();
  try {
    await client.query('BEGIN');
    const {
      rows: [clock],
    } = await client.query(
      'SELECT clock_timestamp() AS now, current_database() AS database',
    );
    const counts = { inserted: 0, updated: 0, skipped: 0 };
    for (const row of rows) {
      const {
        rows: [existing],
      } = await client.query(
        'SELECT "startsAt", "endsAt" FROM vouchers WHERE code = $1 FOR UPDATE',
        [row.code],
      );
      if (existing && !update) {
        counts.skipped++;
        continue;
      }
      const startsAt = new Date(
        row.startsAt ?? existing?.startsAt ?? clock.now,
      );
      // Re-running does not silently extend a promotion; explicit dates can change it.
      const endsAt = new Date(
        row.endsAt ??
          existing?.endsAt ??
          startsAt.getTime() + row.validDays * 86400000,
      );
      if (endsAt <= startsAt)
        throw new Error(`endsAt must be later than startsAt for ${row.code}`);
      const result = await client.query(
        `INSERT INTO vouchers
        (code, title, "discountType", "discountValue", "minSubtotal", "maxDiscount", "startsAt", "endsAt", "isActive", "isPublic")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (code) ${update ? 'DO UPDATE SET title=EXCLUDED.title, "discountType"=EXCLUDED."discountType", "discountValue"=EXCLUDED."discountValue", "minSubtotal"=EXCLUDED."minSubtotal", "maxDiscount"=EXCLUDED."maxDiscount", "startsAt"=EXCLUDED."startsAt", "endsAt"=EXCLUDED."endsAt", "isActive"=EXCLUDED."isActive", "isPublic"=EXCLUDED."isPublic"' : 'DO NOTHING'}`,
        [
          row.code,
          row.title,
          row.discountType,
          row.discountValue,
          row.minSubtotal,
          row.maxDiscount,
          startsAt,
          endsAt,
          row.isActive,
          row.isPublic,
        ],
      );
      if (!result.rowCount) counts.skipped++;
      else if (existing) counts.updated++;
      else counts.inserted++;
    }
    await client.query('COMMIT');
    console.log(JSON.stringify({ database: clock.database, ...counts }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(() => {
  console.error(
    'Không nạp được voucher mẫu. Kiểm tra kết nối DB, migration và cấu hình voucher; transaction đã được hủy nếu có lỗi.',
  );
  process.exitCode = 1;
});
