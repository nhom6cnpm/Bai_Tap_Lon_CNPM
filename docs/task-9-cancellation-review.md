# Bước 4 — hủy đơn và nhân viên duyệt yêu cầu

Ngày 30/10/2026. Nhánh `feature/task-9-cancellation-review`, tiếp nối giao diện
voucher/điểm `af9b157`. Phạm vi Task 9/10c/e và các điểm tích hợp cần thiết với
thanh toán Task 8. Quy tắc theo [phương án đã chốt](task-9-10-team-decisions.md).

## Hành vi

| Đơn hiện tại | Hành động khách |
| --- | --- |
| PENDING chưa báo chuyển tiền, gồm chưa có Payment hoặc đã mở QR/Thẻ | Hủy ngay sau xác nhận |
| PAYMENT_FAILED, không có phiên mới CUSTOMER_REPORTED | Hủy ngay |
| PENDING đã CUSTOMER_REPORTED | Gửi lý do yêu cầu hủy |
| PAID chưa pha chế | Gửi lý do yêu cầu hủy |
| Có yêu cầu PENDING | Chờ nhân viên, tạm dừng thanh toán |
| PREPARING, READY, COMPLETED | Không có quyền hủy/yêu cầu hủy |
| CANCELLED | Giữ kết quả hủy; có liên kết về giỏ hiện tại |

Backend trả quyền `canCancelImmediately`, `canRequestCancellation` và metadata
`cancelRequest` trong GET `/orders/me`, `/orders/:id`. Giao diện checkout,
thanh toán, lịch sử, chi tiết/xác nhận dùng cùng component. Lỗi gửi giữ lại lý
do để thử lại; lỗi do trạng thái đã đổi sẽ tải lại đơn. Đơn cũ thiếu contract mới
không được frontend tự suy đoán quyền hủy.

Yêu cầu hủy là metadata, không thay Order.status. Khách thấy đang chờ, lý do
từ chối hoặc kết quả đồng ý qua polling. Mốc hết hạn 15 phút của đơn không thay
đổi khi yêu cầu hủy, từ chối hay gửi lại. PAID không bị timeout thanh toán.

Nhân viên mở **Quản trị → Đơn hàng** (`/admin/orders`), chuyển qua lại với tab
Thanh toán. Danh sách yêu cầu gồm cả đơn PENDING và PAID, có món/size/topping,
bảng tiền và lý do. Polling 4 giây, thông báo yêu cầu mới và âm báo tùy chọn.
Trình duyệt có thể yêu cầu tương tác trước khi phát âm thanh.

- Đồng ý: hủy qua nghiệp vụ chung; đơn PAID bắt buộc ghi chú xử lý tiền.
- Từ chối: bắt buộc lý do, giữ trạng thái/tiền/kho/lượt/điểm; khách thấy lý do
  và có thể tiếp tục thao tác hợp lệ hoặc gửi yêu cầu mới.
- Yêu cầu chờ: trang Thanh toán khóa nút duyệt/từ chối và liên kết sang Đơn hàng.
  Backend vẫn chặn các thao tác này nếu nhân viên dùng màn hình cũ hoặc gọi API.
- Hết hạn: hệ thống hủy đơn chưa PAID và đóng yêu cầu thành EXPIRED, không tiếp
  tục chờ duyệt. Trang khách và danh sách nhân viên tự cập nhật.

Đây là mô phỏng xác nhận tiền. Ghi chú xử lý không phải giao dịch hoàn tiền;
hệ thống không tự chuyển tiền về ngân hàng. Giữ nguyên Payment SUCCESS và
snapshot tiền/voucher của đơn PAID đã hủy.

## API

Khách dùng JWT của chính chủ đơn; không nhận userId trong body. Đơn không thuộc
tài khoản trả 404. API admin dùng JwtAuthGuard + RolesGuard + ADMIN của nhóm.

| API | Body / kết quả |
| --- | --- |
| POST `/orders/:id/cancel` | `{}`; giữ response hủy hiện có |
| POST `/orders/:id/cancel-request` | `{ "reason": "Đổi kế hoạch" }`; trả chi tiết đơn |
| GET `/admin/orders?cancelRequestStatus=PENDING` | Trả yêu cầu đang chờ, cũ nhất trước; không lọc riêng PAID |
| POST `/admin/orders/:id/cancel` | `{ "requestId": "UUID", "note": "Ghi chú xử lý tiền" }`; note bắt buộc nếu PAID |
| POST `/admin/orders/:id/cancel-request/reject` | `{ "requestId": "UUID", "reason": "Lý do từ chối" }` |

Lý do/ghi chú được trim, tối đa 500 ký tự. Request id phải là UUID. Body yêu cầu
hủy không nhận trạng thái hoặc số tiền từ client. Danh sách admin bước này chỉ
hỗ trợ `cancelRequestStatus=PENDING`. [Bước 5](task-9-preparation-board.md) bổ sung
filter trạng thái pha chế và API chuyển trạng thái; GET không filter mặc định
trả các đơn PAID/PREPARING/READY.

Gửi lặp lúc chờ trả cùng yêu cầu; duyệt lặp cùng id/cùng quyết định giữ nguyên
mốc/người/ghi chú đã xử lý. Quyết định ngược hoặc id cũ sau khi khách gửi lại
trả 409. Các cột metadata lưu yêu cầu mới nhất của đơn; chưa thêm lịch sử tất cả
phiên yêu cầu. `cancelReason` vẫn là USER_CANCELLED/PAYMENT_TIMEOUT.

## Toàn vẹn và phạm vi tích hợp

- Các thao tác ghi khóa Order trước rồi mới Payment/nguyên liệu/voucher/user.
  Kiểm tra trạng thái và hạn sau khi lấy khóa. Yêu cầu đang chờ chặn cả chuyển
  trạng thái PAID/PAYMENT_FAILED/PREPARING qua hàm chuyển trạng thái chung.
- Đồng ý hủy, hủy ngay và worker hết hạn dùng chung nghiệp vụ: CANCELLED, hoàn
  snapshot nguyên liệu một lần, trả lượt, thu hồi đúng số điểm đã cộng. Payment
  PENDING/CUSTOMER_REPORTED đóng FAILED; SUCCESS cũ giữ nguyên.
- Metadata duyệt, trạng thái/kho/lượt/điểm cùng transaction. Lỗi thu hồi điểm
  rollback cả quyết định duyệt và hoàn kho. Không mở transaction riêng để trả lượt.
- Hủy không ghi đè giỏ mới, không tự dựng lại giỏ đã xóa khi thanh toán thành
  công. Khách chủ động theo liên kết về giỏ để xem các món hiện có.
- Không đổi QR, phân quyền, idempotency hay cách xác nhận tiền của nhóm. Phần
  Payment chỉ thêm cờ chờ hủy, guard thao tác và kiểm tra đơn đã hủy trước khi
  trả kết quả duyệt lặp, để Payment đã đóng không bị duyệt lại.

## Môi trường và kiểm tra

Không thêm migration; sử dụng schema bước 1. Chưa cập nhật database chính hay
image/container Docker 3000/3001. API test dùng `brewlite_cancellation_step4_test`,
UI dùng `brewlite_task9_ui_test` tại 3201/3200, đều có chặn tên database kiểm thử.
Sao lưu Git và log/ảnh ở `D:\Do_an_CNPM\.task9-recovery\cancellation-step4`.

- Backend: 138 unit và 122 PostgreSQL/API test qua, không skip. 12 ca mới kiểm
  tra quyền, request lặp, note/lý do/id, stale review, rollback và các race giữa
  yêu cầu hủy/thanh toán/pha chế/duyệt ngược nhau. Test timeout cũ đã đổi kỳ vọng
  Payment thành FAILED theo quy tắc đóng phiên khi hủy.
- Backend/frontend lint, TypeScript, định dạng và build: qua.
- Playwright desktop/mobile: 52 ca qua trong lượt chung; hai ca lỗi strict
  locator do chọn cả thông báo mặc định của Next.js. Đã giới hạn bộ chọn vào
  thông báo lỗi cần kiểm tra, chạy lại cả hai qua, không skip. Bộ test gồm 44
  ca hồi quy trước đó và 10 ca mới về hủy/yêu cầu/duyệt hủy.
- UI dùng API thật cho hủy checkout/QR, trả lượt, khách gửi lại sau từ chối,
  thông báo nhân viên, khóa duyệt tiền, ghi chú PAID, thu hồi điểm, bảo toàn
  snapshot thanh toán và giỏ. Ca lỗi gửi thử lại chỉ giả lập một response 503;
  request gửi lại và duyệt hủy chạy trên API/database test thật.
- Đã xem ảnh desktop/mobile và kiểm tra không tràn ngang. Các ảnh
  `cancel-restored-voucher-*`, `cancel-qr-*`, `cancel-approved-*`,
  `staff-paid-cancellation-*`, `paid-cancel-points-*` và log nằm trong thư mục
  sao lưu ngoài Git nêu trên.

Lệnh từ backend:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test -- --runInBand
$env:TEST_DATABASE_URL = 'postgresql://brewlite:brewlite@127.0.0.1:5432/brewlite_cancellation_step4_test'
npm.cmd run test:e2e -- --runInBand
```

Lệnh từ frontend: `npm.cmd run test:e2e`, `npm.cmd run lint -- src tests`,
`npx.cmd tsc --noEmit`, `npm.cmd run build`.

Import [Postman riêng cho hủy đơn](task-9-cancellation.postman_collection.json),
điền token khách/admin, orderId và requestId từ response. Không lưu token thật
vào Git. Bước tiếp theo là bảng pha chế PAID → PREPARING → READY → COMPLETED.
