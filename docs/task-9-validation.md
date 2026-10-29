# Kiểm tra Task 9 — 30/10/2026

Nền: main `c12a42c`, Task 10c `65f588c`, frontend Task 8 `702ff42`.
Các kiểm tra sử dụng database riêng; không reset DB `brewlite`, không thay các
container backend/frontend đang chạy ở 3001/3000.

## Backend

- 108 unit/HTTP test không DB: qua.
- 37 e2e test trên PostgreSQL thật, hai suite, không skip: qua.
  Bao gồm 24 kiểm tra đặt đơn/giữ kho/hủy/hết hạn/thanh toán đồng thời đã có và
  13 kiểm tra mới của lịch sử, quyền truy cập, DTO và migration snapshot.
- Lint và build: qua.

DB kiểm thử backend là `brewlite_task9_test`. Ví dụ PowerShell:

```powershell
cd backend
$env:TEST_DATABASE_URL='postgresql://brewlite:brewlite@localhost:5432/brewlite_task9_test'
npm run test:e2e -- --runInBand
```

Guard bắt buộc database có hậu tố `_test`; test xóa dữ liệu trong database được chỉ định.

## Trình duyệt

**Kết quả cuối: 22/22 qua, không skip** (11 kịch bản × desktop/mobile).
Lint frontend qua; production build qua cả trên host và khi build image Docker.

Playwright kiểm tra desktop 1280×900 và điện thoại iPhone 13 mô phỏng bằng Chromium.
Trên Windows dùng Edge đã cài; môi trường khác cần cài Chromium của Playwright.

Các kịch bản: đăng nhập quay lại lịch sử; lịch sử trống; đủ bảy trạng thái/lọc/lý do
hủy; loading/lỗi/thử lại/đăng xuất; token hết hiệu lực; không tồn tại/không được
xem đơn; chỉ PAID được xác nhận; khôi phục checkout từ API; đồng hồ trình duyệt
lệch hai ngày; hết hạn không thanh toán; ví QR từ trình duyệt thứ hai chưa đăng
nhập; thẻ thất bại giữ giỏ rồi thanh toán lại cùng đơn và cùng hạn.
Hai tình huống bổ sung kiểm tra giỏ có đơn đang giữ nguyên liệu vẫn tiếp tục được
khi availability bằng 0, và thanh toán đơn cũ không xóa giỏ mới đã thay đổi.

Luồng ví/thẻ dùng API, JWT, Payment, đơn và DB thật. Các tổ hợp trạng thái/error
UI còn lại dùng response mô phỏng có kiểm soát để bao phủ giao diện; không đưa
dữ liệu mô phỏng vào đường chạy ứng dụng.

```powershell
# Tạo database brewlite_task9_ui_test trước, rồi:
cd frontend
npm run test:e2e
```

Test tự build backend, khởi động API 3201/frontend 3200 và dừng server khi xong.
Server test bắt buộc tên database kết thúc `_ui_test`, kiểm tra tên DB thực tế
trước khi reset các bảng test. Không dùng URL DB đồ án cho lệnh test.
Ảnh chụp và trace lỗi nằm trong `frontend/test-results`, được Git bỏ qua.

## Docker

`docker compose -p brewlite-task9-integration build backend frontend`: qua,
bao gồm TypeScript và production build của frontend. Khởi động Nest application
context từ image backend với `brewlite_task9_docker_test`: qua; đủ năm migration,
gồm migration giữ nguyên liệu và snapshot tên/ảnh món.

Chỉ build image và chạy container kiểm tra tạm; container 3000/3001 và DB đồ án
chưa được chuyển sang bản này. Chưa chạy kiểm thử UI trên stack Docker đầy đủ.
Build còn cảnh báo từ bộ dependency hiện có: Node 20 thấp hơn engine yêu cầu của
một số gói backend, npm audit báo backend bốn mục và frontend production hai mục.
Chưa nâng phiên bản dependency trong phạm vi Task 9; cần nhóm rà soát riêng trước triển khai công khai.

## Phần chưa nghiệm thu toàn đồ án

- Task 10d cần rà soát đầy đủ yêu cầu idempotency với phần Payment của Task 8.
- Task 10e chưa triển khai: cần quy tắc mã giảm giá và tỷ lệ/điều kiện tích điểm từ nhóm.
- Chưa cập nhật Issue/nhắn nhóm, push hoặc merge main. Các nhánh phụ thuộc cần review.
- QR được kiểm tra bằng trình duyệt thiết bị thứ hai, chưa quét bằng điện thoại vật lý qua Wi-Fi.
