# Tích hợp thanh toán do nhân viên xác nhận — 30/10/2026

Nhánh `feature/task-9-staff-payment-integration` ghép main `61f4474` (PR #30)
với Task 9, 10c/d, tồn kho theo lựa chọn và voucher trên `8a95e7d`.
Nguồn thay đổi: [Issue #18, cập nhật ngày 30/10](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/18#issuecomment-6514047325).
Quy tắc 5 phút/callback trong tài liệu cũ là lịch sử triển khai trước cập nhật này.

## Luồng hiện tại

1. Giỏ hàng kiểm tra sức bán theo nguyên liệu chung; tăng món này cập nhật mức tối
   đa của các món khác, không tự giảm số lượng khách đã chọn. Giỏ chưa giữ nguyên liệu.
2. Tạo đơn PENDING mới trừ nguyên liệu để giữ chỗ, lưu giá và voucher tại thời điểm đặt.
   Mặc định chờ **15 phút**, lưu `expiresAt` bằng đồng hồ database. Thay cấu hình chỉ
   tác động đơn mới; thử lại/reload/báo chuyển tiền không gia hạn.
3. Chuyển khoản/ví: khách bấm **Tôi đã chuyển tiền** → Payment CUSTOMER_REPORTED;
   Order vẫn PENDING, giỏ còn nguyên. Thẻ thanh toán tại quầy, không nhập số thẻ giả.
4. ADMIN mở `/admin/payments`, đối chiếu và xác nhận → Payment SUCCESS, Order PAID;
   hoặc từ chối → Payment FAILED, Order PAYMENT_FAILED, có lý do cho khách.
5. Khách tự nhận trạng thái qua polling, PAID chuyển đến xác nhận/lịch sử. Chỉ xóa
   giỏ trùng với lần đặt đó; giỏ mới khác được giữ. Đơn thất bại còn hạn được thử lại
   cùng mã đơn và số tiền sau voucher. Hết hạn tự CANCELLED, hoàn nguyên liệu một lần.

QR là liên kết tra cứu đơn trên trang nhân viên, yêu cầu đăng nhập ADMIN; chưa phải
QR ngân hàng/VNPay. Không còn endpoint mock-gateway/callback hoặc PAYMENT_GATEWAY_SECRET.
Trang nhân viên chỉ xác nhận thanh toán; chưa có giao diện chuyển pha chế/hoàn tất.

## Toàn vẹn dữ liệu khi tích hợp

- Mọi thao tác tạo phiên/duyệt/báo/hủy/hết hạn khóa Order trước Payment/nguyên liệu,
  tránh duyệt PAID đồng thời với hoàn kho. PAID không trừ nguyên liệu lần hai.
- Một đơn chỉ tái sử dụng một Payment đang hoạt động, kể cả nhiều request key khác nhau.
  Bảng `payment_request_keys` giữ từng key gắn với user/order/method gốc. Đổi payload
  cho key cũ bị từ chối; thay phương thức khi chưa báo chuyển tiền không làm mất ràng buộc.
- Duyệt lặp hoặc hai nhân viên quyết định đồng thời trả kết quả đầu tiên đã lưu;
  không ghi đè người duyệt, thời gian, lý do hoặc lặp tác động kho. Quyết định khác
  đến sau cũng nhận kết quả đã chốt.
- Báo/duyệt đơn hết hạn trả lỗi sau khi commit CANCELLED và hoàn kho.
  ACTIVE ẩn phiên thuộc đơn đã hủy/hết hạn; ALL vẫn giữ lịch sử.
- Đơn cũ giữ hạn, trạng thái, subtotal/discount/total và snapshot voucher/món.
  Migration backfill request key từ Payment cũ. Hai migration tên khác nhau có
  timestamp 1761850000000 của nhóm và voucher cùng chạy được; giữ tên migration đã áp dụng.
- Đã sao lưu Git, database và cấu hình local vào `.task9-recovery` ngoài repo trước ghép.

## Chạy thử

Tại thư mục repo, mở Docker Desktop rồi chạy:

```powershell
docker compose up -d --build
```

- Khách: http://localhost:3000/menu → chọn món → giỏ → đặt → thanh toán.
- Nhân viên: dùng trình duyệt khác/cửa sổ ẩn danh, đăng nhập rồi mở
  http://localhost:3000/admin/payments. Docker mặc định `admin@brewlite.vn` / `admin123`.
  Chỉnh `ADMIN_EMAIL` / `ADMIN_PASSWORD` trong `.env` gốc nếu muốn; seed không đổi mật
  khẩu của tài khoản đã tồn tại. Chạy backend local đặt hai biến trong `backend/.env`.
- Sau khi khách báo đã chuyển tiền, kiểm tra đơn vẫn PENDING; duyệt ở cửa sổ nhân viên
  và quan sát trang khách tự chuyển sang xác nhận có đúng voucher/tổng tiền.
- Thử từ chối một đơn khác: giỏ còn nguyên, retry không đổi đơn/hạn/số tiền.

Giữ volume PostgreSQL hiện tại; không dùng `down -v` khi cập nhật.

## Phần còn lại

Tích điểm và giới hạn lượt dùng voucher chưa được triển khai. Nhãn kiểu “x3” là
ba lượt dùng cho nhiều đơn, không phải giảm ba lần trên một đơn; hiện vẫn một
mã/đơn, mã còn hạn có thể dùng lại. Đề xuất để nhóm chốt: giữ lượt khi PENDING,
chốt khi PAID, trả lượt khi hủy/hết hạn trước thanh toán; chưa thêm bộ đếm lượt.
Hủy PAID/hoàn tiền,
quay lại giỏ khi hủy thanh toán và màn hình tiến trình pha chế chờ nhóm chốt.
Không thêm các nghiệp vụ đó trong lần tích hợp này.

## Kiểm chứng

- Backend: 138 unit test và 83 e2e PostgreSQL qua, không skip. Các ca cũ đã chuyển
  từ callback sang nhân viên duyệt; thêm phân quyền, CUSTOMER_REPORTED, request key
  khi nhiều phiên gửi lại, duyệt sát hạn/hoàn kho và lọc ACTIVE trước giới hạn 100 dòng.
- Frontend: lint/TypeScript qua. 30 ca hồi quy desktop/mobile qua; hai ca bổ sung
  về đồng hồ sai, tiếp tục CUSTOMER_REPORTED và đăng xuất đã sửa thao tác kiểm thử
  (cần bấm Thanh toán ở checkout) và chạy lại qua trên cả desktop/mobile.
- Hai image Docker build qua; đã chạy lại backend/frontend bằng volume cũ.
  Menu HTTP 200, API có 6 sản phẩm, đăng nhập ADMIN và đọc 8 phiên thanh toán qua.
- Migration kiểm tra trên database bản sao và database thực tế; fingerprint trước/sau
  giữ nguyên dữ liệu có sẵn. Database thực tế ngay trước triển khai: 1 user, 9 đơn,
  11 dòng món, 9 nguyên liệu, 29 dòng giữ nguyên liệu, 8 payment, 3 voucher.
  Sau khởi động chỉ thêm tài khoản ADMIN, dữ liệu cũ vẫn khớp.
- Kiểm tra chỉ đọc trang nhân viên trên Docker: desktop/mobile không tràn ngang,
  xem lịch sử được, đăng xuất ẩn ngay lịch sử. Ảnh lưu ngoài Git tại
  `.task9-recovery/staff-admin-desktop.png` và `staff-admin-mobile.png`.
- Sao lưu ngay trước triển khai: `.task9-recovery/brewlite-staff-deploy.dump` và
  `.task9-recovery/staff-db-deploy-before.json`. Các bản sao trước lúc ghép vẫn được giữ.

Build vẫn có cảnh báo dependency/Node 20 từ nền hiện có (backend audit 4 lỗi,
frontend 2 lỗi; có package yêu cầu Node 22). Đợt này chưa nâng phiên bản thư viện;
cần xử lý riêng trước khi triển khai môi trường thật.
