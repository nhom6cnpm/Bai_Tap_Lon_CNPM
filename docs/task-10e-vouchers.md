# Task 10e — giao diện và nền xử lý voucher

Cập nhật 30/10/2026. Nhánh `feature/task-10-vouchers`, thư mục chính
`Bai_Tap_Lon_CNPM`, kế thừa Task 9, 10c/d và frontend thanh toán Task 8.

Ân đã chốt bố cục voucher đã áp dụng và bảng tiền dùng chung, đồng thời cho phép
thêm voucher mẫu để thử và điều chỉnh. Migration không tự kích hoạt mã; ba mã
mẫu được nạp riêng bằng lệnh trong tài liệu này. [Bước 2 backend lượt dùng và điểm](task-10-voucher-points.md)
đã triển khai trên nhánh riêng. [Bước 3 giao diện lượt dùng và điểm](task-10-voucher-points-ui.md)
đã hoàn thành trên `feature/task-10-voucher-points-ui`; chưa cập nhật bản Docker/database chính.
Các mô tả/kiểm thử bên dưới ghi lại bản voucher trước bước 2; chưa đánh dấu toàn bộ Task 10e hoàn thành.

## Bố cục và hành vi

- Trong giỏ: Voucher BrewLite → bảng Tổng tiền món/Voucher/Tổng thanh toán → Đặt hàng.
- Mã đã được backend kiểm tra có badge khoản giảm thực tế, dấu chọn và nút
  “Chọn voucher khác”; mất điều kiện thì bỏ trạng thái đã áp dụng và báo lỗi.
- Giỏ, checkout, chi tiết và xác nhận dùng chung `PriceSummary`. Lịch sử liệt kê
  tổng thanh toán và số tiền đã giảm; trang chi tiết dùng dữ liệu đã lưu trên đơn.
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

## Cập nhật giao diện vé giảm giá

Theo yêu cầu tham khảo Shopee, mục Ưu đãi trong giỏ và tiêu đề hộp chọn có biểu
tượng vé SVG dùng chung. Danh sách dùng thẻ có phần nhận diện BrewLite bên trái,
đường phân cách nét đứt và hai khuyết vé; bên phải là mức giảm, tên/mã, điều kiện,
hạn dùng và nút chọn. Mã không đủ điều kiện có màu nhạt và lý do rõ ràng.
Hộp chọn giữ tiêu đề/nút xác nhận, cuộn riêng phần nội dung trên desktop/mobile.
Đây là thay đổi trình bày, không thay đổi cách tính giảm giá hoặc phát hành mã.
Đã chạy lại 8 kiểm thử voucher desktop/mobile, tất cả qua; lint/TypeScript và
build frontend Docker qua. Đã cập nhật riêng container frontend và kiểm tra bản
production ở hai kích thước màn hình. Ảnh mẫu danh sách bằng dữ liệu test nằm
ngoài Git tại `.task9-recovery/voucher-ticket-list-desktop.png` và
`voucher-ticket-list-mobile.png`.

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
Các mã kiểm thử tự động vẫn chỉ ở database test. Ba mã mẫu bên dưới được nạp vào
database đồ án theo yêu cầu riêng của Ân để xem giao diện và điều chỉnh.

## Voucher mẫu và cách điều chỉnh

Cấu hình tại `backend/voucher-samples.json`:

| Mã | Giảm | Đơn tối thiểu | Trần giảm |
| --- | --- | --- | --- |
| THU5K | 5.000đ | 30.000đ | — |
| BREW10 | 10% | 50.000đ | 10.000đ |
| NHOM15K | 15.000đ | 100.000đ | — |

Mặc định hoạt động 30 ngày kể từ lần nạp đầu. Đây là mẫu sử dụng thử, chưa có
giới hạn lượt dùng tổng hoặc theo tài khoản. Mỗi đơn vẫn chỉ dùng một mã.

Từ thư mục `backend`, đọc kết nối trong `.env` (Docker local dùng DB localhost:5432):

```powershell
# Nạp mẫu lần đầu; mã trùng được bỏ qua, không xóa mã khác.
npm.cmd run vouchers:seed

# Sau khi sửa file JSON: cập nhật riêng các mã có trong file.
npm.cmd run vouchers:seed -- --update
```

Sau khi cập nhật chỉ cần tải lại giỏ/mở lại hộp chọn, không build lại ứng dụng.
Sửa `discountValue`, `minSubtotal`, `maxDiscount`, `title`, `isActive`, `isPublic`
trong JSON rồi chạy lệnh cập nhật. `FIXED` dùng số tiền đồng; `PERCENT` dùng số %.
Đổi `code` được hiểu là thêm mã khác, không xóa mã cũ; muốn ẩn mã cũ, giữ cấu hình
mã đó và đặt `isActive: false` rồi cập nhật.

`validDays` chỉ đặt thời hạn cho mã mới. Chạy lại, kể cả `--update`, không tự gia
hạn mã đang có. Muốn đổi thời gian, thêm `startsAt`/`endsAt` có múi giờ, ví dụ
`"endsAt": "2026-11-30T23:59:59+07:00"`, rồi cập nhật. Mã trên đơn cũ và tiền
thanh toán vẫn giữ nguyên sau các thay đổi này.

Nếu chỉ dùng Docker, image backend có sẵn script/file mẫu:

```powershell
docker compose exec backend npm run vouchers:seed
# Sau khi sửa JSON trên máy, chép file vào container rồi cập nhật:
docker compose cp backend/voucher-samples.json backend:/app/voucher-samples.json
docker compose exec backend npm run vouchers:seed -- --update
```

Lệnh nạp chỉ ghi bảng vouchers trong transaction, kiểm tra dữ liệu trước khi ghi,
không đụng tài khoản, đơn hàng, payment hoặc nguyên liệu. Không có API quản trị
công khai; người chỉnh cấu hình cần quyền truy cập máy/database dự án.

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

## Kết quả xác minh lần triển khai nền voucher ngày 30/10

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

## Cập nhật bảng tiền và voucher mẫu ngày 30/10

- Đã chạy cả 30 kiểm thử Playwright desktop/mobile qua, không skip. Có kiểm tra
  badge khoản giảm thực tế, mất điều kiện thì bỏ badge, bảng tiền xuyên giỏ →
  checkout → xác nhận → lịch sử/chi tiết, QR và thử lại thanh toán.
- Script nạp mẫu được kiểm tra trên DB riêng: chạy lại bỏ qua mã trùng, cập nhật
  đúng giá trị, giữ thời hạn gốc, cấu hình phần trăm sai bị từ chối không ghi DB.
- Trên DB đồ án, nạp 3 mã, chạy lại bỏ qua cả 3. Đối chiếu fingerprint giữ nguyên
  1 user, 6 sản phẩm, 9 nguyên liệu, 6 đơn, 6 dòng món, 5 payment và 19 dòng giữ
  nguyên liệu. Snapshot trước nạp: `.task9-recovery/voucher-samples-before-20261030.json`.
- Không thêm migration; dữ liệu giảm giá lịch sử vẫn dùng snapshot có sẵn.
- Lint/TypeScript/format qua; build Docker cả frontend/backend qua. Đã cập nhật
  hai container ứng dụng; kiểm tra production desktop/mobile chọn THU5K trên giỏ
  35.000đ, badge −5.000đ, tổng 30.000đ, đổi/bỏ mã đều qua, không tạo đơn/user mới.
  Chạy script trong Docker bỏ qua đúng 3 mã trùng. Ảnh bản chạy nằm ngoài Git tại
  `.task9-recovery/voucher-approved-desktop.png`, `voucher-approved-mobile.png`
  và `voucher-samples-list-desktop.png`, `voucher-samples-list-mobile.png`.
