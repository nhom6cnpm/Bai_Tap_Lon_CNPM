-- Only for a fresh, dedicated Docker UI test database; never for the application DB.
BEGIN;
DO $guard$
BEGIN
  IF right(current_database(), 8) <> '_ui_test' THEN
    RAISE EXCEPTION 'Refusing fixture writes outside an _ui_test database';
  END IF;
  IF EXISTS (SELECT 1 FROM orders) OR EXISTS (SELECT 1 FROM vouchers) THEN
    RAISE EXCEPTION 'Docker UI fixtures require a fresh database without orders or vouchers';
  END IF;
END
$guard$;

UPDATE ingredients SET quantity = 10000, version = 1;
INSERT INTO vouchers
  (code, title, "discountType", "discountValue", "minSubtotal", "startsAt", "endsAt", "isActive", "isPublic")
VALUES
  ('UI10K', 'Ưu đãi kiểm thử 10.000đ', 'FIXED', 10000, 0, now() - interval '1 day', now() + interval '1 day', true, true),
  ('UIMIN', 'Ưu đãi cho đơn từ 70.000đ', 'FIXED', 15000, 70000, now() - interval '1 day', now() + interval '1 day', true, true),
  ('UIPRIVATE', 'Mã nhập riêng kiểm thử', 'PERCENT', 10, 0, now() - interval '1 day', now() + interval '1 day', true, false);
COMMIT;
