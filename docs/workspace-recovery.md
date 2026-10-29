# Thống nhất thư mục dự án — 30/10/2026

Thư mục chính: `D:\Do_an_CNPM\Bai_Tap_Lon_CNPM`.
Nhánh làm việc: `feature/task-9-integration`, dựa trên bản đã kiểm thử `4270997`.

## Xử lý lần merge cũ

Lần merge main `71109a1` vào Task 9 cũ `0efe6d5` để lại 13 đường dẫn xung đột.
Các phần auth/schema/layout của bản cũ khác code nhóm. Nhánh tích hợp đã chuyển
Task 9 sang schema, auth và khung giao diện của nhóm, kèm nền Task 10c và frontend
Task 8; không cần giữ lần merge cũ để phát triển tiếp.

Trước khi chuyển thư mục chính:

1. Đối chiếu bản sao lưu ngày 29/10: 52 file code/metadata vẫn khớp SHA-256.
2. Sao lưu mới 121 file, gồm các file Git theo dõi, metadata merge và cấu hình local.
   Đọc lại archive, kiểm tra CRC và hash từng file, khớp nội dung trên đĩa.
3. Chuyển worktree tích hợp phụ sang detached HEAD tại `4270997`, giải phóng nhánh.
4. Hủy lần merge dang dở bằng `git merge --abort`, rồi chuyển thư mục chính sang
   `feature/task-9-integration`. Không dùng reset/clean, không force nhánh.
5. Kiểm tra thư mục chính sạch, không còn unmerged paths. Giữ nguyên nhánh cũ
   `feature/task-9-order-history-handover` tại `0efe6d5` và các file môi trường local.

Nhánh tích hợp chưa được push, nên bỏ tracking tới `origin/main` vốn có từ lúc
tách nhánh. Khi bàn giao, push nhánh feature và tạo PR theo README; không push main.

## Bản lưu cục bộ

- `.task9-recovery/task9-before-primary-folder-20261030-004210.zip`: snapshot trước chuyển,
  gồm `recovery-manifest.json` với hash từng file.
- `.task9-recovery/task9-before-step1-20261029-224424.zip`: bản lưu trước bước chuẩn bị.
- `.task9-recovery/brewlite-before-task9-primary-20261030.dump`: pg_dump custom
  trước cập nhật Docker; SHA-256
  `A1D14C2F38A132ED168F7DDF477A2CC6742D2CC01B5DD9E5EB3FB4AA105FF2C6`.
- `BrewLite-task9-integration`: worktree đối chiếu commit `4270997`.
- `BrewLite-task9-preview`: bản giao diện mẫu cũ; không dùng để nghiệm thu API thật.

Các archive có cấu hình riêng của máy, nằm ngoài repository; không commit hoặc
đưa archive lên GitHub. Database PostgreSQL được sao lưu riêng trước cập nhật Docker.

## Tiếp tục làm việc

Mở VS Code tại thư mục chính, dùng README và `docs/task-9-10-plan.md` tại đây.
Các thư mục phụ còn giữ để đối chiếu; không tiếp tục sửa code Task 9 trong chúng.
Thư mục `BrewLite-availability` vẫn giữ nhánh Task 10 để review phần kho riêng.

## Docker và database

Root `.env` local đặt `COMPOSE_PROJECT_NAME=brewlite-availability` để khi chạy
Compose từ thư mục chính vẫn dùng đúng project/volume cũ. Đây là cấu hình riêng
của máy; không commit `.env`. Thông tin project còn hiện đường dẫn worktree cũ
trong service PostgreSQL vì container này được giữ nguyên; backend/frontend đã
được tạo lại từ Compose của thư mục chính.

Đã khôi phục dump sang `brewlite_primary_migration_test` để chạy thử migration,
rồi cập nhật hai container ứng dụng. PostgreSQL và volume
`brewlite-availability_pgdata` không bị xóa. Đối chiếu fingerprint trên bản sao
và DB đang dùng cho thấy dữ liệu tài khoản, giá/chi tiết đơn và nguyên liệu giữ
nguyên. Đơn chưa thanh toán cũ quá hạn được worker hủy theo quy tắc 5 phút.

Để xem: mở `http://localhost:3000/menu`, đăng nhập rồi mở Đơn hàng. Khi sửa code,
chạy `docker compose up -d --build` tại thư mục chính để cập nhật image/container.
Kết quả kiểm tra: [Task 9 validation](task-9-validation.md).
