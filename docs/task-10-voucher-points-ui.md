# Bước 3 — giao diện lượt voucher và điểm thưởng

Ngày 30/10/2026. Nhánh `feature/task-10-voucher-points-ui`, tiếp nối backend
`c7f7aa9`. Phạm vi Task 9/10e và các điểm tích hợp hiển thị tài khoản/giỏ hàng.

## Hành vi đã triển khai

- Hộp chọn voucher giữ hình vé và màu BrewLite; có nhãn `Còn N lượt` và
  `N lượt đang giữ` từ API quote có JWT. Một mã cho một đơn, một lượt cho một đơn.
- Mã dùng hết được backend bỏ khỏi danh sách. Mã hết khả dụng vì đang giữ vẫn
  hiện nhưng khóa chọn, giải thích lý do. Hủy đơn chưa thanh toán trả lượt thì
  danh sách cập nhật lại khi mã còn hiệu lực.
- Vẫn hỗ trợ chọn mã công khai, nhập mã riêng, bỏ/đổi mã và thông báo lỗi.
  Khi xác nhận lựa chọn, kiểm tra lại bằng API; tạo đơn vẫn kiểm tra quota ở backend.
- Danh sách trong hộp làm mới mỗi 5 giây, quote ngoài hộp mỗi 15 giây khi hiển thị.
  Chưa đăng nhập chỉ xem điều kiện chung và lời nhắc đăng nhập để xem lượt cá nhân.
- Header lấy số dư từ `GET /auth/me`, làm mới khi xem dữ liệu đơn đã thay đổi,
  quay lại cửa sổ và định kỳ 15 giây. Có nút thử lại khi lấy số dư thất bại.
- Checkout hiển thị điểm dự kiến cho đơn chưa thanh toán. Lịch sử, chi tiết và
  xác nhận hiển thị điểm đã cộng hoặc đã thu hồi theo trường lưu trên đơn.
  10.000đ thực trả sau voucher = 1 điểm, làm tròn xuống; chưa có đổi điểm.
- Đơn policy 0 không hiện điểm theo chính sách mới. Trường hợp đã xử lý nhưng
  được 0 điểm vẫn hiển thị đúng. Không suy đoán đã cộng điểm chỉ từ trạng thái PAID.
- Bảng tiền tiếp tục dùng snapshot subtotal/discount/total và thông tin voucher;
  thu hồi điểm không sửa số tiền lịch sử.

## Đồng bộ tài khoản và tích hợp

Query voucher/profile tách theo token. Phản hồi trễ của phiên cũ không ghi đè
profile hoặc áp voucher cho phiên mới. Kiểm tra cấu trúc dữ liệu API; lỗi mạng
không xóa phiên hiện tại, 401 chỉ xóa đúng phiên đã gửi request.

Khi khôi phục checkout từ giỏ, đợi tải đơn đang giữ trước khi quote giỏ mới,
tránh báo hết lượt đối với chính lượt đã giữ cho đơn đang thanh toán.

Không thay API Auth, phân quyền, QR, PaymentsService hoặc luồng nhân viên xác
nhận thanh toán của nhóm. Backend ở bước này chỉ thêm log lỗi/cảnh báo cho
server kiểm thử; Playwright tăng thời gian chờ API khởi động từ 60 lên 120 giây.

## Kết quả kiểm tra

- ESLint frontend `src tests`, TypeScript và production build: qua.
- Bộ Playwright desktop/mobile có 44 ca. Lần chạy chung: 42 qua, hai ca lỗi
  strict locator vì test đọc lịch sử trước khi chuyển sang chi tiết xong.
  Đã thêm chờ URL/tiêu đề; chạy lại riêng cả hai: 2/2 qua, không skip.
- Các ca API thật kiểm tra giữ hết ba lượt, khóa chọn, trả lượt khi hủy đơn
  PENDING, dùng hết sau ba đơn PAID, nhập lại mã hết lượt, số dư và điểm từng đơn.
  Luồng QR khách báo chuyển tiền/nhân viên duyệt có kiểm tra cập nhật điểm.
- Các ca giả lập phản hồi API kiểm tra thu hồi điểm và số dư, đơn nhận 0 điểm,
  dữ liệu thiếu mốc cộng điểm, lỗi profile/quote và thử lại, đổi tài khoản/logout
  khi request cũ còn chờ. Hành vi thu hồi trong database đã kiểm tra ở bước 2;
  bước 3 chưa mở API hay nút duyệt hủy PAID.
- Kiểm tra hiển thị và không tràn ngang trên desktop/mobile. Ảnh và log lưu
  ngoài Git tại `D:\Do_an_CNPM\.task9-recovery\benefits-step3`:
  `voucher-all-held-*`, `voucher-use-restored-*`, `reversed-points-*`,
  `order-earned-points-*`, cùng log test/build. Bản sao Git trước bước này:
  `before-step3.bundle`.

Lệnh kiểm tra từ thư mục `frontend`:

```powershell
npm.cmd run lint -- src tests
npx.cmd tsc --noEmit
npm.cmd run test:e2e
npm.cmd run test:e2e -- --grep 'hides fully consumed' --reporter=line
npm.cmd run build
```

Playwright chỉ dùng database `brewlite_task9_ui_test` có chặn tên `_ui_test`,
API/frontend riêng ở 3201/3200. Đây là dữ liệu fixture, không phải dữ liệu đồ án.
Lệnh test khởi tạo lại database kiểm thử; không dùng URL database chính.

## Trạng thái môi trường và bước tiếp theo

Code giao diện đã hoàn thành trên nhánh riêng. Chưa nâng cấp database chính,
build lại image hay thay container ở 3000/3001, chưa push/merge main. Vì vậy bản
Docker đang chạy chưa có lượt voucher và điểm mới của bước 2–3.

Tiếp theo là bước 4: hủy ngay khi được phép, gửi yêu cầu hủy và nhân viên
duyệt/từ chối theo phương án đã chốt. Bảng pha chế thuộc bước 5. Cập nhật Docker,
kiểm tra migration/bảo toàn dữ liệu và nghiệm thu toàn bộ thuộc bước 6.
