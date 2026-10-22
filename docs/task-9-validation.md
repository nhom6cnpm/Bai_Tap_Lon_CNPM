# Kết quả kiểm tra task 9

Ngày kiểm tra: 22/10/2026 (Asia/Saigon).
Nhánh: feature/task-9-order-history-handover.

| Kiểm tra | Kết quả |
|---|---|
| Backend npm run build | Qua |
| Backend npm run lint | Qua |
| Backend npm test -- --runInBand | 1 test qua |
| Backend npm run test:e2e với PostgreSQL brewlite_test | 8 test qua, không skip |
| Frontend npm run lint và tsc --noEmit | Qua |
| Frontend production build cục bộ | Qua |
| Docker production build backend/frontend | Qua |
| Docker Compose db/backend/frontend | Cả 3 healthy |
| Playwright desktop + mobile trên bản Docker | 14 test qua, không skip |
| git diff --check | Qua |

Playwright đã kiểm tra: bộ lọc, chi tiết đơn, viewport không tràn ngang, xác nhận
mã/tổng tiền, thanh toán thất bại không hiện thành công, loading/empty/error/retry,
yêu cầu đăng nhập và xóa token hết hạn. Hai ca live đăng nhập bằng tài khoản demo,
đọc các đơn seed từ PostgreSQL, mở xác nhận và tải lại trang.

API được kiểm thử với JWT thật và hai tài khoản riêng: lọc theo chủ đơn thay vì
userId query từ client; không lộ user/userId trong response; 401/400/404; lịch sử
rỗng; người dùng, token và đơn vẫn hoạt động sau khi khởi động lại NestJS.
Database kiểm thử tách biệt; các bản ghi do test tạo được dọn sau khi chạy.

Ảnh chụp giao diện desktop/mobile được tạo và kiểm tra trực quan trong
frontend/test-results (thư mục này được Git ignore).

## Chưa phải nghiệm thu toàn bộ task 9

- Chưa chạy luồng mua hàng từ menu → giỏ → tạo đơn → thanh toán vì các task phụ
  thuộc chưa có trong nhánh gốc. Không coi các đơn seed là giao dịch thanh toán.
- Cần thống nhất schema/API với người làm task 6/7/8 trước khi merge.
- PR và review của thành viên nhóm chưa thực hiện. Không push trực tiếp main.
- Hợp đồng tích hợp và kịch bản demo sau khi ghép nhóm nằm trong
  [task-9-integration.md](task-9-integration.md).

## Tài liệu kỹ thuật tham khảo

- NestJS database providers: https://docs.nestjs.com/techniques/database
- TypeORM migrations và synchronize: https://typeorm.io/docs/data-source/data-source-options/
- Thiết kế Stitch: https://stitch.withgoogle.com/projects/12279045623806834658
