# Đối chiếu dự án với đề BrewLite — 30/10/2026

## Phạm vi và nguồn

- Đề `BrewLite-CongNghePhanMem.pdf`, VER 1.0, đọc đủ 8 trang PDF.
- SHA-256: `08efc9a6cc247123500419f01160c76712ec773affc998d2193f2873ef5312cc`.
- Code được đối chiếu: `b535244`, nhánh `feature/task-10-payment-idempotency`,
  thư mục chính `Bai_Tap_Lon_CNPM`.
- Số trang bên dưới tính cả bìa/mục lục; số in ở chân trang thấp hơn một.
- PDF là nguồn yêu cầu sản phẩm. Issue và quyết định của nhóm là yêu cầu bổ sung;
  các đề xuất trong báo cáo không được xem là yêu cầu nguyên văn của PDF.

Kết luận: công nghệ và luồng MVP chính phù hợp đề. Chưa đủ điều kiện xác nhận
toàn bộ 10 task đạt DoD: còn thiếu Task 10e, một lỗi validate đầu vào, hướng dẫn
test e2e chưa đầy đủ và bằng chứng nghiệm thu/review cần nhóm hoàn tất.

## Các điểm cần xử lý

### 1. Bắt buộc, còn thiếu: mã giảm giá và cộng điểm sau PAID

Đề trang PDF 7, mục 9 nói rõ Task 10 bao gồm cả bốn yêu cầu; yêu cầu thứ tư là
áp mã hợp lệ và cộng điểm tích lũy sau PAID. Đây là chức năng cần hoàn thành để
nghiệm thu Task 10, không phải một phần tùy chọn ngoài đề.

Bằng chứng code:

- `backend/src/orders/dto/create-order.dto.ts` chỉ nhận items, chưa có mã ưu đãi.
- `orders.service.ts` tính tổng theo giá size/topping, chưa tính khoản giảm.
- `order.entity.ts` chưa lưu mã/khoản giảm trên đơn.
- `auth.service.ts` khởi tạo `loyaltyPoints: 0`; `payments.service.ts` chưa cộng điểm.

Ân đã chốt để Task 10e chờ quy tắc nhóm. Quyết định chờ không làm các phần khác
sai, nhưng chưa thể đánh dấu Task 10 hoàn tất. PDF không cho công thức giảm giá,
tỷ lệ/làm tròn điểm, hoặc quy tắc xử lý điểm/mã khi đơn PAID bị hủy.

### 2. Lỗi validate có thể tái hiện ở API đăng nhập

Đề mục 4.2 (trang PDF 5) và DoD mục 10 (trang PDF 8) yêu cầu validate đầu vào.
`backend/src/auth/dto/login.dto.ts:7` chỉ dùng IsNotEmpty cho password, chưa kiểm
tra kiểu chuỗi. `auth.service.ts:78` truyền trực tiếp password cho bcrypt.compare.

Kiểm tra bằng AuthController/AuthService thực tế từ bản build hiện tại, kết hợp
repository trong bộ nhớ và một user giả có hash hợp lệ, không truy cập DB đồ án:

| Password gửi lên  | HTTP thực tế | Kết quả nên có        |
| ----------------- | ------------ | --------------------- |
| Chuỗi đúng        | 201          | Đăng nhập bình thường |
| Số 123456         | 500          | 400 do sai kiểu       |
| Object            | 500          | 400 do sai kiểu       |
| Array             | 500          | 400 do sai kiểu       |
| Không có password | 400          | Đúng                  |

Trường hợp user không tồn tại có thể trả 401 trước khi tới bcrypt; lỗi 500 ở đây
đã tái hiện với user tồn tại. Chưa thấy bằng chứng vượt xác thực; lỗi là xử lý
đầu vào và phản hồi server không đúng. Đề xuất thêm kiểm tra chuỗi và regression
test cho login. Báo cáo này chưa sửa code xác thực.

### 3. README bỏ thiếu cấu hình database kiểm thử

Đề mục 10/11 yêu cầu hướng dẫn chạy và bàn giao. README hiện ghi chạy e2e bằng
`npm run test:e2e` mà chưa đặt TEST_DATABASE_URL. Cả hai suite kiểm tra biến này
trước khi chạy; khi không có, toàn bộ suite bị skip để bảo vệ DB thật.

Đã chạy lại với TEST_DATABASE_URL rỗng: exit code 0, **2 suite skip, 53 test skip**.
Đây không phải bằng chứng các test đã qua. Các lượt trước dùng URL DB test đúng
đã đạt 53/53; tài liệu Task 9/10d đã có ví dụ đúng nhưng README chính còn thiếu.

Đề xuất đưa hướng dẫn tạo database riêng hậu tố `_test`, đặt URL và chạy test vào
README. Giữ guard bảo vệ DB thật, không bỏ guard chỉ để lệnh ngắn hơn.

### 4. Nhãn nút giỏ hàng chưa bám nguyên văn US-05

Đề trang PDF 5, US-05 nhắc nút “Thanh toán” có tổng tiền. Ở
`frontend/src/app/cart/page.tsx:296`, nút tạo đơn mới hiện “Đặt hàng · …”.
Luồng vẫn dẫn tới checkout và có tổng tiền, nên đây là khác biệt nhãn giao diện,
không phải mất chức năng thanh toán. Đổi nhãn thành “Thanh toán · …” sẽ sát tiêu
chí chấp nhận hơn; giữ hành vi tạo PENDING trước khi chọn Ví/Thẻ.

## Những lựa chọn hiện tại phù hợp đề

| Nội dung                                           | Đối chiếu PDF            | Kết quả                                       |
| -------------------------------------------------- | ------------------------ | --------------------------------------------- |
| NestJS + Next.js, TypeScript                       | Mục 1 và 6, trang 3/5/6  | Phù hợp                                       |
| PostgreSQL + TypeORM                               | Mục 6, trang 5/6         | Được cho phép                                 |
| Menu có tên/ảnh/giá, loading/empty/error           | Mục 4.1, Task 2/3        | Có trong API/UI                               |
| Size S/M/L, topping, tính giá                      | Task 4, trang 7          | Có; mức phụ thu frontend/backend hiện khớp    |
| Giỏ thêm/sửa/xóa, Zustand, tổng tiền/badge         | Task 5                   | Có                                            |
| Đăng ký/đăng nhập, bcrypt, JWT, guard tạo đơn      | Task 7                   | Có; còn lỗi validate password login nêu trên  |
| POST /orders lưu PENDING và trả mã đơn             | Task 6                   | Có, trong transaction                         |
| BrewLite Pay tự xây, Ví QR/Thẻ giả                 | Mục 3.2/6, Task 8        | Phù hợp cổng mock được đề cho phép            |
| Thất bại giữ giỏ, PAYMENT_FAILED; thử lại cùng đơn | US-05, Task 8, sơ đồ 9.1 | Có, đã kiểm thử                               |
| Thành công PAID, mã đơn, xác nhận, nhận tại quầy   | US-05, wireframe, Task 9 | Có; màn xác nhận chỉ PAID                     |
| GET /orders/me theo user                           | Task 9, mục 12.1         | Có JWT, không trả đơn tài khoản khác          |
| State machine và chặn chuyển sai                   | Mục 9/9.1                | Có bảng chuyển và assertTransition/test       |
| Idempotency-Key, callback lặp                      | Mục 9                    | Có; 12 yêu cầu đồng thời chỉ một Payment      |
| Transaction + optimistic locking tồn kho           | Mục 9                    | Có version/CAS và test đặt đồng thời/rollback |
| Frontend/backend/DB trong Compose                  | Task 9, mục 11           | Đã chạy ba dịch vụ, volume DB giữ nguyên      |

## Những phần không nên kết luận là vi phạm

- **Vị trí voucher:** PDF không chỉ định ô nhập voucher ở giỏ, checkout hay mục
  riêng. Mục 7 là wireframe tham khảo. Đặt ô trong khối tổng tiền của giỏ trước
  khi tạo PENDING là phương án đề xuất phù hợp luồng, không phải vị trí bắt buộc.
- **Trang quản trị voucher:** không được liệt kê là màn/API bắt buộc. Chọn seed mã
  mẫu hay giao diện quản trị phụ thuộc phạm vi nhóm chốt, không tự cộng thêm yêu cầu.
- **Không tích hợp ngân hàng thật:** đề yêu cầu mock payment và cho phép mô phỏng
  Ví/Thẻ; không bắt buộc tài khoản VNPay/MoMo/Stripe thật hoặc giao dịch tiền thật.
- **Giao diện không giống hệt wireframe/Stitch:** PDF cho bố cục tham khảo;
  phải đáp ứng chức năng và tiêu chí chấp nhận, không bắt buộc sao chép từng pixel.
- **Không có Đặt lại đơn:** PDF không bắt buộc nút này; bỏ qua đúng phạm vi đã chốt.
- **Không có trang Barista:** mục 3.2 ghi chức năng nhân viên cập nhật pha chế nằm
  ngoài MVP và là mở rộng. State machine backend vẫn phải đúng.
- **Giữ nguyên liệu 5 phút:** PDF không ấn định thời gian giữ. Đây là quy tắc bổ
  sung của nhóm/Issue #21 đã chốt, không mâu thuẫn số phút nào trong PDF.
- **Tồn kho tính từ nguyên liệu:** phù hợp yêu cầu kiểm soát nguyên liệu/sản phẩm
  trong mục 9; API sản phẩm vẫn trả stock. Issue #21 làm rõ phần công thức/size/topping.

## Kiểm chứng và giới hạn

- Dùng kết quả đã có trên code `b535244`: 111 unit/HTTP test; 53 e2e PostgreSQL;
  hai luồng trình duyệt ví QR/thẻ trên backend Task 10d. Đây là kiểm thử tự động,
  không thay thế review nhóm hoặc buổi demo nghiệm thu.
- Lượt đối chiếu này đọc code/PDF, kiểm tra login bằng dữ liệu bộ nhớ và tái hiện
  test skip. Không tạo dữ liệu mới vào DB đồ án, không sửa logic ứng dụng.
- Đo 12 lần mỗi API đọc trên localhost với dữ liệu mẫu:

| API                                 | Median   | Max      |
| ----------------------------------- | -------- | -------- |
| GET /products                       | 5,82 ms  | 42,54 ms |
| GET /products/1                     | 11,39 ms | 37,21 ms |
| GET /products/1/availability?size=S | 25,49 ms | 36,42 ms |

Các mẫu trên dưới 500 ms như mục 4.2 yêu cầu. Chưa phải kiểm tra mọi API hoặc
load test, nên chưa khẳng định toàn hệ thống luôn đáp ứng giới hạn này.

Các nhánh mới chưa được push/review qua PR. PDF mục 10 yêu cầu review nhóm, mục
11 yêu cầu demo và Retrospective. Bằng chứng Scrum, Sprint Backlog, burndown,
Review/Retro cần nhóm cung cấp; không thể kết luận thiếu toàn bộ chỉ từ code repo.

## Thứ tự đề xuất

1. Sửa validate login và hướng dẫn test trong README.
2. Cân nhắc đổi nhãn nút giỏ cho sát US-05.
3. Nhóm chốt quy tắc rồi hoàn thiện Task 10e; hiện vẫn chờ theo yêu cầu của Ân.
4. Review PR, demo nghiệm thu và hoàn thiện bằng chứng Scrum trước bàn giao.
