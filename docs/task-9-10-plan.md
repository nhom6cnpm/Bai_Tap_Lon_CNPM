# Thứ tự thực hiện Task 9 và Task 10c/d/e

Cập nhật: 30/10/2026. Đây là checklist theo dõi công việc đã thống nhất với Ân.
Cập nhật dấu hoàn thành theo kết quả thực tế; không đánh dấu xong chỉ vì đã có demo.

## Phạm vi đã chốt

- Bám đề và nhiệm vụ GitHub; bỏ qua chức năng “Đặt lại” đơn hoàn tất/đã hủy.
- Giữ phần “Chỉ còn X ly” theo size/topping vì nhóm đã yêu cầu bổ sung.
- Tạo đơn PENDING thì trừ nguyên liệu để giữ chỗ trong **5 phút từ lúc tạo đơn**.
- PAID không trừ thêm; PAYMENT_FAILED giữ nguyên liệu trong thời gian còn lại.
- Thử lại thanh toán dùng cùng đơn, không gia hạn giữ chỗ.
- Hủy đúng quy tắc hoặc hết hạn thì CANCELLED và hoàn nguyên liệu đúng một lần.
- PENDING/PAYMENT_FAILED còn hạn có nút Thanh toán; hết hạn không thanh toán được.
- Tuân thủ [quy ước trong README](../README.md): nhánh riêng theo task, commit đúng
  quy ước, chạy lint/format và kiểm thử; tạo PR, có ít nhất một người review trước
  khi merge; không push trực tiếp main hoặc commit bí mật/node_modules.

## 1. Lưu công việc và chuẩn bị nền tích hợp — đã hoàn thành

- [x] Tạo nhánh `feature/task-10-selection-availability` từ nền main `759ad84`.
- [x] Làm API và giao diện số ly theo size/topping, xét nguyên liệu dùng chung.
- [x] Kiểm tra phần bổ sung: 96 test backend, 6 kịch bản trình duyệt;
      lint/build frontend và backend qua. [Chi tiết](selection-availability-validation.md).
- [x] Format/rà soát diff cuối, commit phần tồn kho và tài liệu liên quan (`afe6c25`).
- [x] Chuẩn bị các nhánh/thay đổi riêng cho task 9 và task 10, bảo toàn bản cũ đang
      merge dang dở; dùng schema/migrations/auth hiện tại của nhóm khi tích hợp.
- [x] Cập nhật nền main `c12a42c`, đã có backend Task 8; giữ cả request tồn kho
      và thanh toán trong Postman. Sửa lỗi thụt dòng Docker Compose từ main.
- [x] Sau cập nhật: 108/108 test backend qua, lint/build hai phần qua;
      Docker Compose kiểm tra cấu hình hợp lệ. Chưa nghiệm thu DB/thanh toán end-to-end.

Nhánh Task 10: `feature/task-10-selection-availability`, thư mục `BrewLite-availability`.
Nhánh Task 9: `feature/task-9-integration`, thư mục chính `Bai_Tap_Lon_CNPM`,
đã tích hợp UI/API theo schema/auth hiện tại và frontend Task 8 `702ff42`.

Bản cũ được sao lưu tại `.task9-recovery/task9-before-step1-20261029-224424.zip`
trong workspace. Đã đối chiếu hash 47 file làm việc và 5 file metadata Git, tất cả
giữ nguyên sau khi chuẩn bị nhánh. Chưa push hoặc merge vào main.

Ngày 30/10 đã sao lưu thêm 121 file (gồm cấu hình local), kết thúc lần merge cũ
và chuyển thư mục chính sang nhánh tích hợp `4270997`. Không còn 13 file xung đột;
nhánh Task 9 cũ và bản sao lưu vẫn còn. Xem [ghi nhận chuyển thư mục](workspace-recovery.md).

## 2. Hoàn thiện Task 10c — đã triển khai và kiểm thử backend

- [x] Backend áp dụng hạn 5 phút và trả expiresAt trong response tạo đơn.
- [ ] Nhóm đồng bộ checkout/Issue #18 với hạn 5 phút và expiresAt của backend;
      chưa gửi tin nhắn hoặc sửa Issue thay thành viên nhóm.
- [x] Tính nguyên liệu cả đơn; tạo đơn và trừ kho trong một transaction với
      optimistic locking bằng version; thiếu nguyên liệu thì không lưu/trừ gì.
- [x] Lưu đủ thông tin để hủy/hết hạn hoàn đúng nguyên liệu, đúng một lần.
- [x] Tự hủy PENDING/PAYMENT_FAILED quá hạn; thử lại không kéo dài thời hạn.
- [x] Cập nhật trạng thái dưới khóa đơn chung để hết hạn và thanh toán không cùng thành công.
- [x] Kiểm thử PostgreSQL thật: đặt đồng thời, rollback, hủy/hoàn lặp, hết hạn,
      thanh toán sát thời hạn; dùng database kiểm thử riêng.
- [x] 108 test không DB và 24 test e2e PostgreSQL qua; lint/build hai phần qua.
- [x] Build image backend Docker và khởi động kiểm tra với database test; không
      thay container backend/frontend hoặc chạy migration trên DB đồ án hiện tại.

Chi tiết: [Task 10c — API, migration và kiểm thử](task-10c-inventory.md).

## 3. Hoàn thiện Task 9 và đồng bộ giao diện — đã triển khai và kiểm thử

- [x] Ghép phần task 9 vào nền code nhóm, dùng chung auth và schema đơn hàng.
- [x] GET /orders/me và /orders/:id có JWT; chỉ truy cập đơn của mình;
      mới nhất trước; đơn người khác trả 404.
- [x] Dùng Header/Footer và trạng thái tài khoản/giỏ chung; thêm link Đơn hàng
      khi đăng nhập; đồng bộ font, màu, nút và khoảng cách với các trang trước.
- [x] Hiển thị đủ trạng thái, gồm PAYMENT_FAILED và lý do hủy do quá hạn;
      có loading/empty/error/retry.
- [x] Nút Thanh toán cho PENDING/PAYMENT_FAILED còn hạn dẫn tới cùng đơn;
      màn xác nhận theo yêu cầu PAID; không bổ sung chức năng Đặt lại.
- [x] Kiểm tra desktop/mobile và toàn bộ trạng thái với dữ liệu kiểm thử.

Xem [bản triển khai và cách chạy](task-9-integration.md),
[kết quả kiểm thử](task-9-validation.md) trong worktree Task 9.
Backend có 108 unit/HTTP test và 37 e2e PostgreSQL qua; giao diện kiểm tra cả ví QR,
thẻ thất bại rồi thử lại cùng đơn, giới hạn xác nhận PAID và thời hạn backend.
22/22 kiểm tra Playwright desktop/mobile qua; lint/build và build image Docker hai
phần qua. Migration image backend chạy được trên database Docker test riêng.
Ngày 30/10 đã đưa code về thư mục chính và cập nhật container 3000/3001 sau sao lưu;
đối chiếu dữ liệu và migration trên bản sao/DB thật đều qua. Nhánh Task 9 phụ thuộc nền Task 10c và
frontend Task 8; cần review các phần phụ thuộc trước khi đưa lên main.

Xem [kết quả đối chiếu giao diện](task-9-ui-review.md).

## 4. Tích hợp Task 10d với Task 8

**Bước tiếp theo:** rà soát tiêu chí Task 10d trên nền Payment/transaction đang có;
không tạo module thanh toán thứ hai. Task 10e vẫn cần nhóm chốt quy tắc nghiệp vụ.

- [ ] Thống nhất phạm vi với Tài, dùng chung phần Payment/idempotency/callback.
- [ ] Cùng Idempotency-Key, kể cả gửi đồng thời, chỉ tạo một Payment.
- [ ] Callback lặp không đổi trạng thái hoặc cộng điểm lần hai.
- [ ] Kiểm tra transaction Payment/Order và tình huống hủy/hết hạn ở bước 2.

Backend Task 8 đã có trong main `c12a42c`; dùng phần hiện có để rà soát và tích hợp.
Phối hợp thiết kế từ bước 2, kiểm chứng với DB thật và giao diện thanh toán khi sẵn sàng.

## 5. Hoàn thiện Task 10e — giảm giá và điểm thưởng

- [ ] Nhóm xác định mã, mức giảm, điều kiện áp dụng và tỷ lệ tích điểm;
      không tự đặt quy tắc chưa được giao.
- [ ] Áp mã hợp lệ khi tạo đơn, tính giá trên backend và lưu kết quả trên đơn.
- [ ] Cộng loyaltyPoints đúng một lần sau PAID, dùng chung luồng thanh toán.
- [ ] Kiểm thử mã sai/hết hạn/không đủ điều kiện và callback lặp.

## 6. Kiểm thử tích hợp và bàn giao

Đã hoàn tất việc thống nhất thư mục chính, cập nhật Docker và kiểm tra bảo toàn
dữ liệu khi đưa Task 9/10c vào chạy. Checklist dưới đây là nghiệm thu cuối **cả
Task 9 và Task 10c/d/e**, còn chờ hoàn thiện 10d/e.

- [ ] Lint, format, build và các test cần thiết của cả hai task đều qua.
- [ ] Chạy Docker cùng PostgreSQL thật; kiểm tra migration và bảo toàn dữ liệu.
- [ ] Demo chọn món → giỏ → đăng nhập → tạo đơn → thanh toán → xác nhận → lịch sử.
- [ ] Kiểm tra nhánh lỗi, thử lại trên cùng đơn và hết hạn 5 phút/hoàn kho.
- [ ] Cập nhật README, Postman, kết quả kiểm tra; PR riêng theo task và review nhóm.

## Nguồn yêu cầu

- Đề PDF `BrewLite-CongNghePhanMem.pdf`.
- [Task 9 — Issue #20](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/20).
- [Task 10 — Issue #21](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/21).
- [Task 8 — Issue #18](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/18).
- Chốt trong trao đổi: thời hạn 5 phút, giữ tính năng số ly theo lựa chọn,
  bỏ qua Đặt lại và bám phạm vi đã giao.

## Vị trí làm việc

- `D:\Do_an_CNPM\BrewLite-availability`: code nhóm + phần số ly mới và checklist này.
- `D:\Do_an_CNPM\Bai_Tap_Lon_CNPM`: thư mục làm việc chính, nhánh
  `feature/task-9-integration`, đã chứa Task 9, nền Task 10c và frontend Task 8;
  không còn xung đột merge.
- `D:\Do_an_CNPM\BrewLite-task9-integration`: bản đối chiếu ở commit `4270997`
  (detached HEAD); tiếp tục phát triển trong thư mục chính.
- `D:\Do_an_CNPM\BrewLite-task9-preview`: bản xem thử giao diện task 9 tại cổng 3100,
  dùng dữ liệu mẫu; không phải bản tích hợp thanh toán của nhóm.
