# Nền tích hợp Task 9

Chuẩn bị ngày 29/10/2026, nhánh `feature/task-9-integration`, tách từ main
`c12a42c` (đã có backend thanh toán Task 8). Commit `9616ee3` sửa thụt dòng
dịch vụ backend trong Docker Compose. Ngày 30/10 đã tích hợp API/giao diện Task 9,
nền giữ kho Task 10c `65f588c` và frontend thanh toán Task 8 `702ff42`.
Xem [bản triển khai](task-9-integration.md) và [kết quả kiểm tra](task-9-validation.md).

## Nền code dùng chung

| Phần               | Dùng theo code nhóm hiện tại                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------- |
| Tài khoản          | `backend/src/auth/user.entity.ts`; user ID là UUID                                           |
| Đăng nhập frontend | `frontend/src/lib/auth.ts`, hook `useAuth`; localStorage `brewlite_token` và `brewlite_user` |
| Đơn hàng           | `backend/src/orders/order.entity.ts`; ID chuỗi `ORD-...`, trạng thái theo `order-status.ts`  |
| Chi tiết đơn       | `order-item.entity.ts`: productId, size, toppingIds, qty, unitPrice, lineTotal               |
| Thanh toán         | PaymentsModule, Payment entity, MockGatewayModule hiện có từ Task 8                          |
| DB                 | TypeORM, migration trong `backend/src/migrations`; thay đổi schema dùng migration mới        |
| Khung giao diện    | Header, Footer, QueryProvider, route menu/cart/login của nhóm                                |

## Các nguyên tắc đã áp dụng khi tích hợp Task 9

- Chuyển có chọn lọc nội dung lịch sử/chi tiết/xác nhận từ bản cũ `0efe6d5`;
  không đưa bộ entity/migration/auth cũ vào nền mới.
- Thêm GET /orders/me và GET /orders/:id có JWT, chỉ trả đơn của mình;
  route /me được khai báo trước /:id; đơn tài khoản khác trả 404.
- Thống nhất response DTO với các trường hiện có; tên món/topping lấy từ dữ liệu
  phù hợp. Những thông tin backend chưa lưu không được hiển thị bằng số liệu giả.
- Hiển thị mọi trạng thái trong lịch sử/chi tiết. Màn xác nhận theo yêu cầu PAID;
  PENDING/PAYMENT_FAILED còn hạn dẫn tới checkout của cùng đơn.
- Task 10c cung cấp nghiệp vụ giữ nguyên liệu trong 5 phút, thời hạn và lý do hủy.
  Giao diện dùng dữ liệu thời hạn của backend, không gia hạn khi thử lại.
- Dùng chung Header/Footer/auth và thống nhất cách trình bày với các trang trước.
- Bỏ qua chức năng Đặt lại theo phạm vi đã chốt.

## Bảo toàn bản cũ

Bản `D:\Do_an_CNPM\Bai_Tap_Lon_CNPM` đã chuyển sang `feature/task-9-integration`
ngày 30/10, không còn xung đột. Trước khi chuyển đã sao lưu và kiểm tra hash 121
file, gồm code, metadata merge và cấu hình local; 52 file của bản sao lưu trước
vẫn nguyên vẹn. Lần merge cũ được hủy sau sao lưu; nhánh cũ vẫn giữ commit `0efe6d5`.
Không reset nhánh, xóa lịch sử hoặc ghi đè cấu hình local. Worktree
`BrewLite-task9-integration` giữ commit `4270997` ở detached HEAD để đối chiếu.
Giao diện mẫu cổng 3100 thuộc worktree preview riêng, không phải ứng dụng chính.

Chi tiết: [đưa bản tích hợp về thư mục chính](workspace-recovery.md).

Checklist chung ở `BrewLite-availability/docs/task-9-10-plan.md` trong cùng workspace.
