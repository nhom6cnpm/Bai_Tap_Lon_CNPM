# Đối chiếu giao diện Task 9 — 29/10/2026

**Cập nhật 30/10:** đã xử lý các khác biệt được liệt kê bên dưới trên nhánh
`feature/task-9-integration`: dùng Header/Footer/auth chung, Arial và amber/stone,
đủ trạng thái và hạn backend, tách chi tiết/xác nhận PAID. Kiểm tra desktop/mobile
và luồng thanh toán thật bằng DB test đã qua. Xem [bản triển khai](task-9-integration.md)
và [kết quả kiểm tra](task-9-validation.md). Phần còn lại của tài liệu là ghi nhận
đối chiếu ban đầu ngày 29/10.

## Nguồn đã kiểm tra

- PDF `BrewLite-CongNghePhanMem.pdf`, trang PDF 4–8: chức năng, wireframe,
  task 9 và các trạng thái đơn; không thấy yêu cầu nút đặt lại.
- [Issue #20](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/20):
  lịch sử/chi tiết đủ trạng thái, thanh toán lại khi còn hạn, xác nhận chỉ khi PAID;
  chưa yêu cầu nút đặt lại.
- [Issue #21](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/21):
  đã đổi hạn giữ nguyên liệu thành 5 phút.
- [Issue #18](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/18):
  vẫn còn ghi hạn đơn/đồng hồ 15 phút; cần đồng bộ với #21.
- Stitch project `12279045623806834658`: hai màn lịch sử
  `b8ffcfeefbb44b35b9fa3fb7f0e3bfaf`, `0efdb92c81a1466bab739fbbe04b800b`
  có “Đặt lại món này”/“Đặt lại đơn này” trên đơn COMPLETED.
- Đã mở menu, chi tiết và giỏ tại cổng 3000; lịch sử và xác nhận mẫu tại 3100.
  Đã xem ảnh chụp trang và kiểm tra font/điều hướng trong trình duyệt.

## Kết quả

Giao diện Task 9 có lịch sử, lọc trạng thái, xem chi tiết, mã đơn và thông tin nhận
tại quầy. Tuy nhiên bản cũ chưa đủ điều kiện xem là đã đồng bộ với ứng dụng nhóm.

| Hạng mục                  | Hiện trạng                                                                                       | Cần làm khi tích hợp                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Header/footer             | Nhóm dùng Header/Footer chung; Task 9 có OrderShell riêng với logo, chiều cao và điều hướng khác | Dùng chung khung ứng dụng, thêm link Đơn hàng khi đăng nhập, giữ badge giỏ và trạng thái tài khoản                       |
| Font                      | Nhóm thực tế render Arial; Task 9 dùng Be Vietnam Pro                                            | Thống nhất font toàn ứng dụng theo lựa chọn chung của nhóm; Stitch dùng Be Vietnam Pro                                   |
| Màu sắc, kích thước       | Menu/giỏ chủ yếu amber và nền trắng; chi tiết dùng xanh/kem; Task 9 xanh đậm và nền xanh nhạt    | Thống nhất màu nút, nền, khoảng cách và chiều rộng theo mẫu chung; nhóm hiện cũng có khác biệt giữa menu/giỏ và chi tiết |
| Điều hướng                | Task 9 riêng chỉ có Trang chủ/Đơn hàng, chưa có giỏ và phiên đăng nhập chung                     | Dùng route menu/cart/login của ứng dụng tích hợp                                                                         |
| Chi tiết/xác nhận         | Bản cũ đưa mọi trạng thái tới `/confirmation`; mẫu BL1042 là PREPARING                           | Tách xem chi tiết cho mọi trạng thái và giới hạn xác nhận theo yêu cầu PAID của #20                                      |
| Hết hạn và thanh toán lại | Bản mẫu chưa có expiresAt, lý do hủy hoặc nút thanh toán lại theo hạn                            | Thêm dữ liệu từ backend, hiển thị hủy do quá hạn; PENDING/PAYMENT_FAILED còn hạn dẫn tới checkout của chính đơn          |
| Mẫu trạng thái            | Demo hiện có PREPARING, COMPLETED, PAYMENT_FAILED                                                | Bổ sung PENDING, PAID, READY, CANCELLED để kiểm tra đầy đủ                                                               |

## Quy tắc 5 phút

Giữ phương án trừ nguyên liệu khi tạo PENDING để giữ chỗ. Thanh toán PAID không
trừ thêm; PAYMENT_FAILED giữ nguyên liệu trong thời hạn còn lại. Hết hạn 5 phút
hoặc hủy đúng quy tắc thì chuyển CANCELLED và hoàn đúng một lần. Thử lại không
tạo lại hạn 5 phút; backend quyết định thời hạn, frontend hiển thị cùng expiresAt.

Đây là yêu cầu cho phần triển khai Task 10c; API availability hiện tại chỉ đọc,
chưa triển khai giữ chỗ/hết hạn. Chưa sửa Issue #18 hoặc nhắn cho thành viên nhóm.

## Nút đặt lại

**Phạm vi đã chốt sau đối chiếu:** bám đề/Issue, bỏ qua chức năng Đặt lại cho
COMPLETED/CANCELLED. Các ghi nhận Stitch dưới đây là kết quả đối chiếu, không
phải hạng mục sẽ triển khai.

- Không bắt buộc trong PDF hoặc Issue #20 đang kiểm tra.
- Có trong mẫu Stitch cho đơn hoàn tất; nếu nghiệm thu theo mẫu này thì cần tính
  đến khi ghép giao diện, thay vì coi đây là yêu cầu không tồn tại.
- Chưa thấy yêu cầu riêng bắt buộc nút đặt lại cho CANCELLED trong các nguồn trên.
- Nếu bổ sung: sao chép lựa chọn vào giỏ để khách kiểm tra giá/stock hiện tại,
  không tự thanh toán và không đổi trạng thái đơn cũ. Đơn mới chỉ được tạo khi
  khách xác nhận đặt hàng. Món/topping đã ngừng bán hoặc thiếu nguyên liệu phải
  được thông báo; không tái sử dụng giá, giảm giá hoặc phiên thanh toán cũ.
- PENDING/PAYMENT_FAILED còn hạn dùng “Thanh toán”/“Thử lại thanh toán” cho cùng
  đơn, khác với “Đặt lại” từ đơn hoàn tất hoặc đã hủy.

Lần kiểm tra này cập nhật tài liệu và ghi nhận khác biệt; chưa sửa giao diện Task 9,
chưa triển khai nút đặt lại hoặc nghiệp vụ Task 10c.
