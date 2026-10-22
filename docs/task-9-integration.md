# Task 9 — Xác nhận, lịch sử đơn hàng và bàn giao

## Phạm vi và trạng thái

Đề bài: bảng backlog ở trang 7 PDF BrewLite-CongNghePhanMem.pdf, mục 8.
Task 9 gồm màn hình xác nhận mã/trạng thái đơn, GET /orders/me, Compose chạy
frontend/backend/DB, README và demo end-to-end.

Đã triển khai giao diện Next.js, API đọc đơn có JWT, lưu PostgreSQL qua TypeORM,
migration khởi tạo, Dockerfile/Compose và kịch bản kiểm thử. Tài khoản được chuyển
từ bộ nhớ sang PostgreSQL để đơn hàng vẫn thuộc cùng người dùng sau khi restart.
Các API đăng ký/đăng nhập giữ nguyên đường dẫn và cấu trúc phản hồi hiện có.
Token cũ phát với secret hardcode và ID trong bộ nhớ không dùng lại được; cần
đăng ký/đăng nhập lại sau khi chuyển sang DB.

**Chưa thể nghiệm thu demo mua hàng end-to-end**: bản gốc chưa có task 3–6 và 8
(menu frontend, tùy chọn, giỏ hàng, POST /orders, POST /payments).
Task 9 không tự triển khai thay nghiệp vụ tạo đơn/thanh toán/tồn kho của nhóm.
Các trang /demo chỉ là dữ liệu mẫu, không ghi đơn hoặc mô phỏng một giao dịch thật.

## Thiết kế tham chiếu

Dự án: https://stitch.withgoogle.com/projects/12279045623806834658

- Xác nhận đơn hàng #BL1042: screen e46e332a024b4f268800dbce1f656fcf.
- Đơn hàng - Lịch sử: screen b8ffcfeefbb44b35b9fa3fb7f0e3bfaf.
- Font Be Vietnam Pro được cài cục bộ bằng @fontsource, không tải lúc build.
- Ảnh barista/cappuccino/trà đào được tải từ mã HTML của các screen này vào
  frontend/public/images/task9. Giữ nguồn tham chiếu khi bàn giao.

Các điều chỉnh so với prototype: dùng Đại học Sài Gòn thống nhất theo đề bài;
không hiển thị barcode/QR/PIN giả, thời gian chờ giả, tích điểm giả hay thông báo
"live" khi chưa có API hỗ trợ. Tiến trình chỉ phản ánh status của đơn. Dữ liệu mẫu
có cùng tổng tiền trên lịch sử và xác nhận. Không có nút đặt lại khi giỏ hàng chưa có.

## API thống nhất cho task 6/7/8

### GET /orders/me

Header: Authorization: Bearer <JWT>. Không nhận userId từ client.
200 trả mảng đơn của user trong JWT, mới nhất trước (createdAt DESC, id DESC).
Tài khoản chưa có đơn trả []. 401 khi thiếu/hết hạn/sai JWT hoặc user không còn tồn tại.

### GET /orders/:id

Header tương tự; id là UUID. 400 nếu sai định dạng; 404 nếu không tồn tại hoặc
thuộc user khác. Không phân biệt hai trường hợp này trong thông báo.

```json
{
  "id": "e040c221-d610-4acc-8a08-943fcb675ba9",
  "code": "BL1042",
  "status": "PAID",
  "total": 159000,
  "createdAt": "2026-10-22T02:42:00.000Z",
  "pickupCode": "A-42",
  "paymentMethod": "WALLET",
  "items": [
    { "id": "13a3f107-cc68-4411-a905-ce5048d0555e", "productId": "3", "name": "Cappuccino", "size": "M", "toppings": ["Kem béo"], "qty": 2, "lineTotal": 110000 },
    { "id": "83a8edfe-3288-4d48-82b3-fce905bc9d47", "productId": "4", "name": "Trà đào", "size": "L", "toppings": [], "qty": 1, "lineTotal": 49000 }
  ]
}
```

Tiền là số nguyên VND; createdAt là ISO UTC, giao diện hiển thị Asia/Ho_Chi_Minh.
code là mã hiển thị, id UUID dùng cho URL/API. pickupCode/paymentMethod có thể null.
WALLET và CARD được hiển thị tương ứng Ví điện tử/Thẻ ngân hàng.
Status: PENDING, PAID, PAYMENT_FAILED, PREPARING, READY, COMPLETED, CANCELLED.
PAID/PREPARING/READY/COMPLETED được xem là đã thanh toán. Các trạng thái còn lại
không được hiển thị xác nhận thanh toán thành công.

## Điểm bàn giao trong mã nguồn

- Task 6: dùng OrderEntity/OrderItemEntity trong backend/src/database/entities.ts,
  thêm POST /orders trong OrdersModule hiện có. Lấy userId từ JWT, tính giá trên server,
  lưu tên/size/topping/lineTotal tại thời điểm mua, tạo code duy nhất, khởi đầu PENDING.
  Schema hiện là hợp đồng đề xuất; thống nhất với nhóm trước khi merge. Khi đổi schema,
  thêm migration mới, không sửa migration đã áp dụng cho DB dùng chung.
- Task 7: frontend dùng sessionStorage khóa brewlite.accessToken; helper apiRequest
  tự gửi Authorization và xóa token khi 401. Trang /login là form tích hợp tối thiểu
  gọi các API sẵn có. Có thể thay UI này bằng màn đăng nhập chính của nhóm nhưng giữ
  helper/khóa token đồng nhất, hoặc cập nhật chúng cùng lúc.
- Task 8: cập nhật cùng OrderEntity khi thanh toán thành công/thất bại. Sau thanh toán,
  chuyển tới /orders/{id}/confirmation; màn hình đọc lại trạng thái qua API, không tin
  trạng thái từ query string. Không xóa giỏ khi PAYMENT_FAILED. Không cấp mã nhận
  nước cho đơn chưa được thanh toán.
- Task 10: bổ sung state machine, payment idempotency, transaction/locking, loyalty.
  Task 9 chỉ đọc trạng thái; không tự chuyển PAID sang PREPARING hay READY.

## Kiểm thử và kịch bản bàn giao

1. Xem /demo/orders trên desktop/mobile; lọc và mở chi tiết. Kiểm tra state=empty,
   state=loading, state=error. Mở /demo/orders/bl1010/confirmation: không thông báo thành công.
2. Chạy Compose, đăng ký tài khoản mới. /orders hiển thị rỗng; không hiện dữ liệu demo.
3. Seed dữ liệu mẫu theo README, đăng nhập demo@brewlite.test. Đối chiếu tổng tiền,
   mã đơn, trạng thái giữa lịch sử và xác nhận; restart backend rồi kiểm tra lại.
4. Kiểm thử API với hai tài khoản: tài khoản A không thấy đơn B, cả qua /me và /:id;
   token thiếu/sai trả 401, UUID sai trả 400, đơn không có/không thuộc user trả 404.
5. Sau khi nhóm tích hợp task 3–8: chọn món → tùy chọn → giỏ → đăng nhập →
   tạo đơn PENDING → thanh toán WALLET/CARD → xác nhận PAID → lịch sử. Kiểm tra
   nhánh PAYMENT_FAILED, giỏ được giữ nguyên, restart vẫn còn dữ liệu.

DoD còn cần: chạy demo toàn bộ bước 5 trên bản tích hợp, commit rõ ràng,
PR vào main và ít nhất một thành viên review. Không đánh dấu task 9 đã nghiệm thu
toàn bộ khi chưa thực hiện các bước này.
