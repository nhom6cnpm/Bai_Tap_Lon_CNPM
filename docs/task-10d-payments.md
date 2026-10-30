# Task 10d — thanh toán idempotent

Ngày 30/10/2026, nhánh `feature/task-10-payment-idempotency` trong thư mục chính
`Bai_Tap_Lon_CNPM`. Nhánh dùng nền tích hợp `b0a4a90` (Task 9, Task 10c và Task 8),
chưa push hoặc merge main. Cần review các nhánh phụ thuộc trước khi đưa PR này vào main.

Nguồn yêu cầu: [Task 10 — Issue #21](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/21)
và [API thanh toán Task 8 — Issue #18](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/18).
Tiếp tục dùng PaymentsModule, Payment và callback HMAC của Task 8; không thêm
module thanh toán hoặc migration trùng. Không thay đổi giao diện.

## Thay đổi và hợp đồng API

`POST /payments` có JWT, body `{ orderId, method }` và `Idempotency-Key`.

- Một khóa gắn với cùng tài khoản, cùng đơn và cùng phương thức. Khóa thiếu,
  trắng hoặc dài hơn 128 ký tự trả 400 trước khi ghi dữ liệu.
- Gửi lại cùng yêu cầu trả đúng `paymentId`, `gatewayUrl` cũ và trạng thái hiện tại
  của Payment, kể cả đơn đã PAID hoặc đã tiến sang trạng thái khác. Kiểm tra khóa
  trước điều kiện tạo phiên mới để không biến một lần gửi lại thành yêu cầu mới.
- Cùng khóa nhưng khác đơn/tài khoản/phương thức trả 400, không trả ID phiên của
  người khác. Vẫn kiểm tra quyền sở hữu đơn trước khi xử lý khóa.
- Khóa mới chỉ tạo phiên cho đơn PENDING/PAYMENT_FAILED còn hạn. Khóa mới trên
  đơn PAID/CANCELLED hoặc đã đi tiếp trong quy trình vẫn bị từ chối.
- Phiên FAILED được gửi lại bằng khóa cũ vẫn là FAILED. Muốn thử thanh toán lại,
  dùng khóa mới trên cùng đơn còn hạn, chuyển PAYMENT_FAILED về PENDING theo
  state machine; giữ nguyên expiresAt và lượng nguyên liệu đã giữ.
- Gửi lại khóa cũ sau khi hết hạn chỉ lấy lại phiên cũ. Backend vẫn hủy/hoàn kho
  đúng một lần; trả lại phiên không cho phép thanh toán đơn đã hủy, không gia hạn.
  Giao diện/cổng kiểm tra orderStatus/expiresAt; callback muộn vẫn bị từ chối.

Khóa đơn trong transaction và UNIQUE của `payments.idempotencyKey` bảo vệ cả
yêu cầu đồng thời. Nếu tranh chấp UNIQUE xảy ra giữa các đơn, transaction thua
rollback, rồi đối chiếu lại người dùng/đơn/phương thức của bản ghi thắng.

## Callback và transaction đã kiểm chứng

Giữ thứ tự khóa chung từ Task 10c: Order → Payment → nguyên liệu. HMAC được
kiểm tra trước khi xử lý. Callback đầu tiên hợp lệ cập nhật Order và Payment trong
cùng transaction; Payment đã có kết quả thì callback sau chỉ xác nhận kết quả đã
lưu, kể cả kết quả gửi lại khác SUCCESS/FAILED. Không chuyển trạng thái đơn lại.

Test cưỡng bức lỗi ghi kết quả Payment bằng constraint tạm trên DB test: trạng
thái Order rollback về PENDING cùng Payment, sau đó callback thử lại thành công.
Callback của lượt thất bại cũ không làm lùi đơn đã thanh toán bằng lượt mới.
Thanh toán đua với hủy/hết hạn không hồi sinh đơn CANCELLED hoặc hoàn kho hai lần.

Task 10e chưa có quy tắc nghiệp vụ. Chưa cộng điểm hoặc áp giảm giá; tính đúng
một lần của loyaltyPoints cần kiểm chứng khi triển khai 10e, không coi là đã xong.

## Kiểm tra

- Ba regression unit test tái hiện lỗi trước sửa: gửi lại sau PAID bị từ chối,
  cùng khóa khác phương thức bị nhận nhầm phiên, khóa quá dài không được chặn.
- Sau sửa: 111/111 test backend qua; 53/53 e2e qua trên PostgreSQL test riêng,
  hai suite, không skip. Trong đó 16 trường hợp mới cho Task 10d.
- Gửi 12 POST đồng thời cùng khóa: một Payment, cùng ID, không trừ thêm kho.
- Callback SUCCESS/FAILED đua nhau: đúng một lần xử lý; kiểm tra rollback, thử
  lại, quyền tài khoản, hết hạn, hủy và giới hạn chiều dài khóa đều qua.
- Lint backend không cảnh báo; format và build qua.
- Hai luồng trình duyệt desktop (ví QR từ thiết bị thứ hai; thẻ lỗi rồi thử lại
  cùng đơn) với backend mới: 2/2 qua trên database UI test riêng.
- Build backend Docker và cập nhật container 3001: qua. Frontend 3000 và volume
  PostgreSQL được giữ nguyên; đối chiếu fingerprint dữ liệu đồ án sau cập nhật
  không thay đổi. Không thêm migration hoặc seed dữ liệu demo vào DB đang dùng.

Build còn cảnh báo Node engine và dependency audit đã ghi ở
[Task 9 validation](task-9-validation.md); không nâng phiên bản dependency trong thay đổi này.

```powershell
cd backend
$env:TEST_DATABASE_URL='postgresql://brewlite:brewlite@127.0.0.1:5432/brewlite_task9_test'
npm run test:e2e -- --runInBand
```

Test chỉ được dùng DB có hậu tố `_test`, sẽ reset các bảng trong DB test đó.
Không đặt TEST_DATABASE_URL vào DB đồ án. Các request Postman trong nhóm Payments
có tên Task 10d dùng các biến `task10dOrderId`, `task10dToken`, `task10dKey`.
Giữ nguyên biến khi gửi lại; không dùng `{{$guid}}` đổi khóa ở mỗi lần Send để
kiểm tra idempotency. Không commit token thật sau khi thử trong Postman.
