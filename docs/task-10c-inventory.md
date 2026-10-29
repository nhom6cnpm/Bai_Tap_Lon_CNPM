# Task 10c — giữ nguyên liệu trong 5 phút

## Luồng

POST /orders có JWT, tính giá và tổng nguyên liệu phía backend. Tạo đơn PENDING,
trừ nguyên liệu và lưu lượng đã giữ trong cùng một transaction. ID đơn dùng UUID
với tiền tố ORD- để các đơn tạo đồng thời không trùng ID.

Mỗi lần trừ kho dùng điều kiện cả version lẫn quantity; version chỉ tăng khi cập
nhật thành công. Nếu writer khác thắng, đọc lại quantity/version và thử lại tối đa
8 lần. Không đủ nguyên liệu trả 400; tranh chấp kéo dài trả 409 để khách thử lại.
Mọi lỗi rollback toàn bộ đơn, các dòng đơn, lượng giữ và những nguyên liệu đã trừ.

Mỗi đơn lưu hạn `expiresAt` từ đồng hồ PostgreSQL, cách thời điểm tạo 5 phút.
PAYMENT_FAILED giữ nguyên liệu đến hạn ban đầu; thử lại chuyển về PENDING nhưng
không kéo dài hạn. PAID không trừ thêm lần nữa.

## Hủy và hết hạn

`POST /orders/:id/cancel` có JWT, không cần body. Đơn không tồn tại hoặc của người
khác trả 404. Các trạng thái hủy được bám state machine: PENDING, PAYMENT_FAILED,
PAID. PREPARING/READY/COMPLETED không hủy được. Gửi hủy lặp trả kết quả đã hủy,
không hoàn nguyên liệu thêm lần nữa.

Ví dụ kết quả:

```json
{
  "orderId": "ORD-...",
  "status": "CANCELLED",
  "cancelReason": "USER_CANCELLED",
  "cancelledAt": "2026-10-29T16:00:00.000Z",
  "expiresAt": "2026-10-29T16:04:00.000Z"
}
```

Quá hạn có `cancelReason: PAYMENT_TIMEOUT`. Lượng hoàn lấy từ bảng
`order_ingredient_reservations`, không tính lại bằng công thức hiện tại. Tăng kho
bằng phép cộng trong SQL và tăng version; đánh dấu inventoryReleasedAt trong cùng
transaction với CANCELLED. Khóa đơn bảo đảm hủy lặp/nhiều worker chỉ hoàn một lần.

OrderExpiryService tự quét khi backend khởi động và mỗi 5 giây. Nhiều instance
có thể quét: đơn đang bị khóa được bỏ qua và xét lại ở lần sau. Thay đổi trạng thái
có thể chậm tối đa khoảng một chu kỳ quét khi hệ thống rảnh; API thanh toán vẫn
kiểm tra hạn ngay dưới khóa đơn, không đợi tác vụ quét.

## Phối hợp thanh toán

Checkout, callback, hủy và hết hạn cùng khóa đơn trước; callback khóa payment sau.
Kiểm tra thời hạn dùng đồng hồ DB sau khi lấy được khóa, kể cả callback đến trước
hạn nhưng phải chờ khóa đến quá giờ. Nếu hết hạn, transaction lưu hủy/hoàn kho
trước rồi API mới trả lỗi 400; tránh rollback mất lần hoàn kho.

Callback lặp đã xử lý không trừ kho thêm. Callback mới cho đơn đã hủy/hết hạn
không thể chuyển đơn sang PAID. Phiên Payment PENDING bị từ chối do hết hạn được
giữ nguyên bản ghi; frontend phải dùng expiresAt/trạng thái đơn để dừng thanh toán,
không diễn giải Payment PENDING là đơn vẫn còn hạn.

Hủy PAID ở đây thực hiện state machine và hoàn nguyên liệu theo Issue #21. Đây
là cổng giả lập của đồ án; thay đổi này không triển khai nghiệp vụ hoàn tiền ở
cổng thanh toán thật hoặc điều chỉnh điểm thưởng.

## Migration và dữ liệu cũ

Migration mới `1761830000000-OrderInventoryReservations`, không sửa migration cũ:

- Thêm expiresAt, inventoryReservedAt, inventoryReleasedAt, cancelledAt, cancelReason.
- Tạo bảng lượng nguyên liệu đã giữ, khóa ngoại tới đơn/nguyên liệu và index quét hạn.
- Thời gian mới dùng timestamptz. Backfill expiresAt từ createdAt cũ theo UTC như
  môi trường Docker hiện tại của nhóm, cộng 5 phút.
- Đơn cũ chưa từng trừ kho không được hoàn kho giả. Đơn cũ còn hạn sẽ được giữ
  nguyên liệu một lần trong transaction khi thanh toán/thử lại, vẫn giữ hạn gốc.
- Đơn cũ đã thanh toán giữ nguyên dữ liệu; không tự trừ lại nguyên liệu.

## Kiểm thử

Chỉ dùng database riêng có tên kết thúc `_test`. Bộ e2e sẽ bỏ qua khi không có
TEST_DATABASE_URL; không được coi suite skip là đã kiểm thử DB. Smoke test cũ
cũng đã áp dụng điều kiện này để không chạy migration/tác vụ hủy trên DB đồ án.

Tạo database test một lần nếu chưa có, tại thư mục gốc repo:

```powershell
docker compose -p brewlite-availability exec -T postgres createdb -U brewlite brewlite_task10_test
```

```powershell
cd D:\Do_an_CNPM\BrewLite-availability\backend
$env:TEST_DATABASE_URL='postgresql://brewlite:brewlite@127.0.0.1:5432/brewlite_task10_test'
npm.cmd run test:e2e -- --runInBand
Remove-Item Env:TEST_DATABASE_URL
```

Suite tồn kho sở hữu dữ liệu trong database test và reset các bảng đơn/tài khoản
giữa các ca; không trỏ biến này vào database có dữ liệu cần giữ.

Kết quả 29/10/2026: **108 unit/HTTP test không DB và 24 test e2e với PostgreSQL 16
thật đều qua**, không skip trong lần e2e có cấu hình. Các ca gồm: nhiều khách
tranh ly cuối; đủ kho tạo đồng thời; rollback khi thiếu nguyên liệu/lỗi DB; size,
topping, nguyên liệu chung; hoàn theo lượng cũ khi công thức đổi; hủy/worker lặp;
retry giữ hạn; PAID không trừ thêm; callback chờ khóa quá hạn; worker chạy theo
lịch; nâng/hạ migration và dữ liệu cũ; JWT/quyền sở hữu API hủy.

Frontend chỉ bổ sung kiểu expiresAt trong response tạo đơn; màn lịch sử/checkout
và đồng hồ 5 phút tiếp tục tích hợp theo Task 9 và Task 8. Không thêm Đặt lại.

Image backend Docker đã build thành công. Đã chạy application context trong
container tạm với `DATABASE_URL` trỏ riêng tới `brewlite_task10_test`, xác nhận
migration mới và các module khởi động được; container kiểm tra đã tự xóa.
Container backend/frontend ở cổng 3001/3000 vẫn là bản đang chạy trước thay đổi;
chưa chạy migration mới trên database đồ án. Khi nhóm sẵn sàng cập nhật bản chạy,
recreate backend bằng Docker Compose sẽ tự áp dụng migration mới.

Build Docker dùng Node 20 theo Dockerfile hiện có; npm có in cảnh báo engine của
một số công cụ build và cảnh báo audit từ lockfile sẵn có. Build và kiểm tra khởi
động runtime đều qua; thay đổi này không cập nhật thư viện hoặc chạy npm audit fix.
