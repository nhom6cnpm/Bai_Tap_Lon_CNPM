# Bước 2 — lượt voucher và điểm trong transaction

Hoàn thành ngày 30/10/2026 trên nhánh `feature/task-10-voucher-points`, kế thừa
`27ee9d5` của bước 1. Chỉ thay phần đơn hàng/voucher và điểm tích hợp của phần mình;
không chỉnh code xác nhận thanh toán, QR, đăng nhập hoặc phân quyền của nhóm.

## Vòng đời đã nối

Đơn mới qua OrdersService được bật benefitsPolicyVersion = 1. Các đơn có sẵn
version 0 giữ chính sách cũ, không cộng/thu hồi điểm hoặc tính lượt hồi tố.

| Sự kiện | Voucher | Điểm |
| --- | --- | --- |
| Xem danh sách/quote | Chỉ đọc, không giữ lượt | Không đổi |
| Tạo đơn PENDING | Giữ một lượt RESERVED | Chưa cộng |
| Báo chuyển tiền | Vẫn RESERVED | Chưa cộng |
| PAYMENT_FAILED, thử lại còn hạn | Tiếp tục RESERVED, cùng đơn/hạn/tổng tiền | Chưa cộng |
| Nhân viên xác nhận PAID | RESERVED → USED | floor(total sau giảm / 10.000), đúng một lần |
| Hủy/hết hạn chưa PAID | RESERVED → RELEASED | Không thu hồi điểm chưa từng cộng |
| Hủy PAID qua nghiệp vụ hủy nội bộ | USED → RELEASED | Thu hồi pointsEarned, lưu pointsReversed và mốc xử lý |

PAID đi qua hàm chuyển trạng thái đơn mà PaymentsService.review đang dùng, cùng
EntityManager/transaction. Không sửa luồng thanh toán của Task 8. Hủy dùng hàm
chung, bao gồm worker hết hạn; không mở transaction riêng cho điểm/lượt.
API nhân viên duyệt hủy PAID và giao diện hủy sẽ được làm ở bước 4; bước này đã
kiểm tra hàm nghiệp vụ nội bộ, không mở quyền hủy trực tiếp PAID cho khách.

Giữ snapshot subtotal/discount/total/voucher và Payment SUCCESS đã ghi nhận dù
sau đó hủy đơn. Chưa có cổng hoàn tiền ngân hàng hay đổi điểm.

## Giới hạn và toàn vẹn dữ liệu

- Hạn mức riêng của từng voucher (`maxUsesPerUser`), ba mã mẫu đều cấu hình 3.
  Một mã/đơn, một lượt/đơn; không cộng ba lần giảm giá vào một đơn.
- Khóa hàng quota theo user/mã rồi đếm RESERVED + USED. Bốn đơn cùng tài khoản
  dùng mã x3 chỉ tối đa ba đơn thành công; đơn thua rollback cả stock/order/usage.
- Thứ tự khóa: Order → nguyên liệu nếu cần → voucher/quota/usage → User. Không
  khóa các đơn khác trong khi đang giữ quota; lượt quá hạn được worker trả khi hủy.
- Kiểm tra lại hạn voucher sau khi đợi khóa quota. Mã hết hạn trong lúc chờ tạo
  đơn không được nhận; mã hết hạn sau khi đơn đã tạo không đổi quyền lợi đã giữ.
- Cộng/trừ điểm bằng UPDATE nguyên tử, kiểm tra số dòng cập nhật. Nếu số dư bị
  sửa sai không đủ thu hồi thì hủy thất bại và rollback cả kho/lượt/trạng thái.
- Mốc đã cộng được lưu cả với đơn dưới 10.000đ (0 điểm), không dùng số 0 để đoán
  là chưa xử lý. Thao tác lặp không cộng/thu hồi điểm hai lần.
- Hạ hạn mức không xóa các lượt đã giữ; chỉ chặn lượt mới. Khoản giảm và quyền
  thanh toán của đơn đã tạo vẫn được giữ nguyên.
- Voucher đã có quota/usage không xóa cứng (khóa ngoại giữ lịch sử); tắt
  `isActive` hoặc ẩn mã. Đây là cách quản lý phù hợp quyết định không xóa lịch sử.

## API sẵn cho bước giao diện

`POST /vouchers/quote` vẫn cho khách chưa đăng nhập xem điều kiện chung.
Gửi Bearer JWT để nhận số lượt của chính tài khoản đó; token sai/hết hạn hoặc
tài khoản không còn tồn tại trả 401. Không nhận userId phía client để đổi tài khoản.
Response dùng Cache-Control private/no-store và Vary Authorization.

```json
{
  "voucherUsage": {
    "maxUsesPerUser": 3,
    "reservedUses": 1,
    "usedUses": 0,
    "availableUses": 2
  }
}
```

`voucherUsage` là null khi khách chưa đăng nhập hoặc không chọn mã.
Mỗi phần tử danh sách có `maxUsesPerUser` và `usage` tương tự. Mã đã dùng hết
được bỏ khỏi danh sách cá nhân; hết khả dụng do đang giữ vẫn hiện với lý do khóa
chọn. Hủy trả lượt có thể làm mã hiện lại nếu còn hiệu lực. Quote mã được chọn
nhưng hết khả dụng trả 409; tạo đơn luôn kiểm tra lại dưới khóa dữ liệu.

`GET /orders/me` và `/orders/:id` thêm policy version, điểm đã cộng/thu hồi và
mốc xử lý. `GET /auth/me` hiện có trả số dư đã cập nhật; không sửa API Auth.
Postman đã thêm request quote với JWT trong thư mục Task 10e.

## Điều chỉnh voucher mẫu

Chỉnh `maxUsesPerUser` trong `backend/voucher-samples.json`, rồi dùng lệnh nạp
hiện có sau khi database đã có migration bước 1. Mặc định không ghi đè mã đã có;
`--update` mới cập nhật. Nếu cấu hình bỏ trường hạn mức khi update thì giữ mức
cũ, không đặt lại về 3. Ngày bắt đầu/kết thúc cũng không bị gia hạn ngầm.

```powershell
# Từ backend, chỉ chạy với database đã nâng cấp đúng migration.
npm.cmd run vouchers:seed
npm.cmd run vouchers:seed -- --update
```

## Kiểm chứng và môi trường

- Build/lint/format: qua. 138 unit test và 110 PostgreSQL/API test qua, không skip
  trong lần chạy toàn bộ. 17 ca nghiệp vụ mới phủ giới hạn, đồng thời, retry,
  idempotency, rollback, hết hạn, hạ hạn mức, riêng tư và chính sách legacy.
- 8 tình huống CLI nạp hạn mức qua trên database thử, gồm skip, update, giữ cấu
  hình khi thiếu trường, giữ ngày và từ chối 0/số âm/null/số không nguyên.
- Database clone nâng cấp từ snapshot thực tế giữ nguyên fingerprint: 2 user,
  10 đơn, 12 dòng món, 9 nguyên liệu, 6 sản phẩm, 3 voucher, 9 payment/request key,
  32 dòng giữ nguyên liệu. Không hồi tố điểm hoặc sửa snapshot cũ.
- Chỉ dùng `brewlite_benefits_step2_test` và `brewlite_benefits_step2_clone_test`.
  Sao lưu Git/DB trước bước này ở `.task9-recovery/benefits-step2` ngoài repo.
- Bước 2 chưa cập nhật database chính/container Docker hoặc frontend. Giao diện
  số lượt, refresh điểm trên header/lịch sử đã hoàn thành ở
  [bước 3](task-10-voucher-points-ui.md); chưa đánh dấu toàn Task 10e xong.

Chạy kiểm tra backend bằng TEST_DATABASE_URL có hậu tố `_test` như hướng dẫn
bước 1. Chưa push nhánh hoặc merge main.
