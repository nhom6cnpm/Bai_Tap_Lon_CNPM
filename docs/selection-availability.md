# Số ly còn bán theo lựa chọn — Task 10

## API

Hai API công khai, chỉ đọc, không giữ chỗ và không trừ nguyên liệu. Phản hồi có
`Cache-Control: no-store`. Không cần thêm migration hay biến môi trường.

### Một lựa chọn

`GET /products/1/availability?size=L&toppingIds=cream,pearls`

- `size`: S, M hoặc L; mặc định S.
- `toppingIds`: danh sách phân cách bằng dấu phẩy; mặc định không topping.
- Topping hợp lệ: `cream`, `pearls`; không được lặp.
- 400 khi lựa chọn sai; 404 khi sản phẩm không tồn tại.

Ví dụ phản hồi:

```json
{
  "productId": "1",
  "size": "L",
  "toppingIds": ["cream", "pearls"],
  "stock": 50
}
```

`stock` là số ly tối đa theo lựa chọn, không phải số lượng nguyên liệu.
M dùng hệ số 1,25; L dùng 1,5; từng nguyên liệu gốc làm tròn lên như bộ tính
công thức hiện tại. Nguyên liệu topping cộng riêng, không nhân theo size.
Thiếu nguyên liệu, công thức món hoặc công thức topping thì trả 0 ly.

### Toàn bộ giỏ hàng

`POST /products/availability`

```json
{
  "items": [
    { "productId": "1", "size": "S", "toppingIds": [], "qty": 3 },
    { "productId": "2", "size": "L", "toppingIds": ["cream"], "qty": 1 }
  ]
}
```

Trả `{ available, items }`; mỗi dòng giữ thông tin đầu vào và thêm `stock`.
Thứ tự dòng trong phản hồi trùng với request. Giỏ phải có 1–100 dòng, số lượng
nguyên dương, size và topping hợp lệ.

**`stock` của một dòng là số ly tối đa của riêng dòng đó, sau khi đã dành nguyên
liệu cho số lượng hiện tại của tất cả dòng còn lại.** Đây là tổng số ly cho dòng,
không phải số ly có thể cộng thêm. `available` chỉ true nếu toàn bộ giỏ đủ nguyên
liệu. Các giới hạn từng dòng không phải những phần kho có thể đồng thời cộng dồn.

Ví dụ kho còn 100 g cà phê, món A dùng 20 g/ly, B dùng 10 g/ly. Giỏ A×5 + B×1
trả `available: false`, giới hạn A là 4 ly và B là 0 ly. Nếu chỉ kiểm tra từng món
riêng, cả hai dòng đều có vẻ còn hàng nhưng tổng nhu cầu thực tế là 110 g.

## Giao diện

- Trang chi tiết cập nhật số ly khi đổi size/topping, có loading, lỗi và thử lại.
  Nếu giỏ đã có món, phần nguyên liệu của các món đó được tính trước; số ly hiển thị
  là số ly có thể **thêm** theo lựa chọn hiện tại.
- Giỏ hàng hiển thị “Chỉ còn X ly theo lựa chọn này”, xét cả nguyên liệu dùng chung.
  Chặn tăng quá giới hạn và chặn đặt hàng khi vượt kho hoặc chưa kiểm tra được.
  Khách vẫn có thể giảm số lượng hoặc xóa món; không tự xóa món khi kho thay đổi.
- Tự kiểm tra lại mỗi 15 giây khi trang đang mở, khi quay lại cửa sổ và ngay trước
  khi thêm vào giỏ hoặc gửi yêu cầu tạo đơn. Request lựa chọn cũ được hủy qua
  `AbortSignal`; không hiển thị tồn kho của size/topping trước cho lựa chọn mới.

## Phối hợp với Task 10c và Task 8

API này báo sớm theo lượng nguyên liệu đọc tại thời điểm kiểm tra. Task 10c vẫn
phải kiểm tra/trừ nguyên liệu trong transaction với optimistic locking khi tạo đơn,
vì khách khác có thể đặt hàng ngay sau lần kiểm tra này.

Giữ phương án của Issue #18/#21: trừ khi tạo PENDING; PAID không trừ thêm;
PAYMENT_FAILED giữ trong hạn; CANCELLED/hết hạn **5 phút** hoàn đúng một lần.
Thời hạn 5 phút theo cập nhật của nhóm và Issue #21 ngày 29/10/2026, tính từ lúc
tạo đơn; thử lại thanh toán không gia hạn giữ nguyên liệu. Issue #18 còn ghi
15 phút nên cần đồng bộ checkout/callback và đồng hồ đếm ngược khi tích hợp.
Thay đổi này không triển khai Payment, callback, hủy/hết hạn, mã giảm giá hay điểm
thưởng. Những phần đó cần tích hợp trong các thay đổi Task 10c/d/e và Task 8.

## Kiểm tra

Tại `backend`:

```powershell
npm.cmd test -- --runInBand
npm.cmd run lint
npm.cmd run build
```

Test mới kiểm tra size, topping, làm tròn, nguyên liệu dùng chung, giỏ vượt kho,
công thức thiếu, input không hợp lệ và HTTP API qua Nest/Supertest. Repository
trong bộ test HTTP được thay bằng dữ liệu trong bộ nhớ; không phải test PostgreSQL.

Tại `frontend`: `npm.cmd run lint`, `npm.cmd run build`.

Kiểm tra giao diện:

1. Mở `/products/1`; đổi S/M/L, bật/tắt topping và đối chiếu công thức.
2. Khi topping hết, số ly về 0; bỏ topping vẫn chọn và thêm món được.
3. Thêm các món dùng chung nguyên liệu vào giỏ; kiểm tra giới hạn từng dòng.
4. Giảm kho rồi quay lại cửa sổ: cảnh báo và giới hạn được cập nhật, món vẫn còn.
5. Ngắt API: báo lỗi, có nút thử lại, không gửi đơn khi chưa kiểm tra được.
