# Task 10e — giao diện và nền xử lý voucher

Cập nhật 30/10/2026. Nhánh `feature/task-10-vouchers`, thư mục chính
`Bai_Tap_Lon_CNPM`, kế thừa Task 9, 10c/d và frontend thanh toán Task 8.

Ân yêu cầu triển khai trước giao diện và nền xử lý; nhóm **chưa chốt mã/mức giảm**.
Migration không tạo hoặc kích hoạt voucher nào. Chưa triển khai tích điểm và chưa
đánh dấu toàn bộ Task 10e hoàn thành.

## Bố cục và hành vi

- Trong giỏ: Tạm tính → Ưu đãi BrewLite → Giảm giá → Tổng thanh toán → Đặt hàng.
- “Chọn hoặc nhập mã” mở hộp thoại trên desktop, bảng từ dưới lên trên mobile.
  Có ô nhập/kiểm tra mã, danh sách công khai, điều kiện, hạn dùng và lý do không
  đủ điều kiện; một đơn chọn một mã. Có Bỏ chọn, Bỏ mã, Đóng và Escape.
- Mã nhập được bỏ khoảng trắng hai đầu và đổi sang chữ hoa. Nhập mã không tạo mã
  mới; mã phải có sẵn, đang hoạt động và hợp lệ trong database.
- Sửa giỏ sẽ kiểm tra lại; mã không còn hợp lệ chặn tạo đơn cho tới khi đổi/bỏ mã.
- Giữ lựa chọn qua tải lại trang và chuyển sang đăng nhập; xóa cùng giỏ khi thanh
  toán thành công cho đúng giỏ đó.
- Chọn mã/quote chưa giữ nguyên liệu. Tạo PENDING mới giữ nguyên liệu 5 phút.
- Checkout, chi tiết và xác nhận hiển thị khoản giảm đã lưu. Tiếp tục một đơn đã
  tạo giữ nguyên mã và số tiền; không đổi voucher ngay trên phiên QR.

## API và dữ liệu

`POST /vouchers/quote` công khai, `Cache-Control: no-store`, không ghi đơn/kho:

```json
{
  "items": [{ "productId": "1", "size": "S", "toppingIds": [], "qty": 1 }],
  "voucherCode": "MA_NHOM_CHOT"
}
```

`voucherCode` tùy chọn. Trả `subtotal`, `discount`, `total`, `voucherCode`,
`voucherTitle`, `serverTime` và `vouchers` (danh sách công khai với
`unavailableReason`). Mã sai/hết hạn/chưa tới hạn/tắt/không đạt đơn tối thiểu trả
400. Không truyền mã thì trả tổng chưa giảm và danh sách để chọn.

`POST /orders` nhận thêm `voucherCode` tùy chọn. Backend tính lại giá từ sản phẩm,
size, topping và số lượng; không dùng subtotal/discount/total do client gửi.
Giá quote và giá tạo đơn dùng chung hàm tính. Kiểm tra voucher và lưu đơn cùng
transaction giữ kho; lỗi voucher rollback cả đơn và kho. Đọc thời gian DB sau
khi chờ khóa voucher để không chấp nhận mã đã hết hạn trong lúc chờ.

Migration `AddVouchers1761850000000` thêm bảng `vouchers` và các cột trên `orders`:
`subtotal`, `discount`, `voucherCode`, `voucherTitle`. Đơn cũ được backfill
`subtotal = total`, `discount = 0`; không tính lại tiền lịch sử. Mã/tên/khoản giảm
trên đơn là snapshot, không phụ thuộc voucher còn tồn tại sau đó.

Bảng voucher có: `code`, `title`, `discountType` (`FIXED`/`PERCENT`),
`discountValue`, `minSubtotal`, `maxDiscount` (tùy chọn), `startsAt`, `endsAt`,
`isActive` (mặc định false), `isPublic`. Mã riêng vẫn nhập được nhưng không nằm
trong danh sách công khai; đây không phải cơ chế cấp voucher riêng theo tài khoản.

Quy ước kỹ thuật hiện có để nhóm review trước khi phát hành mã:

- Tiền là số nguyên VND; phần trăm là số nguyên 1–100, phần lẻ VND làm tròn xuống.
- Khoản giảm không vượt trần cấu hình hoặc tiền hàng; `total = subtotal - discount`.
- `startsAt <= thời gian DB < endsAt`; đạt đúng đơn tối thiểu được dùng.
- Mã phải hợp lệ khi tạo đơn. Sau khi đơn đã tạo, giữ khoản giảm trong thời hạn
  thanh toán của đơn kể cả mã vừa hết hạn hoặc được chỉnh/tắt sau đó.
- Chưa có giới hạn lượt dùng tổng/cá nhân, cộng dồn nhiều mã hoặc trang quản trị.
  Nếu nhóm chọn quy tắc giới hạn lượt dùng, cần bổ sung xử lý đồng thời trước khi
  kích hoạt mã có giới hạn đó.

## Thanh toán

Payment lấy `order.total` sau giảm. Màn QR/Thẻ và trang xác nhận trên thiết bị thứ
hai dùng cùng số tiền. Thất bại rồi thử lại giữ tổng đã lưu và hạn gốc; callback
lặp không áp giảm/trừ kho lần hai. Không sửa cơ chế ký callback của nhóm.

## Kiểm tra và xem thử

Mở `http://localhost:3000/menu`, thêm món, vào Giỏ hàng → “Chọn hoặc nhập mã”.
Khi chưa có mã được nhóm duyệt, danh sách hiện thông báo chưa có ưu đãi; không
đưa các mã test vào database đồ án để làm như mã thật.

Các mã `UI10K`, `UIMIN`, `UIPRIVATE` chỉ được tạo bởi
`backend/test/start-task9-ui-server.cjs`, được chặn bằng tên database `_ui_test`.
Các mã `TEST10K` trong e2e cũng chỉ ở database `_test`. Đây là dữ liệu kiểm thử,
không phải chính sách giảm giá được đề xuất cho nhóm.

```powershell
# Từ backend; database phải được tạo riêng và tên kết thúc bằng _test.
$env:TEST_DATABASE_URL = 'postgresql://brewlite:brewlite@127.0.0.1:5432/brewlite_task10_test'
npm.cmd run test:e2e -- --runInBand

# Từ frontend; Playwright khởi động API/frontend riêng tại 3201/3200.
# Database brewlite_task9_ui_test phải tồn tại; không dùng DB đồ án.
npm.cmd run test:e2e -- tests/vouchers.spec.ts
```

## Còn chờ nhóm

- Mã thực tế, mức giảm, thời hạn, điều kiện và giới hạn lượt dùng nếu cần.
- Xác nhận quy tắc làm tròn và giữ ưu đãi trên PENDING nêu trên.
- Công thức tích điểm sau PAID, cách làm tròn và xử lý khi đơn PAID bị hủy.
- Review PR trước khi merge; chưa push/merge main.

## Kết quả xác minh ngày 30/10

- Backend: 111 unit/HTTP test và 76 e2e PostgreSQL qua, không skip. Các ca bổ sung
  gồm quote không ghi kho, mã sai/hết hạn/chưa tới hạn/tắt, điều kiện đơn tối thiểu,
  phần trăm/trần/làm tròn, mã nhập không công khai, giả mạo tổng tiền, rollback,
  thay đổi/xóa mã sau tạo đơn, thử lại thanh toán, callback lặp và chờ khóa quá hạn.
- UI: 22 ca lịch sử/thanh toán cũ qua trên desktop/mobile. Sau sửa hộp thoại cho
  React Strict Mode, chạy lại riêng 8 ca voucher và cả 8 qua; có luồng QR trên
  thiết bị trình duyệt thứ hai, nhập mã qua đăng nhập, sửa giỏ, rỗng/lỗi/retry và Escape.
- Lint backend/frontend, TypeScript, format các file mới và build đều qua.
  Build frontend trên host cần mạng để tải font Google; build Docker hai image qua.
- Sao lưu DB đồ án trước cập nhật tại workspace ngoài Git:
  `.task9-recovery/brewlite-before-vouchers-20261030.dump`, SHA256
  `4F29044C95130CE2659FDFA98D57C2FDDC0FFD844776DA50B3F4773D5DA5038E`.
- Khôi phục dump vào `brewlite_voucher_migration_test`, chạy migration bằng image
  backend và đối chiếu fingerprint trước khi cập nhật container thật. Sau cập nhật
  DB đồ án: 1 user, 6 sản phẩm, 9 nguyên liệu, 4 đơn, 4 dòng món, 3 payment,
  13 dòng giữ nguyên liệu được giữ nguyên cả số lượng và fingerprint; 0 voucher.
- Đã cập nhật frontend/backend Docker tại 3000/3001, giữ volume PostgreSQL cũ.
  Kiểm tra trình duyệt bản production desktop/mobile: thêm món, mở hộp voucher,
  danh sách rỗng, kiểm tra mã không tồn tại, đóng hộp và tiếp tục giỏ đều qua;
  không có lỗi JavaScript hoặc tràn ngang, không thêm tài khoản/đơn vào DB thật.
- Ảnh production nằm ngoài Git tại `.task9-recovery/voucher-docker-desktop.png`
  và `voucher-docker-mobile.png`. Cảnh báo Node engine/npm audit từ image nền đã
  được ghi nhận ở các task trước; không nâng dependency trong phạm vi voucher.
