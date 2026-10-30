# Thứ tự thực hiện Task 9 và Task 10c/d/e

Cập nhật: 30/10/2026. Đây là checklist theo dõi công việc đã thống nhất với Ân.
Cập nhật dấu hoàn thành theo kết quả thực tế; không đánh dấu xong chỉ vì đã có demo.

Phạm vi Ân nhắc lại ngày 30/10: chỉ làm/chỉnh phần Task 9, Task 10c/d/e và các
điểm tích hợp cần thiết của phần mình; giữ các chức năng khác của nhóm. Bước 2
nối voucher/điểm qua chuyển trạng thái đơn sẵn có, không sửa luồng duyệt thanh
toán, QR hoặc phân quyền của Task 8.

## Phương án tiếp theo theo góp ý nhóm (Document 3.docx)

Đã đọc tài liệu và ghi [phương án hủy đơn, tiến trình pha chế, lượt voucher và điểm](task-9-10-team-decisions.md).
Ưu tiên sửa cuối tài liệu: QR/Thẻ chưa báo chuyển tiền được hủy ngay;
đã báo hoặc PAID gửi yêu cầu cho nhân viên. Sau đó Ân điều chỉnh voucher: một mã/đơn,
mỗi đơn PAID dùng một lượt; cấu hình nhiều lượt/user/mã, ví dụ x3. Giữ lượt khi
PENDING, trả khi hủy, ẩn mã đã dùng hết; hết khả dụng vì đang giữ thì hiện khóa chọn.
Điểm: 10.000đ thực trả = 1 điểm, chỉ tích/hiển thị.

Checklist triển khai tiếp theo:

1. [x] Chuẩn bị nhánh/bản sao lưu, migration/contract chung cho hạn mức voucher,
       lượt dùng, điểm, yêu cầu hủy; rà soát/siết API hủy cũ.
2. [x] Backend giữ/chốt/trả lượt và cộng/thu hồi điểm trong transaction; kiểm tra
       đồng thời, gửi lặp và quá hạn trước khi mở giao diện.
3. [x] Giao diện voucher còn lượt/đang giữ/ẩn hết lượt; cập nhật điểm và lịch sử.
4. [x] Hủy ngay/yêu cầu hủy/nhân viên duyệt hoặc từ chối; UI khách và admin.
5. [x] Hai tab quản trị, bảng pha chế PAID → PREPARING → READY → COMPLETED,
       thông báo READY phía khách.
6. [x] Kiểm thử chung, migration trên bản sao, cập nhật tài liệu/Postman, build
       Docker và chuẩn bị commit/PR theo quy tắc nhóm.

Bước 1 đã hoàn thành trên `feature/task-10-benefits-foundation`: 138 unit và
93 PostgreSQL/API test qua; migration up/down/up giữ nguyên dữ liệu bản sao.
[Chi tiết bước 1](task-10-benefits-foundation.md). Chưa bật đếm lượt/điểm hay cập
nhật Docker trong bước 1.

Bước 2 đã hoàn thành trên `feature/task-10-voucher-points`: bật policy version 1
cho đơn mới, nối giữ/chốt/trả lượt và cộng/thu hồi điểm trong transaction hiện có.
138 unit, 110 PostgreSQL/API và 8 tình huống nạp cấu hình qua. [Chi tiết bước 2](task-10-voucher-points.md).
Ở bước 2 chưa đổi bản Docker/database chính hoặc frontend.

Bước 3 đã hoàn thành trên `feature/task-10-voucher-points-ui`: hiển thị lượt
cá nhân, làm mới điểm trên tài khoản, phân biệt điểm dự kiến/đã cộng/đã thu hồi
trong lịch sử và chi tiết đơn. Lint, TypeScript và build frontend qua. Bộ UI có
42 ca qua trong lần chạy chung; hai ca còn lại lỗi chờ chuyển trang trong test,
đã sửa và chạy lại cả hai qua. [Chi tiết bước 3](task-10-voucher-points-ui.md).
Chưa cập nhật Docker/database chính; tiếp theo là mục 4, hủy ngay và yêu cầu hủy.

Bước 4 đã hoàn thành trên `feature/task-9-cancellation-review`: API/quyền hủy,
giao diện khách và danh sách nhân viên duyệt/từ chối, đóng yêu cầu quá hạn.
138 unit, 122 PostgreSQL/API test qua; 52 ca UI qua trong lượt chung, hai ca
còn lại sửa bộ chọn thông báo trong test và chạy lại 2/2 qua.
[Chi tiết bước 4](task-9-cancellation-review.md). Chưa đổi Docker/database chính;
tiếp theo là mục 5, bảng pha chế và thông báo READY phía khách.

Bước 5 đã hoàn thành trên `feature/task-9-preparation-board`: bảng ba cột,
PATCH chuyển trạng thái có khóa/kiểm tra mũi tên, chặn khi chờ hủy và thông báo
nhận món trong lịch sử/chi tiết. 138 unit, 137 PostgreSQL/API test qua. UI có
60 ca qua trong lượt chung; hai ca xác nhận cập nhật câu thông báo và chạy lại
2/2 qua. [Chi tiết bước 5](task-9-preparation-board.md). Chưa cập nhật Docker/database
chính với các bước mới; tiếp theo là mục 6, nghiệm thu tích hợp và bàn giao.

**Bước 6 đã hoàn thành trên `feature/task-9-10-handoff`:** build production image,
62/62 ca UI Docker qua trong một lượt, kiểm tra migration trên bản sao và nâng cấp
bản chạy 3000/3001. Cả ba dịch vụ healthy, dữ liệu cũ giữ nguyên, không hồi tố
điểm/lượt; đã kiểm tra browser desktop/mobile trực tiếp. [Bàn giao và bằng chứng](task-9-10-handoff.md).
[Draft PR #31](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/pull/31) đã được tạo
để nhóm review; chưa merge main hoặc thay phần nghiệm thu chung của nhóm.

## Mốc tích hợp thanh toán nhân viên — lịch sử trước bước 1–6

Nhánh bản tích hợp đang chạy Docker: `feature/task-9-staff-payment-integration`, trong thư mục chính
`D:\Do_an_CNPM\Bai_Tap_Lon_CNPM`. Nền main mới: `61f4474`, PR #30.
Chi tiết và kết quả kiểm tra: [tích hợp thanh toán nhân viên](staff-payment-integration.md).

- Khách báo chuyển tiền → Payment CUSTOMER_REPORTED; Order vẫn PENDING.
- ADMIN xác nhận/từ chối; giữ khóa đơn, transaction, hoàn kho và idempotency Task 10d.
- Mặc định giữ chỗ **15 phút** cho đơn mới, theo cập nhật Issue #18; đơn cũ giữ expiresAt.
- QR mở trang quản trị để tra cứu; đã bỏ cổng mock/callback và form thẻ giả.
- Voucher mẫu, bảng giá và lịch sử snapshot được giữ lại.
- Đã kiểm tra: 138 unit, 83 PostgreSQL e2e; 30 ca UI hồi quy và 2 ca UI bổ sung qua.
  Đã build/chạy Docker, đối chiếu giữ nguyên dữ liệu và kiểm tra trang nhân viên
  desktop/mobile. Bản này đã chạy tại `localhost:3000`; chưa push nhánh/merge main.
- Còn lại: triển khai lượt voucher/điểm, hủy/yêu cầu hủy và tiến trình pha chế theo
  góp ý mới trong Document 3.docx (xem phương án phía trên).

Các mục bên dưới là nhật ký các bước trước đây; kết quả kiểm thử cũ và mô tả
callback/5 phút được thay thế bởi bản cập nhật trên.

## Phạm vi đã chốt

- Bám đề và nhiệm vụ GitHub; bỏ qua chức năng “Đặt lại” đơn hoàn tất/đã hủy.
- Giữ phần “Chỉ còn X ly” theo size/topping vì nhóm đã yêu cầu bổ sung.
- Tạo đơn PENDING thì trừ nguyên liệu để giữ chỗ trong **15 phút từ lúc tạo đơn** (đơn mới, cập nhật 30/10).
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

## 4. Tích hợp Task 10d với Task 8 — đã triển khai, chờ review nhóm

Nhánh `feature/task-10-payment-idempotency`, cùng thư mục chính. Dùng nền tích hợp
`b0a4a90`; chỉ bổ sung vào PaymentsService hiện có, giữ callback/transaction của nhóm.

- [ ] Thống nhất phạm vi với Tài, dùng chung phần Payment/idempotency/callback.
- [x] Dùng chung Payment/idempotency/callback của Task 8, không thêm module trùng.
- [x] Cùng Idempotency-Key, kể cả gửi đồng thời, chỉ tạo một Payment.
- [x] Gửi lại đúng phiên cũ sau PAID; khóa trùng nhưng đổi đơn/tài khoản/phương thức bị từ chối.
- [x] Callback lặp không đổi trạng thái hoặc giữ/trừ kho lần hai.
- [x] Kiểm tra transaction Payment/Order, rollback và tình huống hủy/hết hạn ở bước 2.
- [x] 111 unit/HTTP test và 53 e2e PostgreSQL qua, không skip; lint/format/build qua.
- [x] Hai luồng ví QR/thẻ trên trình duyệt qua; cập nhật backend Docker 3001,
      giữ nguyên frontend/database và kiểm tra fingerprint dữ liệu đồ án.

Chi tiết: [Task 10d](task-10d-payments.md). Kiểm tra cộng loyaltyPoints đúng một
lần sẽ thực hiện cùng Task 10e; chưa có tính điểm trong bản này. Chưa gửi tin nhắn
cho Tài, cập nhật Issue, push hoặc merge main.

Backend Task 8 đã có trong main `c12a42c`; dùng phần hiện có để rà soát và tích hợp.
Phối hợp thiết kế từ bước 2, kiểm chứng với DB thật và giao diện thanh toán khi sẵn sàng.

## 5. Hoàn thiện Task 10e — làm trước voucher, chờ quy tắc phát hành và tích điểm

Ân xác nhận ngày 30/10: chưa có quy tắc/mã được nhóm chốt, nhưng cho phép làm
**giao diện và nền voucher trước**. Nhánh `feature/task-10-vouchers` trong thư mục
chính. Sau đó Ân cho phép tự đề xuất quy tắc và chốt làm bảng tiền/voucher đã áp
dụng, thêm ba mã mẫu có thể chỉnh cấu hình. Chưa triển khai tích điểm hoặc giới
hạn lượt dùng; các mã mẫu chỉ phục vụ thử nghiệm trước khi nghiệm thu chính sách.

- [ ] Ân xác nhận chính sách dùng chính thức, giới hạn lượt dùng và tỷ lệ tích điểm;
      ba mã mẫu đã được phép nạp riêng để thử nghiệm và điều chỉnh.
- [x] Giao diện chọn mã công khai hoặc nhập mã, đổi/bỏ mã và trạng thái tải/rỗng/lỗi.
- [x] Voucher đã áp dụng có badge khoản giảm thực tế; giỏ/checkout/chi tiết dùng
      bảng tiền chung; có lệnh nạp và cập nhật ba voucher mẫu.
- [x] API quote và kiểm tra khi tạo đơn, tính giá trên backend, lưu snapshot giảm giá.
- [x] Checkout/xác nhận hiển thị giảm giá; QR/Thẻ dùng tổng sau giảm, thử lại giữ số tiền.
- [ ] Cộng loyaltyPoints đúng một lần sau PAID, dùng chung luồng thanh toán.
- [x] Kiểm thử backend mã sai/hết hạn/không đủ điều kiện, rollback và callback lặp.
- [x] 8 ca UI voucher desktop/mobile qua; build/cập nhật Docker, kiểm tra migration
      trên DB bản sao và đối chiếu giữ nguyên dữ liệu đồ án. Chưa có voucher thật.
- [ ] Hoàn tất nghiệm thu quy tắc kinh doanh và tích điểm sau khi nhóm chốt.

Chi tiết phạm vi và cách xem: [Task 10e — voucher](task-10e-vouchers.md).

## 6. Kiểm thử tích hợp và bàn giao

Đã hoàn tất phần triển khai/kiểm thử tự động cho Task 9/10c/d/e trên nhánh bàn giao.
Kết quả hiện hành: [bước 6](task-9-10-handoff.md). Review và demo nghiệm thu nhóm
vẫn là bước riêng trước khi merge.

- [x] Lint, format, build; 138 unit, 137 PostgreSQL/API và 62 UI Docker qua.
- [x] Chạy Docker cùng PostgreSQL thật; thử migration trên bản sao và giữ fingerprint dữ liệu.
- [x] Kiểm tra tự động chọn luồng đơn → thanh toán → xác nhận/lịch sử, hủy và pha chế.
- [x] Kiểm tra nhánh lỗi, thử lại cùng đơn và hết hạn 15 phút/hoàn kho theo bản hiện hành.
- [x] Cập nhật README, Postman, hướng dẫn demo và bằng chứng; chuẩn bị nhánh/PR tích hợp.
- [ ] Ít nhất một thành viên review trước merge và demo nghiệm thu trên máy nhóm.
- [ ] Nhóm hoàn thiện bằng chứng Sprint Review/Retrospective và DoD toàn đồ án.

## Nguồn yêu cầu

- Đề PDF `BrewLite-CongNghePhanMem.pdf`.
- [Task 9 — Issue #20](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/20).
- [Task 10 — Issue #21](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/21).
- [Task 8 — Issue #18](https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM/issues/18).
- Chốt ban đầu 5 phút đã được cập nhật thành 15 phút theo Task 8 mới; giữ tính năng số ly theo lựa chọn,
  bỏ qua Đặt lại và bám phạm vi đã giao.

## Vị trí làm việc

- `D:\Do_an_CNPM\BrewLite-availability`: worktree cũ của phần số ly; không phải bản bàn giao hiện hành.
- `D:\Do_an_CNPM\Bai_Tap_Lon_CNPM`: thư mục làm việc chính, nhánh
  `feature/task-9-10-handoff`, đã chứa Task 9/10c/d/e và tích hợp Task 8;
  không còn xung đột merge.
- `D:\Do_an_CNPM\BrewLite-task9-integration`: bản đối chiếu ở commit `4270997`
  (detached HEAD); tiếp tục phát triển trong thư mục chính.
- `D:\Do_an_CNPM\BrewLite-task9-preview`: bản xem thử giao diện task 9 tại cổng 3100,
  dùng dữ liệu mẫu; không phải bản tích hợp thanh toán của nhóm.
