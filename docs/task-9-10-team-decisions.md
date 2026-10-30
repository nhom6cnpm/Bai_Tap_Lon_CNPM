# Phương án sau góp ý nhóm — 30/10/2026

Nguồn: `D:\Du_an_moi\Document 3.docx`, đã đọc toàn bộ nội dung. Đây là phân tích
và phương án triển khai; chưa phải các chức năng đã có trên bản Docker.
Nền bắt đầu: `feature/task-9-staff-payment-integration`, commit `3642f6e`.
Sau khi đọc tài liệu, Ân điều chỉnh phần voucher: cho phép nhiều lượt cùng mã
(ví dụ x3), mỗi đơn PAID dùng một lượt; ẩn khỏi danh sách chọn khi đã dùng hết.
Quyết định này thay quy tắc một lượt/user/mã trong Document 3.docx.

## 1. Cách hiểu thống nhất tài liệu

- Giữ nguyên state machine của Order và một vai trò ADMIN.
- Đoạn sửa cuối thay thế bảng đầu: tại QR/Thẻ, chưa báo chuyển tiền thì được hủy
  ngay, không bắt buộc có nhân viên chỉ vì đã tạo Payment.
- Hệ thống nhận biết **đã bấm báo chuyển tiền**, không kiểm chứng được khách thực
  tế đã chuyển tiền hay chưa. Với bản mô phỏng, dùng trạng thái Payment làm căn cứ.
  Hộp xác nhận hủy ghi rõ: nếu đã chuyển tiền, hãy báo chuyển tiền và gửi yêu cầu hủy.
- Giữ thời hạn **15 phút** của bản Task 8 hiện hành, tính từ tạo đơn; góp ý mới
  không thay thời hạn. Không gia hạn khi báo chuyển tiền, yêu cầu hủy hoặc retry.
- Voucher: một mã/đơn, mỗi đơn dùng một lượt. Hạn mức theo từng voucher, ví dụ
  ba lượt/user/mã (x3), không cộng ba lượt giảm giá lên một đơn. Đơn đã hủy được
  trả lượt, kể cả hủy sau PAID. Không thêm giới hạn tổng lượt toàn hệ thống.

## 2. Điều kiện hủy — backend quyết định

| Trạng thái hiện tại | Hành động khách |
| --- | --- |
| PENDING, chưa có Payment | Hủy ngay |
| PENDING, Payment đang PENDING, chưa báo chuyển tiền | Hủy ngay, gồm QR và Thẻ |
| PENDING, Payment CUSTOMER_REPORTED | Gửi yêu cầu hủy cho ADMIN |
| PAYMENT_FAILED, chưa có phiên mới CUSTOMER_REPORTED | Hủy ngay; còn hạn vẫn có thể retry |
| PAID, chưa bắt đầu pha | Gửi yêu cầu hủy cho ADMIN |
| PREPARING, READY, COMPLETED | Không hủy/không gửi yêu cầu hủy |
| CANCELLED | Gọi hủy lặp trả kết quả cũ, không hoàn kho/lượt/điểm thêm |

API hủy phải kiểm tra trạng thái dưới khóa Order, không dựa vào URL/trang đang mở.
Trả quyền thao tác từ backend (`canCancelImmediately`, `canRequestCancellation`)
để checkout, thanh toán, chi tiết/lịch sử dùng cùng quy tắc. Điều kiện quá hạn luôn
được kiểm tra lại khi ghi dữ liệu. Không chỉ ẩn nút ở frontend.

Hủy ngay/duyệt hủy/hết hạn dùng chung nghiệp vụ hủy trong một transaction:
chuyển CANCELLED qua state machine, hoàn đúng snapshot nguyên liệu một lần,
đóng các Payment đang chờ thành FAILED, trả voucher, thu hồi điểm nếu đã cộng.
Payment SUCCESS cũ giữ nguyên để thể hiện đã từng xác nhận tiền; không đổi lịch
sử thanh toán, subtotal/discount/total hoặc snapshot voucher của đơn đã hủy.

Giữ giỏ đang có; sau hủy có liên kết về giỏ để khách sửa. Không tự khôi phục giỏ
đã xóa sau PAID và không ghi đè giỏ mới; không thêm chức năng Đặt lại ngoài phạm vi.

## 3. Yêu cầu hủy, phân quyền và xung đột

Yêu cầu hủy không đổi Order.status. Lưu thêm mã yêu cầu, thời điểm, lý do,
trạng thái xử lý yêu cầu, người/thời điểm duyệt và lý do từ chối. Chỉ một yêu cầu
đang chờ cho mỗi đơn; gửi lặp trả yêu cầu đang có, không phát thông báo lặp.
Trạng thái của yêu cầu là metadata riêng, không thêm trạng thái vào state machine Order.

Không dùng lại `orders.cancelReason` để chứa lý do tự do: field này hiện là mã
`USER_CANCELLED` / `PAYMENT_TIMEOUT`. Dùng tên riêng như `cancelRequestReason`.
Request id giúp chặn thao tác của nhân viên trên yêu cầu cũ sau khi khách gửi yêu cầu mới.

- Chờ duyệt: khách thấy thông báo và polling; admin thấy yêu cầu, toast/âm báo.
- Đồng ý: chỉ khi đơn còn PENDING/PAYMENT_FAILED/PAID; thực hiện hủy chung.
- Từ chối: bắt buộc lý do; giữ trạng thái đơn, hiển thị lý do cho khách và mở lại thao tác phù hợp.
- Có yêu cầu đang chờ: tạm chặn xác nhận/từ chối Payment và Bắt đầu pha; nhân viên
  giải quyết yêu cầu hủy trước. Đây là bổ sung kỹ thuật được đề xuất để tránh hai màn hình xử lý ngược nhau.
- Hết hạn: PENDING/PAYMENT_FAILED vẫn tự hủy và đóng yêu cầu đang chờ do hết hạn;
  không tiếp tục chờ nhân viên. PAID không bị hủy bởi timeout thanh toán.

Mọi đường ghi khóa Order trước rồi mới các bản ghi liên quan, theo cùng thứ tự,
kiểm tra lại điều kiện sau khi lấy khóa. Không hiểu “thao tác sau luôn thua” theo nghĩa tuyệt đối:

- Hủy ngay trước → báo/duyệt Payment sau không được làm đơn PAID lại.
- Báo chuyển tiền trước → hủy ngay sau bị chặn, khách dùng yêu cầu hủy.
- Xác nhận tiền trước → yêu cầu hủy PAID sau vẫn hợp lệ theo chính sách của nhóm.
- Yêu cầu hủy trước → nhân viên xử lý yêu cầu rồi mới tiếp tục tiền/pha chế.
- Bắt đầu pha trước → yêu cầu hủy sau bị chặn; yêu cầu hủy trước thì chặn Bắt đầu pha.

API theo nhóm: POST `/orders/:id/cancel`, POST `/orders/:id/cancel-request`,
POST `/admin/orders/:id/cancel`, POST `/admin/orders/:id/cancel-request/reject`.
Khách chỉ thao tác đơn của mình; API admin dùng JwtAuthGuard + RolesGuard + ADMIN.

Về tiền: bản hiện tại mô phỏng xác nhận, không có giao dịch ngân hàng thật. Không
viết cổng hoàn tiền hoặc buộc nhân viên chuyển tiền thật để demo. Lưu ghi chú xử lý
khi duyệt hủy PAID, diễn đạt rõ hệ thống chưa tự hoàn tiền. Nếu dùng tiền thật sau
này, nghiệp vụ đối soát/hoàn tiền ngoài ứng dụng cần được thiết kế riêng.

## 4. Trang nhân viên và tiến trình đơn

Hai tab dùng giao diện chung: Thanh toán `/admin/payments` và Đơn hàng `/admin/orders`.
Tab Đơn hàng có vùng yêu cầu hủy phía trên, ba cột PAID → PREPARING → READY phía dưới.
Nút lần lượt: Bắt đầu pha → Pha xong → Khách đã nhận (COMPLETED rời bảng hoạt động).

- GET `/admin/orders?status=PAID,PREPARING,READY` trả đơn và snapshot món/size/topping.
- Vùng yêu cầu hủy truy vấn riêng qua GET `/admin/orders?cancelRequestStatus=PENDING`,
  không lọc chỉ ba trạng thái trên, để không bỏ mất yêu cầu của đơn PENDING.
- PATCH `/admin/orders/:id/status` chỉ chấp nhận PREPARING, READY, COMPLETED;
  luôn kiểm tra mũi tên hiện hành. Không nhận PAID/CANCELLED qua API này.
- Polling 3–5 giây; READY thông báo “Đồ uống đã sẵn sàng, mời bạn ra quầy”.
  Không dùng timer tự chuyển trạng thái. Lặp thao tác không lặp tác động nghiệp vụ.

## 5. Voucher và tích điểm cùng transaction

Voucher có `maxUsesPerUser` cấu hình riêng, ví dụ 3 cho các mã mẫu. Lưu lịch sử ở
`voucher_usages(userId, voucherCode, orderId, status, ...)`, UNIQUE trên orderId.
Không dùng partial UNIQUE (userId, voucherCode) của bản đề xuất một lượt, vì nó
sẽ chặn lượt thứ hai dù voucher có x3.

Có bản ghi hạn mức theo (userId, voucherCode) để khóa đồng thời khi giữ/trả/chốt
lượt. Tạo bản ghi bằng upsert, khóa hàng rồi đếm RESERVED + USED trước khi giữ;
chỉ cho giữ nếu nhỏ hơn maxUsesPerUser. Các thao tác ở cùng transaction với đơn,
không dựa vào số hiển thị phía client. Giữ lịch sử RELEASED, không xóa bản ghi khi trả lượt.

Vòng đời: tạo PENDING → RESERVED; PAYMENT_FAILED vẫn RESERVED; PAID → USED;
hủy/hết hạn → RELEASED, kể cả hủy sau PAID. Tạo đơn lỗi rollback cả kho, đơn và lượt.
Hủy sau PAID cho dùng lại mã nếu mã vẫn còn hiệu lực và đủ điều kiện, không gia hạn mã.
Không tự thay voucher trên đơn đã tạo. Mã hết hạn lúc đơn đang chờ không đổi tổng đã chốt.

Giữ `orders.discount` hiện có làm số tiền giảm; không tạo thêm cột discountAmount
trùng ý nghĩa. Backend tính giá và kiểm tra quyền dùng. Quote/list có ngữ cảnh tài
khoản đã đăng nhập để báo “đã dùng”/“đang giữ cho đơn khác”; khách chưa đăng nhập
chỉ xem điều kiện chung. Chọn/quote mã không giữ lượt.

Danh sách chọn hiển thị “Còn N lượt” (N = hạn mức - USED - RESERVED):

- Đã dùng hết hạn mức hoặc voucher hết hạn: ẩn khỏi danh sách chọn, giữ database/lịch sử.
- Hết lượt khả dụng do đang RESERVED: vẫn hiện nhưng khóa chọn, ghi số lượt đang giữ.
- Khi hủy/hết hạn đơn trả lượt: tự cập nhật danh sách, hiện lại nếu mã còn hiệu lực.
- Mã đã dùng một lần nhưng còn lượt vẫn được dùng cho đơn tiếp theo; mã x3 không
  có nghĩa giảm ba lần trên cùng đơn. Thanh toán PAID mới tính là dùng thành công.

Điểm = floor(total thực trả / 10.000), total là số nguyên VND sau voucher.
Chỉ cộng khi admin xác nhận PAID; không cộng khi báo chuyển tiền, không đổi điểm.
Lưu `pointsEarned` trên đơn và mốc đã cộng để không dùng số 0 làm dấu chưa xử lý
(đơn dưới 10.000đ hợp lệ vẫn được 0 điểm).

Khi hủy PAID, thu hồi chính xác pointsEarned rồi đặt về 0 theo góp ý. Lưu thêm
pointsReversed/mốc thu hồi để lịch sử vẫn thể hiện điểm đã thu hồi, không mất dấu vết.
Cập nhật user bằng phép cộng/trừ nguyên tử trong DB, không đọc-sửa-save số dư
trong bộ nhớ khi hai đơn của một user được duyệt cùng lúc.

Hàm xử lý voucher/điểm dùng EntityManager của transaction Payment.review khi
PAID; hàm đảo gọi trong nghiệp vụ hủy chung, gồm worker hết hạn. Không tự mở
transaction khác hoặc lưu bằng repository ngoài transaction. Lỗi một bước rollback
toàn bộ, không để Payment SUCCESS mà điểm/voucher chưa cập nhật.

Frontend gọi lại GET `/auth/me` sau khi nhận PAID hoặc hủy PAID và khi quay lại
ứng dụng; cập nhật profile đúng tài khoản đang đăng nhập, không chỉ cập nhật chữ trên header.

## 6. Thứ tự triển khai và dữ liệu cũ

1. Chuẩn bị nhánh/bản sao lưu và migration/contract chung: hạn mức, usage voucher,
   điểm, metadata hủy. Rà soát/siết API hủy cũ, thống nhất các hàm xử lý dùng chung.
2. Backend voucher RESERVED/USED/RELEASED và điểm; gắn vào PAID/hủy/hết hạn,
   kiểm tra transaction/concurrency. Chưa mở UI khi backend chưa đảm bảo toàn vẹn.
3. Giao diện voucher còn lượt/đang giữ/ẩn hết lượt, giữ bố cục đã chốt; cập nhật
   profile điểm và lịch sử cộng/thu hồi sau khi server xác nhận.
4. API hủy ngay/yêu cầu/duyệt/từ chối; giao diện khách và vùng yêu cầu hủy của admin.
5. API/bảng pha chế, hai tab quản trị, theo dõi đơn và READY phía khách.
6. Kiểm thử chung, cập nhật tài liệu/Postman, thử migration trên bản sao rồi build
   Docker, chuẩn bị commit/PR theo quy tắc nhóm.

Mặc định áp dụng quy tắc lượt/điểm cho đơn mới từ lần nâng cấp này. Không cộng điểm
hồi tố hay sửa snapshot/hạn đơn cũ. Đánh dấu phiên bản chính sách trên đơn để hủy
đơn cũ không thu hồi điểm/lượt chưa từng được cấp. Không tự backfill tất cả lịch sử
voucher thành USED: dữ liệu thử trước đây cho phép một user dùng một mã nhiều lần,
có thể làm vượt hạn mức mới. Nếu cần tính cả lịch sử, phải có kế hoạch chuyển đổi riêng.

## 7. Điều kiện kiểm chứng

- Trạng thái/Payment/quyền hủy theo bảng; khách không vượt quyền bằng gọi API trực tiếp.
- Hủy/report/duyệt/pha/worker đồng thời: không PAID lại đơn hủy, không hoàn kho/lượt/điểm hai lần.
- Mã x3, bốn đơn cùng user/cùng mã đồng thời: tối đa ba RESERVED/USED; request lỗi không giữ kho.
- Dùng một đơn PAID thì còn hai lượt; chọn/quote không giữ lượt; hết lượt USED
  thì ẩn, hết khả dụng do RESERVED thì khóa chọn; trả lượt có thể làm mã hiện lại.
- FAILED/retry không trả lượt và không đổi hạn; hủy trả lượt, hết hạn voucher không được dùng cho đơn mới.
- Hai đơn cùng user được duyệt đồng thời cộng đủ điểm; duyệt/hủy lặp không lặp điểm.
- Đơn 75.000đ được 7 điểm; đơn dưới 10.000đ được 0 điểm và vẫn được đánh dấu đã xử lý.
- PAID → PREPARING → READY → COMPLETED; nhảy cóc/đích PAID/CANCELLED qua PATCH bị 400;
  khách gọi admin bị 403; đơn có yêu cầu hủy đang chờ không được bắt đầu pha.
- Desktop/mobile, polling, READY, lý do từ chối, profile điểm, snapshot và dữ liệu cũ.

[Bước 1 đã triển khai trên nhánh riêng](task-10-benefits-foundation.md): cấu trúc
dữ liệu và siết hủy trực tiếp. [Bước 2 backend lượt voucher/điểm](task-10-voucher-points.md)
đã bật đầy đủ transaction cho đơn mới trên nhánh riêng. Chưa cập nhật giao diện/Docker.
