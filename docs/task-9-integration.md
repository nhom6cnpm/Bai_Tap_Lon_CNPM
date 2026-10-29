# Task 9 — lịch sử, chi tiết và xác nhận đơn

Cập nhật 30/10/2026 trên `feature/task-9-integration`. Nhánh dùng main `c12a42c`,
nền Task 10c `65f588c` và frontend Task 8 `702ff42`. Đây là nhánh tích hợp cục bộ;
chưa push, chưa merge main. Phần thanh toán/kho cần được nhóm review cùng các nhánh phụ thuộc.

## API và dữ liệu

| API               | Quyền và kết quả                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `GET /orders/me`  | JWT hợp lệ, danh sách đơn của người đăng nhập, mới nhất trước; bằng ngày thì sắp theo ID giảm dần |
| `GET /orders/:id` | JWT hợp lệ; đơn không tồn tại hoặc của tài khoản khác đều trả 404                                 |

Response đặt `Cache-Control: private, no-store`. Không nhận userId từ trình duyệt,
không trả userId hoặc thông tin giữ nguyên liệu nội bộ. Token của tài khoản đã xóa trả 401.
DTO gồm ID, trạng thái, tổng tiền, thời điểm tạo/hết hạn/hủy, lý do hủy,
phương thức thanh toán, đồng hồ backend, quyền thanh toán và các dòng món.

Migration `1761840000000-OrderItemDisplaySnapshot` thêm tên/ảnh món vào dòng đơn.
Đơn mới lưu tên/ảnh lúc đặt, giá vẫn dùng snapshot `unitPrice`/`lineTotal` hiện có.
Đơn cũ được bổ sung tên/ảnh từ sản phẩm nếu còn; dữ liệu không thể khôi phục được
hiển thị rõ là thông tin cũ không còn, không tạo tên hay giá giả. Migration không
thay đổi giá trị đơn hoặc dựng lại số nguyên liệu đã giữ của đơn cũ.

API payment và mock gateway bổ sung `expiresAt`, `serverTime`, `orderStatus` để
checkout, màn thẻ và điện thoại quét QR cùng dùng thời hạn backend.

## Giao diện

- `/orders`: lịch sử, lọc bảy trạng thái, thông báo đang tải/trống/lỗi và thử lại.
- `/orders/:id`: chi tiết mọi trạng thái, tên món/size/topping/số lượng/giá,
  phương thức thanh toán nếu có, lý do hủy, thời hạn còn lại.
- `/orders/:id/confirmation`: chỉ hiện xác nhận PAID sau khi tải lại từ API.
  Trạng thái khác chuyển về chi tiết; tham số URL không quyết định thanh toán thành công.
- `/checkout/:orderId`: đọc lại đơn của mình từ API, dùng được khi không còn
  snapshot trên máy. PENDING/PAYMENT_FAILED còn hạn mới được thanh toán.
- Dùng Header/Footer, font Arial, màu amber/stone, đăng nhập và giỏ hàng của nhóm.
  Link Đơn hàng xuất hiện sau đăng nhập; hỗ trợ màn hình điện thoại.
- Không thêm Đặt lại, mã nhận nước giả hoặc QR giả để nhận tại quầy. QR hiện có
  là cổng thanh toán mô phỏng của Task 8, không phải QR ngân hàng thật.

Giữ nguyên thời hạn **5 phút từ lúc tạo đơn**. Thất bại không xóa giỏ hoặc tạo
đơn mới. Giỏ có đơn đang giữ nguyên liệu được tiếp tục đơn đó, kể cả availability
đã giảm do chính lượng giữ của đơn. Thanh toán thành công chỉ xóa giỏ khi giỏ
hiện tại vẫn khớp đơn đã thanh toán. Cache lịch sử và dữ liệu phiên checkout
được tách theo tài khoản; đăng xuất không hiển thị đơn đã tải của tài khoản cũ.

## Chạy và kiểm tra

Chạy từ bản checkout của nhánh `feature/task-9-integration` (trên máy Ân là
`D:\Do_an_CNPM\Bai_Tap_Lon_CNPM`), chuẩn bị PostgreSQL và file môi trường như README,
điền cả `JWT_SECRET` và `PAYMENT_GATEWAY_SECRET` trong `backend/.env`.
Chạy backend/frontend hoặc `docker compose up -d --build` để dùng mã mới.
Backend tự chạy migration khi khởi động. Cần sao lưu DB trước khi cập nhật bản nhóm.
Không chạy lệnh Docker này đồng thời từ hai worktree vì Compose đang dùng tên container cố định.

Mở `/menu`, đăng nhập, thêm món vào giỏ, tạo đơn và thanh toán. Có thể mở
`/orders` để tiếp tục đơn chưa hết hạn hoặc xem đơn đã thanh toán. Ví/thẻ và
thông báo lỗi dùng cổng giả lập hiện có; QR điện thoại cần cấu hình địa chỉ LAN
theo README.

Chi tiết kiểm tra và giới hạn: [kết quả kiểm thử](task-9-validation.md).
