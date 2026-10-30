# Bàn giao Task 9 và Task 10c/d/e — 30/10/2026

Nhánh `feature/task-9-10-handoff`, kế thừa toàn bộ bước 1–5 và main `61f4474`
(PR #30). Đã fetch lại trước chuẩn bị bàn giao, không thiếu commit main tại lần
đối chiếu này. Phạm vi gồm phần của Ân và các điểm tích hợp đã thống nhất; không
đánh dấu các task khác hoặc toàn bộ đồ án đã nghiệm thu.

## Bản chạy hiện tại

Đã cập nhật frontend/backend Docker trên máy Ân, dùng lại volume
`brewlite-availability_pgdata`, project `brewlite-availability`:

- Khách: http://localhost:3000/menu
- Lịch sử: http://localhost:3000/orders
- Nhân viên xác nhận tiền: http://localhost:3000/admin/payments
- Nhân viên duyệt hủy và pha chế: http://localhost:3000/admin/orders
- API: http://localhost:3001

Cả PostgreSQL, backend và frontend đều healthy. Compose có healthcheck đọc
API/Menu, frontend đợi backend healthy. Không xóa/tạo lại volume hoặc đổi
JWT_SECRET. Dùng `.env` gốc hiện có; các file `.env` không được đưa vào Git.

Máy khác mở Docker Desktop, từ thư mục gốc repo:

```powershell
docker compose up -d --build
docker compose ps
```

Backend tự chạy migration khi khởi động. Chạy lần sau không đổi code/image chỉ
cần `docker compose up -d`. Sau sửa code cần build lại service bị thay đổi.
Quét QR bằng điện thoại vẫn theo [hướng dẫn địa chỉ LAN](../README.md).

## Luồng demo đầy đủ

Mở cửa sổ khách và cửa sổ ẩn danh/profile khác cho nhân viên để tách tài khoản.
Admin local mặc định theo Compose: `admin@brewlite.vn` / `admin123`; cấu hình
`ADMIN_EMAIL`/`ADMIN_PASSWORD` nếu dùng giá trị khác. Seed không đổi mật khẩu
tài khoản đã có.

1. Khách chọn món, size/topping/số lượng, thêm vào giỏ và đợi thông báo đã thêm.
   Sức bán xét nguyên liệu dùng chung; xem giỏ/quote chưa giữ nguyên liệu.
2. Đăng nhập/đăng ký, chọn voucher có sẵn hoặc nhập mã; xem bảng tiền sau giảm.
3. Đặt đơn PENDING giữ nguyên liệu và một lượt voucher. Hạn mặc định **15 phút**
   từ lúc tạo đơn, không gia hạn khi tải lại/thử lại/báo chuyển tiền/yêu cầu hủy.
4. Chọn Ví/Thẻ. Ví: bấm **Tôi đã chuyển tiền**, đơn vẫn PENDING. QR hiện tại là
   mã tra cứu cho nhân viên, không phải QR ngân hàng/VNPay.
5. Nhân viên ở `/admin/payments` xác nhận tiền: đơn PAID, chốt lượt và cộng
   `floor(tổng thực trả / 10.000)` điểm đúng một lần. Khách thấy xác nhận/điểm.
6. Nhân viên ở `/admin/orders`: **Bắt đầu pha → Pha xong → Khách đã nhận**.
   Khách xem lịch sử/chi tiết để nhận thông báo READY; COMPLETED còn trong lịch sử.

Nhánh thử lại: nhân viên từ chối tiền → PAYMENT_FAILED; khách còn hạn được
thử lại cùng đơn, không đổi tổng hay hạn. Có thể thử thêm các nhánh hủy:

- Chưa báo chuyển tiền: hủy ngay sau xác nhận.
- Đã báo hoặc PAID: gửi lý do; nhân viên duyệt hoặc từ chối kèm lý do.
- Chờ duyệt hủy: khóa duyệt tiền và bắt đầu pha; giải quyết yêu cầu trước.
- Duyệt hủy PAID cần ghi chú xử lý tiền. Hệ thống không tự hoàn tiền ngân hàng.
  Payment SUCCESS và bảng tiền lịch sử được giữ, điểm/lượt được đảo đúng một lần.
- PREPARING trở đi không hủy. Hết hạn tự hủy đơn chưa thanh toán và đóng yêu cầu.

Voucher mặc định ba lượt/user/mã, một mã và một lượt/đơn. Dùng hết thì ẩn,
đang giữ hết thì khóa chọn; trả lượt làm mã khả dụng lại nếu còn hiệu lực.
Điểm chỉ tích lũy/hiển thị, chưa đổi thành tiền. Có ba mã mẫu trong
`backend/voucher-samples.json`; [cách chỉnh/nạp](task-10-voucher-points.md).

## Nâng cấp và bảo toàn dữ liệu

Đã sao lưu Git, giữ tag image cũ và dump trước triển khai ở ngoài Git:
`D:\Do_an_CNPM\.task9-recovery\benefits-step6`.

- `before-step6.bundle`: toàn bộ refs Git trước bước bàn giao.
- `deploy-before.dump`: backup cuối khi frontend/backend đã dừng ghi.
- SHA-256 dump cuối: `A11DC5489D8BA3265D0689C62E7461F49DE92929FA7159165B5BD00A44625ECB`.
- `deploy-before.json`, `preservation-after.json`: danh sách cột cũ, số lượng
  và fingerprint; `images-before.json` lưu project/volume/image trước cập nhật.
- Image cũ: `brewlite-backend:before-benefits-step6` và
  `brewlite-frontend:before-benefits-step6`.

Khôi phục dump đầu vào `brewlite_benefits_step6_clone_test`, chạy migration bằng
image mới rồi so fingerprint cột cũ trước khi nâng cấp DB chính. Migration thêm
duy nhất `BenefitsFoundation1761880000000`, từ 9 lên 10 migration.

| Dữ liệu cũ | Số dòng giữ nguyên |
| --- | ---: |
| users | 2 |
| orders / order_items | 10 / 12 |
| payments / payment_request_keys | 9 / 9 |
| ingredients / products | 9 / 6 |
| recipe_items / topping_recipes | 14 / 2 |
| order_ingredient_reservations | 32 |
| vouchers | 3 |

Đối chiếu trên bản sao, ngay sau nâng cấp và sau kiểm tra trực tiếp đều giữ
nguyên fingerprint toàn bộ cột cũ. Mười đơn cũ có policy version 0, không cộng
điểm/ghi lượt/yêu cầu hủy hồi tố. Ba voucher cũ nhận hạn mức mặc định 3; hai
bảng quota/usage còn trống sau kiểm tra chỉ đọc trên DB đồ án. Đơn mới dùng policy 1.

Không tự rollback migration sau khi đã ghi workflow mới: migration down có
guard để giữ lịch sử. Nếu cần khôi phục, xác định dữ liệu mới phát sinh, sao lưu
hiện tại và thử trên bản sao trước; không dùng `down -v` hay khôi phục đè DB đang
có giao dịch mới. Dữ liệu kiểm thử nằm ở các DB `_test`/`_ui_test` riêng.

## Bằng chứng kiểm thử

- Backend app code bước 5: **138 unit và 137 PostgreSQL/API test qua**, không skip.
- Lint backend/frontend, TypeScript, format, host build và build hai image Docker qua.
- **62/62 Playwright qua trong một lượt trên production image Docker**, cả desktop
  và mobile, không skip. DB `brewlite_handoff_ui_test`, API/frontend riêng 3201/3200.
  Gồm đăng nhập, đơn riêng từng tài khoản, Ví/Thẻ/QR, thử lại, voucher/quota/điểm,
  hủy/duyệt hủy, pha chế/READY/COMPLETED, lỗi và đổi phiên khi request cũ còn chờ.
- Profile Docker mới kiểm tra tên/port container, NODE_ENV, DB URL và tên DB thật
  trước khi cho chạy. Fixture SQL chỉ nhận DB `_ui_test` mới; đã kiểm tra chặn nạp
  lặp. Profile cũng từ chối chạy khi các container kiểm thử không tồn tại.
- Sau cập nhật bản chính, kiểm tra browser desktop/mobile chỉ đọc: thêm món vào
  giỏ, xem/chọn voucher, mức giảm và số lượt cá nhân, trang nhân viên, lịch sử
  tiền và đăng xuất; không tạo tài khoản/đơn mới trên DB đồ án, không có lỗi JS/tràn ngang.
  Script kiểm tra đã được sửa để đợi thông báo thêm giỏ xong trước khi chuyển trang.

Log/ảnh ở thư mục sao lưu nói trên: `docker-ui-tests.log`, `docker-*-desktop.png`,
`docker-*-mobile.png`, `production-cart-*`, `production-orders-*`,
`production-payments-*`, `production-smoke-retry.log` và log build.
Hai container kiểm thử đã dừng/xóa sau khi lưu kết quả; container/volume đồ án giữ lại.

[Hướng dẫn profile kiểm thử Docker](docker-ui-validation.md).
[Postman hủy/pha chế](task-9-cancellation.postman_collection.json),
[API voucher/điểm](task-10-voucher-points.md),
[cách tính sức bán theo lựa chọn](selection-availability.md).

Build còn warning engine của một số dependency công cụ trên Node 20 như các
bước trước; image vẫn build và qua kiểm thử runtime ở trên. Chưa nâng dependency
ngoài phạm vi được giao.

## Review và phần nhóm nghiệm thu

[Draft PR #31](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/pull/31) tích hợp
Task 9/10c/d/e dựa trên main hiện hành; phần kho, thanh toán,
voucher và giao diện có phụ thuộc chung nên cần đọc cùng diff khi review. PR cũ
#9 đã đóng/chưa merge và không được mở lại hoặc ghi đè. Không push trực tiếp main.

Nhóm cần ít nhất một người review trước merge theo README, đối chiếu chính sách
voucher/điểm/hủy đã chốt và demo trên máy nhóm. Bằng chứng Scrum, Sprint Review/
Retrospective và nghiệm thu toàn bộ các task thuộc phần bàn giao chung của nhóm;
không thay bằng số lượng test tự động. [Báo cáo PDF cũ](pdf-compliance-review-2026-10-30.md)
ghi kết quả tại commit cũ; phần cập nhật ở đầu báo cáo dẫn đến bản bàn giao hiện hành,
không phải kết luận mới về toàn đồ án.
