# Bước 5 — bảng pha chế và thông báo nhận món

Ngày 30/10/2026. Nhánh `feature/task-9-preparation-board`, kế thừa bước 4
`5d4620b`. Phạm vi Task 9 và tích hợp với quy tắc hủy Task 10c/e đã chốt.

## Giao diện và luồng xử lý

Nhân viên mở **Quản trị → Đơn hàng** (`/admin/orders`). Hai tab Thanh toán và
Đơn hàng đã có từ bước 4. Trong tab Đơn hàng:

- Phía trên là vùng yêu cầu hủy, truy vấn riêng cả đơn chưa thanh toán và PAID.
- Phía dưới là ba cột **Chờ pha → Đang pha → Sẵn sàng nhận**. Mỗi thẻ có mã đơn,
  thời gian đặt, snapshot món/size/topping/số lượng và tổng tiền đã thanh toán.
- Các nút tương ứng: **Bắt đầu pha → Pha xong → Khách đã nhận**. Xác nhận khách
  đã nhận trước khi hoàn tất; đơn COMPLETED rời bảng nhưng vẫn còn trong lịch sử.
- Đơn PAID có yêu cầu hủy đang chờ vẫn hiện trong cột Chờ pha, khóa nút Bắt đầu
  pha và liên kết lên vùng yêu cầu hủy. Nhân viên xử lý hủy trước khi tiếp tục.
- Bảng làm mới mỗi 4 giây khi đang xem, có nút cập nhật, trạng thái tải/lỗi/thử lại.
  Lỗi thao tác không được frontend tự chuyển thẻ sang cột tiếp theo.
- Mobile xếp cột theo chiều dọc, desktop hiển thị ba cột. Giữ màu/nút/kiểu thẻ
  BrewLite và component snapshot món đã dùng trong lịch sử.

Khách theo dõi lịch sử/chi tiết đơn: polling 4 giây ở lịch sử, 3 giây ở chi tiết.
Khi đơn READY, có thông báo **“Đồ uống đã sẵn sàng, mời bạn ra quầy.”** kèm liên
kết đến đơn. Thông báo riêng theo tài khoản và được ghi nhận trong sessionStorage
của tab để không hiện lặp qua mỗi lần polling hoặc chuyển giữa lịch sử/chi tiết.
Đóng thông báo vẫn giữ trạng thái READY và hướng dẫn nhận món trên đơn.

Thông báo này nằm trong trang lịch sử/chi tiết, không phải push notification khi
đóng ứng dụng. Không có bộ đếm tự chuyển trạng thái hay tự hoàn tất đơn. Màn hình
xác nhận PAID nói cửa hàng đã nhận đơn, chờ tiến trình pha chế trước khi lấy món.

## API và toàn vẹn

| API | Quy tắc |
| --- | --- |
| GET `/admin/orders?status=PAID,PREPARING,READY` | Các đơn đang thực hiện, thời gian đặt cũ nhất trước |
| GET `/admin/orders?status=READY` | Lọc một hoặc nhiều trạng thái hoạt động trong ba trạng thái trên |
| GET `/admin/orders?cancelRequestStatus=PENDING` | Giữ API yêu cầu hủy riêng; không ghép hai loại filter |
| PATCH `/admin/orders/:id/status` | Body `{ "status": "PREPARING" }`, hoặc READY/COMPLETED |

GET không có filter mặc định trả ba trạng thái hoạt động. Filter sai hoặc ghép
`status` và `cancelRequestStatus` trả 400. API dùng JwtAuthGuard + RolesGuard +
ADMIN hiện có; khách không có quyền đọc bảng hay cập nhật trạng thái.

PATCH khóa hàng Order rồi kiểm tra lại trạng thái và yêu cầu hủy. Chuyển trạng
thái qua state machine/hàm chung; không cho nhảy bước, quay lại hoặc đặt PAID,
CANCELLED, PENDING qua API pha chế. Gọi lặp đúng trạng thái đang có trả kết quả
hiện tại; thao tác cũ sau khi đơn đã đi xa hơn bị từ chối, không lùi trạng thái.

Yêu cầu hủy và bắt đầu pha dùng cùng khóa: yêu cầu hủy đi trước thì chặn pha;
pha đi trước thì chặn gửi yêu cầu hủy. Nếu gặp đơn chưa thanh toán đã quá hạn,
commit nghiệp vụ hủy/hoàn kho rồi mới trả lỗi thao tác pha chế không còn hợp lệ.
PAID/PREPARING/READY không bị áp timeout thanh toán.

Pha chế không trừ nguyên liệu hay lượt voucher thêm, không cộng điểm lần nữa,
không thay Payment SUCCESS, tổng tiền hoặc hạn giữ chỗ. Bảng lấy tên/giá món
từ snapshot đơn, không dùng tên/giá catalog hiện tại để thay lịch sử.

Query frontend giữ token của chính phiên gửi request, kiểm tra token sau khi
đọc JSON. Phản hồi trễ từ phiên cũ không xuất hiện dưới tài khoản mới hoặc tạo
thông báo nhận món của người khác. Không thay API đăng nhập, phân quyền, QR
hay luồng nhân viên xác nhận tiền của nhóm.

## Kiểm chứng và môi trường

- Backend: 137 PostgreSQL/API test qua, không skip, gồm 15 ca mới về phân quyền,
  filter, state machine, thao tác lặp/đồng thời, race với hủy, snapshot, kho/lượt/điểm
  và lịch sử COMPLETED. Database riêng `brewlite_preparation_step5_test`.
- 138 unit test qua. Hai ca lọc Payment cũ dùng ngày hết hạn cố định đã quá giờ;
  fixture đổi sang hạn tương đối và vẫn kiểm tra deadline giữ đúng từ đơn.
  Không sửa logic PaymentsService vì thay đổi fixture này.
- Backend/frontend lint, TypeScript, định dạng và production build: qua.
- Playwright desktop/mobile: 60 ca qua trong lượt chung; hai ca xác nhận còn
  dùng câu nhận nước cũ trong bộ test đã được nạp, cập nhật kỳ vọng rồi chạy
  lại cả hai qua, không skip. Tổng cộng 62 ca: 54 hồi quy và 8 ca mới.
- Các ca mới kiểm tra API thật cho đủ các bước pha chế, thông báo READY,
  không báo lặp sau reload, COMPLETED rời bảng nhưng còn trong lịch sử, chặn
  pha khi chờ hủy và mở lại sau từ chối, giữ nguyên điểm/snapshot. Ca thử lại
  giả lập lỗi 503 một lần rồi gửi lại trên API thật; ca đổi phiên kiểm tra
  phản hồi READY trễ của tài khoản cũ không xuất hiện ở tài khoản mới.
- Đã xem ảnh desktop/mobile và kiểm tra không tràn ngang. Log/ảnh ngoài Git
  có `preparation-ready-board-*`, `customer-ready-notice-*`,
  `completed-order-history-*`, `preparation-after-review-*`, `preparation-retry-*`.

Playwright dùng database riêng `brewlite_task9_ui_test`, API/frontend 3201/3200.
Lượt đầu không khởi động được vì Docker đã tắt; đã mở lại Docker Desktop và
kiểm tra PostgreSQL healthy trước khi chạy lại. Các container cũ tự chạy lại
theo cấu hình hiện có, chưa rebuild/thay image hay nâng cấp database chính.

Không thêm migration. Chưa cập nhật bản Docker ở 3000/3001 với bước 1–5. Sao lưu
Git, log và ảnh kiểm tra ở `D:\Do_an_CNPM\.task9-recovery\preparation-step5`.

Lệnh kiểm tra backend:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test -- --runInBand
$env:TEST_DATABASE_URL = 'postgresql://brewlite:brewlite@127.0.0.1:5432/brewlite_preparation_step5_test'
npm.cmd run test:e2e -- --runInBand
```

Frontend: `npm.cmd run test:e2e`, `npm.cmd run lint -- src tests`,
`npx.cmd tsc --noEmit`, `npm.cmd run build`.

[Postman hủy và pha chế](task-9-cancellation.postman_collection.json) dùng token
khách/admin và orderId của môi trường tương ứng. Không lưu token thật vào Git.
Tiếp theo là bước 6: nghiệm thu tích hợp, migration trên bản sao, cập nhật Docker
và chuẩn bị bàn giao/review theo quy tắc nhóm.
