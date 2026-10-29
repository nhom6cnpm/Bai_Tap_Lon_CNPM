# Nền tích hợp Task 9

Chuẩn bị ngày 29/10/2026, nhánh `feature/task-9-integration`, tách từ main
`c12a42c` (đã có backend thanh toán Task 8). Commit `9616ee3` sửa thụt dòng
dịch vụ backend trong Docker Compose. Chưa đưa giao diện/API Task 9 vào nhánh này.

## Nền code dùng chung

| Phần | Dùng theo code nhóm hiện tại |
| --- | --- |
| Tài khoản | `backend/src/auth/user.entity.ts`; user ID là UUID |
| Đăng nhập frontend | `frontend/src/lib/auth.ts`, hook `useAuth`; localStorage `brewlite_token` và `brewlite_user` |
| Đơn hàng | `backend/src/orders/order.entity.ts`; ID chuỗi `ORD-...`, trạng thái theo `order-status.ts` |
| Chi tiết đơn | `order-item.entity.ts`: productId, size, toppingIds, qty, unitPrice, lineTotal |
| Thanh toán | PaymentsModule, Payment entity, MockGatewayModule hiện có từ Task 8 |
| DB | TypeORM, migration trong `backend/src/migrations`; thay đổi schema dùng migration mới |
| Khung giao diện | Header, Footer, QueryProvider, route menu/cart/login của nhóm |

## Khi thực hiện bước tích hợp Task 9

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

Bản `D:\Do_an_CNPM\Bai_Tap_Lon_CNPM` vẫn ở nhánh cũ với 13 đường dẫn xung đột;
không abort/reset hoặc ghi đè khi tạo nhánh tích hợp. File đang thay đổi và metadata
merge đã được sao lưu vào `D:\Do_an_CNPM\.task9-recovery` trước khi chuẩn bị nhánh.
Giao diện mẫu cổng 3100 nằm trong worktree preview riêng, chưa phải bản tích hợp.

Checklist chung ở `BrewLite-availability/docs/task-9-10-plan.md` trong cùng workspace.
