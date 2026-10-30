# Bước 1 — nền dữ liệu voucher, điểm và yêu cầu hủy

Hoàn thành ngày 30/10/2026 trên nhánh `feature/task-10-benefits-foundation`,
tách từ bản tích hợp `3642f6e`. Main đã kiểm tra vẫn ở `61f4474`.
Phương án nghiệp vụ: [quyết định sau góp ý nhóm](task-9-10-team-decisions.md).

## Đã thực hiện

- Sao lưu Git, thay đổi tài liệu chưa commit và database trước khi sửa code.
- Migration `BenefitsFoundation1761880000000` bổ sung:
  - Voucher: `maxUsesPerUser`, mặc định 3, phải là số nguyên dương.
  - `voucher_user_quotas`: một hàng khóa cho mỗi user/mã; không lưu bộ đếm trùng
    với lịch sử. Bước 2 sẽ khóa hàng này trước khi đếm/giữ/chốt/trả lượt.
  - `voucher_usages`: một dòng cho mỗi đơn, RESERVED/USED/RELEASED và các mốc thời gian.
    Cho phép một tài khoản có nhiều lượt cùng mã, không dùng UNIQUE user/mã để chặn lượt thứ hai.
  - Order: phiên bản chính sách, điểm đã cộng/thu hồi và mốc xử lý; metadata yêu cầu
    hủy, người/thời điểm duyệt, lý do. Không đổi Order.status hoặc cancelReason cũ.
- Đăng ký entity trong AppModule/DataSource; có kiểu dùng chung cho lượt voucher,
  điểm, metadata hủy và quyền thao tác của các API sắp triển khai.
- Siết `POST /orders/:id/cancel` dưới khóa Order:
  - PENDING chưa báo chuyển tiền, kể cả đã mở QR/Thẻ: hủy ngay.
  - PAYMENT_FAILED chưa có phiên mới báo chuyển tiền: hủy ngay.
  - CUSTOMER_REPORTED hoặc PAID: trả 409 `CANCELLATION_REQUIRES_REVIEW`.
  - Có yêu cầu đang chờ: trả 409 `CANCELLATION_REQUEST_PENDING`.
  - PREPARING trở đi vẫn bị state machine chặn; không phải chủ đơn trả 404.
  - Hết hạn vẫn tự hủy; gọi lại đơn đã hủy không hoàn nguyên liệu thêm.
  - Hủy PAID nội bộ vẫn có trong state machine để nối với API nhân viên ở bước 4.

## Chưa kích hoạt ở bước này

Order cũ và đơn tạo trong giai đoạn nền tiếp tục có benefitsPolicyVersion = 0.
Chưa tự giữ/trừ lượt hay cộng/thu hồi điểm. Bước 2 sẽ bật phiên bản 1 đồng thời
với đầy đủ reserve/settle/release, không để đơn hưởng một phần chính sách.
Giới hạn x3 chưa được thực thi chỉ bằng migration; cần thao tác khóa/đếm ở bước 2.
Các DTO mới là contract chuẩn bị, chưa công bố API yêu cầu/duyệt hủy hoặc trạng thái pha chế.

Chưa cập nhật database chính hoặc image/container Docker. Các kiểm tra thực hiện
trên database thử. Bản Docker đang chạy vẫn là bản tích hợp thanh toán trước bước 1.
Không có thay đổi UI nên chưa có giao diện mới để xem ở bước này.

## Kiểm chứng

- Backend build, lint, format: qua.
- Unit: 138 test qua, 9 suite.
- PostgreSQL/API: 93 test qua, 2 suite, không skip; database trống
  `brewlite_benefits_fresh_test` chạy đủ chuỗi 10 migration.
- Các ca bổ sung kiểm tra default không cấp quyền lợi hồi tố, nhiều lượt/user/mã,
  duy nhất mỗi order, khóa ngoại, trạng thái lượt không hợp lệ, điểm thiếu audit,
  metadata hủy thiếu dữ liệu và chặn downgrade khi đã có dữ liệu workflow.
- API kiểm tra hủy QR/Thẻ chưa báo, chặn CUSTOMER_REPORTED/PAID, FAILED, hết hạn,
  yêu cầu đang chờ, chủ đơn và race báo chuyển tiền với hủy ngay.
- Race nhân viên xác nhận với hủy ngay được cập nhật theo quy tắc mới: nếu PAID
  trước thì khách không hủy trực tiếp được; nếu hủy trước thì không thể PAID lại.
- Database bản sao `brewlite_benefits_foundation_test`: thử up → down → up,
  fingerprint các cột có sẵn giữ nguyên: 2 user, 10 đơn, 12 dòng món, 9 nguyên liệu,
  6 sản phẩm, 3 voucher, 9 payment, 9 request key, 32 dòng giữ nguyên liệu.
- Down từ chối khi đã ghi lượt/metadata hủy/điểm hoặc đã bật phiên bản 1; không
  dùng thao tác xóa thủ công để bỏ qua kiểm tra này.

Chạy lại từ backend, chỉ dùng database riêng có hậu tố `_test`:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test -- --runInBand
$env:TEST_DATABASE_URL = 'postgresql://brewlite:brewlite@127.0.0.1:5432/brewlite_benefits_fresh_test'
npm.cmd run test:e2e -- --runInBand
```

Sao lưu ngoài Git tại `D:\Do_an_CNPM\.task9-recovery\benefits-foundation-step1`:
`before-step1.bundle`, `before-step1.patch`, hai tài liệu kế hoạch trước sửa,
`before-step1.dump` và fingerprint database bản sao trước migration.

## Tiếp theo

Bước 2: triển khai giữ/chốt/trả lượt theo hạn mức và cộng/thu hồi điểm trong cùng
transaction của đơn/thanh toán/hết hạn. Sau khi các ca đồng thời và rollback qua
mới bật chính sách version 1. UI x3 và các nút/yêu cầu hủy ở các bước tiếp theo.
