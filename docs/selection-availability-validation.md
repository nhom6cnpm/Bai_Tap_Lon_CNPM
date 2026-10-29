# Kiểm tra số ly còn bán theo lựa chọn

Ngày kiểm tra: 29/10/2026. Nền code: `origin/main` tại `759ad84`.
Nhánh: `feature/task-10-selection-availability`.

| Kiểm tra                                           | Kết quả            |
| -------------------------------------------------- | ------------------ |
| Backend `npm test -- --runInBand`                  | 96/96 qua, 6 suite |
| Backend `npm run lint`                             | Qua                |
| Backend `npm run build`                            | Qua                |
| Frontend `npm run lint`                            | Qua                |
| Frontend `npm run build`                           | Qua                |
| `git diff --check`                                 | Qua                |
| Trình duyệt Edge headless, bản frontend production | 6/6 kịch bản qua   |

Các kịch bản trình duyệt đã chạy bằng Playwright với API được giả lập:

1. Desktop: đổi S/M/L, chọn topping, hết topping, bỏ topping để mua tiếp;
   giới hạn số lượng và thêm món vào giỏ.
2. Desktop: thiếu nguyên liệu dùng chung giữa hai món, giảm số lượng để đặt được;
   lỗi mạng chặn đặt hàng, thử lại khôi phục, giữ nguyên giỏ.
3. Mobile 390×844: cùng kịch bản lựa chọn/topping/thêm giỏ; không tràn ngang.
4. Mobile 390×844: cùng kịch bản giỏ dùng chung nguyên liệu/lỗi mạng/thử lại;
   không tràn ngang.
5. Đổi nhanh size M sang L, phản hồi M về chậm không ghi đè số ly của L.
6. Kho giảm sau khi xem món nhưng trước khi thêm: kiểm tra lại và từ chối thêm
   số lượng vượt kho; giỏ vẫn trống.

Frontend build lần đầu bị chặn tải Google Fonts trong sandbox; lần chạy có quyền
truy cập mạng build thành công. Không sửa cấu hình font của nhóm.

Bộ kiểm tra HTTP dùng controller, service, ValidationPipe thật của Nest và
repository trong bộ nhớ. Các kiểm tra này xác nhận tính toán/HTTP/giao diện;
**chưa kiểm tra PostgreSQL hoặc build/chạy Docker cho thay đổi này** vì Docker
Engine trên máy chưa chạy. Không dùng kết quả này để nghiệm thu thanh toán hoặc
transaction chống vượt kho của Task 10c.

Worktree gốc `Bai_Tap_Lon_CNPM` giữ nguyên lần merge dang dở và 13 đường dẫn
xung đột. Thay đổi mới nằm riêng tại `D:\Do_an_CNPM\BrewLite-availability`.
Tiến độ lưu commit/cập nhật nền được theo dõi trong
[checklist Task 9 và Task 10](task-9-10-plan.md).
