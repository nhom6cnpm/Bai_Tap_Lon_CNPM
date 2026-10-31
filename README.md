# ☕ BrewLite

Ứng dụng đặt cà phê không dùng tiền mặt — Bài tập lớn môn Công nghệ Phần mềm, Trường Đại học Sài Gòn (HK I, 2026–2027).

Khách xem menu, chọn size/topping, thêm vào giỏ, đặt đơn và thanh toán không tiền mặt
qua **ngân hàng giả lập**; nhân viên xác nhận thanh toán, cập nhật pha chế và xử lý hủy đơn
(tự hoàn tiền) trên trang quản trị. Backend có máy trạng thái đơn hàng, thanh toán
idempotent, giữ nguyên liệu khi đặt đồng thời, voucher và điểm thưởng (Task 10).

Repository: https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM

## Tài liệu
| Nội dung | Tài liệu |
|---|---|
| Bàn giao & luồng demo Task 9/10 | [docs/task-9-10-handoff.md](docs/task-9-10-handoff.md) |
| Quyết định nghiệp vụ đã chốt | [docs/task-9-10-team-decisions.md](docs/task-9-10-team-decisions.md) |
| Thanh toán do nhân viên xác nhận | [docs/staff-payment-integration.md](docs/staff-payment-integration.md) |
| Tồn kho theo nguyên liệu, giữ/hoàn nguyên liệu (10c) | [docs/task-10c-inventory.md](docs/task-10c-inventory.md) |
| Số ly còn bán theo size/topping | [docs/selection-availability.md](docs/selection-availability.md) |
| Thanh toán idempotent (10d) | [docs/task-10d-payments.md](docs/task-10d-payments.md) |
| Voucher & điểm thưởng (10e) | [docs/task-10e-vouchers.md](docs/task-10e-vouchers.md), [docs/task-10-voucher-points.md](docs/task-10-voucher-points.md) |
| Hủy đơn & nhân viên duyệt | [docs/task-9-cancellation-review.md](docs/task-9-cancellation-review.md) |
| Bảng pha chế | [docs/task-9-preparation-board.md](docs/task-9-preparation-board.md) |
| Bộ sưu tập API (Postman) | [BrewLite.postman_collection.json](BrewLite.postman_collection.json) |

Một số tài liệu Task 10c/d ghi luồng cũ (hạn 5 phút, cổng giả lập/callback); luồng hiện
tại là ngân hàng giả lập + nhân viên xác nhận, hạn 15 phút, như mô tả trong README này.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend | NestJS (TypeScript), REST API |
| Frontend | Next.js (React, TypeScript), TailwindCSS, React Query, Zustand |
| CSDL | PostgreSQL 16 + TypeORM (Migrations) |
| DevOps | Docker, Docker Compose (chưa có CI) |

## Cấu trúc thư mục
```
Bai_Tap_Lon_CNPM/
├── backend/            # NestJS API (port 3001)
├── frontend/           # Next.js app (port 3000)
├── docs/               # Tài liệu nghiệp vụ, bàn giao, kiểm thử
├── docker-compose.yml  # Docker Compose full-stack (postgres, backend, frontend)
└── README.md
```

## Yêu cầu
- Node.js >= 20
- npm >= 10
- Git
- Docker >= 24 & Docker Compose >= 2 (nếu chạy bằng Docker)

## Cài đặt & chạy

### Cách 1: Chạy bằng Docker Compose (Khuyến nghị cho kiểm thử & bàn giao)

Yêu cầu máy đã cài Docker Desktop hoặc Docker Engine.

```bash
# 1. Clone repository
git clone https://github.com/nhom6cnpm/Bai_Tap_Lon_CNPM.git
cd Bai_Tap_Lon_CNPM

# 2. Khởi động toàn bộ stack (PostgreSQL + Backend + Frontend)
docker-compose up --build
# hoặc nếu dùng Docker Compose plugin:
docker compose up --build
```

Kiểm tra:
- **Frontend**: http://localhost:3000 (Giao diện đặt đồ uống)
- **Backend API**: http://localhost:3001
- **API danh sách sản phẩm**: http://localhost:3001/products
- **PostgreSQL**: `localhost:5432` (user/pass/db: `brewlite`)

### Quét QR thanh toán bằng điện thoại khi chạy Docker

Điện thoại và máy tính phải cùng mạng Wi-Fi. Ở **thư mục gốc của repo** (cùng cấp với `docker-compose.yml`), tạo file `.env` và điền địa chỉ IPv4 của máy tính:

```env
NEXT_PUBLIC_APP_URL=http://<IP-máy-tính>:3000
```

Trên Windows, chạy `ipconfig` để xem IPv4 Wi-Fi; trên macOS chạy
`ipconfig getifaddr en0`. Sau khi thay đổi địa chỉ, chạy
`docker compose up -d --build frontend`. Trang ngân hàng giả lập gọi backend qua
proxy của frontend (`/api/mock-bank/...`), nên điện thoại chỉ cần mở được cổng 3000.
Nếu mở cả ứng dụng đặt món trên điện thoại, cần thêm
`NEXT_PUBLIC_API_URL=http://<IP-máy-tính>:3001` và
`FRONTEND_URL=http://<IP-máy-tính>:3000`. File `.env` được Git bỏ qua.

### Thanh toán giả lập (ngân hàng giả lập + nhân viên xác nhận)

1. Khách đặt đơn (PENDING), chọn **Chuyển khoản / Ví** hoặc **Thẻ tại quầy**.
2. **Ví:** màn hình hiện QR. Quét bằng điện thoại (hoặc bấm **Mở ngân hàng giả lập**)
   để mở trang `/mock-bank/<paymentId>`: số tiền bằng đúng tổng đơn (không sửa được),
   nội dung là mã đơn. Bấm **Chuyển tiền** thì sao kê của quán ghi "tiền vào" và
   phiên thanh toán chuyển `TRANSFER_RECEIVED`. **Đơn vẫn PENDING.**
3. Trang nhân viên `/admin/payments` tự làm mới 4 giây/lần, báo "Tiền đã về" (thông
   báo, âm báo, số trên tab). Nhân viên đối chiếu rồi bấm **Xác nhận** (đơn PAID) hoặc
   **Từ chối** (đơn PAYMENT_FAILED, tiền đã nhận được hoàn lại, khách thử lại được).
4. **Thẻ:** khách đưa QR/mã đơn cho nhân viên, quẹt thẻ ngoài đời; nhân viên xác nhận
   thì khoản tiền cũng được ghi vào sao kê.

**Hoàn tiền:** mọi lần hủy đơn đang có tiền (duyệt hủy đơn PAID, duyệt yêu cầu hủy sau
khi tiền đã về) và mọi lần từ chối sau khi tiền đã về đều tự ghi một dòng "Hoàn tiền"
vào sao kê, đúng số quán đang giữ, chỉ một lần. Tab **Sao kê** trên `/admin/payments`
(API `GET /admin/bank-transactions`) hiển thị tiền vào, đã hoàn và còn giữ. Ngân hàng
giả lập không có tài khoản hay số dư của khách, và không bao giờ tự đổi đơn sang PAID.

Task 10c giữ nguyên liệu khi tạo đơn PENDING, mặc định **15 phút từ lúc tạo đơn**
theo cập nhật Task 8 ngày 30/10. Đơn **đã có tiền về** thì không tự hủy khi hết hạn:
nhân viên vẫn xác nhận được, hoặc từ chối và hoàn tiền. Thời hạn được lưu trong `orders.expiresAt`;
checkout/QR dùng đồng hồ backend, thử lại không gia hạn và PAID không trừ thêm.
`ORDER_PAYMENT_TIMEOUT_MINUTES` trong `.env` gốc (Docker) hoặc `backend/.env`
(chạy local) chỉ áp dụng cho đơn mới. Đơn cũ giữ nguyên hạn.

Trang nhân viên: http://localhost:3000/admin/payments. Docker có tài khoản phát triển
mặc định `admin@brewlite.vn` / `admin123`; có thể đổi qua `ADMIN_EMAIL` và
`ADMIN_PASSWORD`. Với tài khoản đã tồn tại, seed giữ mật khẩu cũ. Chạy local cần
điền hai biến này trong `backend/.env`. Không còn yêu cầu `PAYMENT_GATEWAY_SECRET`.

Dừng và dọn dẹp container:
```bash
# Dừng container (dữ liệu DB trong volume pgdata vẫn giữ nguyên)
docker-compose down

# Dừng và xóa toàn bộ dữ liệu PostgreSQL để reset về ban đầu
docker-compose down -v
```

---

### Cách 2: Chạy trực tiếp trên máy host (Local Development)

#### 1. Chuẩn bị cơ sở dữ liệu PostgreSQL
Khởi tạo database PostgreSQL cục bộ hoặc chạy riêng container PostgreSQL:
```bash
docker run -d --name brewlite-postgres -p 5432:5432 -e POSTGRES_USER=brewlite -e POSTGRES_PASSWORD=brewlite -e POSTGRES_DB=brewlite postgres:16-alpine
```

#### 2. Backend
```bash
cd backend
cp .env.example .env
# Điền JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD vào .env
npm install
npm run start:dev
```
Kiểm tra: mở http://localhost:3001 → hiện `Hello BrewLite!`. Khi backend khởi động, TypeORM sẽ tự động chạy migrations và seed 6 sản phẩm mặc định vào cơ sở dữ liệu nếu bảng rỗng.

#### 3. Frontend (mở terminal mới)
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Kiểm tra: mở http://localhost:3000 → hiển thị trang Menu món.

---

## Kiểm thử & Chất lượng mã nguồn

### Backend
```bash
cd backend
npm test            # unit test (không cần database)
npm run lint        # oxlint
npm run format      # prettier
```

Test tích hợp với PostgreSQL thật (state machine, idempotency, đặt đồng thời không
vượt tồn kho, voucher/điểm, hủy & hoàn tiền). Database **phải** có tên kết thúc bằng
`_test` vì test sẽ xóa sạch dữ liệu trong đó:

```bash
# Tạo database một lần (từ thư mục gốc, khi Docker đang chạy)
docker compose exec postgres createdb -U brewlite brewlite_task10_test

cd backend
# macOS / Linux
TEST_DATABASE_URL=postgresql://brewlite:brewlite@127.0.0.1:5432/brewlite_task10_test npm run test:e2e
# Windows PowerShell
$env:TEST_DATABASE_URL = 'postgresql://brewlite:brewlite@127.0.0.1:5432/brewlite_task10_test'; npm run test:e2e
```
Không đặt `TEST_DATABASE_URL` thì các test cần database bị bỏ qua (không phải là đã qua).

### Frontend
```bash
cd frontend
npm run lint
npm run build
```

Test giao diện Playwright (desktop + mobile) tự khởi động backend (cổng 3201) và frontend
(cổng 3200) trên database riêng `brewlite_task9_ui_test`:

```bash
docker compose exec postgres createdb -U brewlite brewlite_task9_ui_test   # một lần
cd frontend
npx playwright install chromium   # một lần; hoặc dùng Chrome có sẵn: PLAYWRIGHT_CHANNEL=chrome
npm run test:e2e
```

---

## Checklist Demo End-to-End (Bàn giao)
Chạy `docker compose up --build`, mở http://localhost:3000. Tài khoản nhân viên mặc định:
`admin@brewlite.vn` / `admin123`.

- [ ] **Menu**: 6 món, có hình, giá và số ly còn bán; trạng thái tải/lỗi.
- [ ] **Chi tiết món**: chọn Size (S/M/L) và Topping, giá cập nhật ngay.
- [ ] **Giỏ hàng**: thêm, sửa số lượng, xóa; tổng tiền và badge số lượng đúng; tải lại trang vẫn giữ giỏ.
- [ ] **Đăng ký & đăng nhập** (JWT); chưa đăng nhập thì không đặt được đơn.
- [ ] **Đặt hàng**: đơn `PENDING`, nguyên liệu được giữ, có đồng hồ 15 phút; có thể áp voucher.
- [ ] **Thanh toán (Ví)**: quét QR / bấm "Mở ngân hàng giả lập" → "Chuyển tiền" → màn hình khách báo
      "Đã nhận tiền, đang chờ nhân viên xác nhận"; đơn vẫn `PENDING`.
- [ ] **Nhân viên** (`/admin/payments`, tài khoản khác/tab ẩn danh): thấy thông báo "Tiền đã về",
      bấm **Xác nhận** → đơn `PAID`, khách tự chuyển sang màn hình xác nhận (mã đơn, trạng thái),
      được cộng điểm. Tab **Sao kê** có dòng tiền vào.
- [ ] **Thanh toán lỗi**: nhân viên **Từ chối** → `PAYMENT_FAILED`, tiền được hoàn, giỏ giữ nguyên, khách bấm "Thử lại".
- [ ] **Lịch sử đơn** (`/orders`): thấy đơn và trạng thái.
- [ ] **Pha chế** (`/admin/orders`): `PAID → PREPARING → READY → COMPLETED`; khách được báo khi món sẵn sàng.
- [ ] **Hủy đơn**: đơn chưa trả tiền hủy ngay; đơn `PAID` gửi yêu cầu → nhân viên đồng ý → `CANCELLED`,
      tự hoàn tiền (Sao kê có dòng "Hoàn tiền"), trả lượt voucher, thu hồi điểm.
- [ ] **Bảo toàn dữ liệu**: `docker compose down` rồi `up` — tài khoản và đơn vẫn còn (volume `pgdata`).

---

## Quy ước làm việc (Git)
- `main`: bản chạy được, **không push trực tiếp**.
- Mỗi task 1 nhánh riêng tách từ `main`: `feature/task-<số>-<mô-tả-ngắn>`
  (ví dụ `feature/task-2-api-products`).
- Làm xong tạo Pull Request vào `main`.
- Commit message theo dạng: `feat(products): add GET /products`, `fix(cart): ...`, `docs: ...`
- Mọi PR cần **ít nhất 1 người review** trước khi merge vào `main`.

## Biến môi trường
Xem `backend/.env.example` và `frontend/.env.example`. **Không commit file `.env`.**

## Quy ước code

### Đặt tên
| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| Biến, hàm | camelCase | `totalPrice`, `getProducts()` |
| Class, interface, type, component React | PascalCase | `ProductsService`, `CartItem` |
| Hằng số | UPPER_SNAKE_CASE | `MAX_QUANTITY`, `ORDER_STATUS` |
| Biến boolean | tiền tố `is/has/can` | `isLoading`, `hasError` |
| File backend (NestJS) | kebab-case + hậu tố | `products.service.ts`, `create-order.dto.ts` |
| File component frontend | PascalCase | `ProductCard.tsx` |
| File khác frontend (hook, util, store) | camelCase | `useCart.ts`, `formatPrice.ts` |
| Thư mục | kebab-case | `order-items/` |
| Cột DB / field Prisma | camelCase | `imageUrl`, `passwordHash` |
| Endpoint REST | số nhiều, kebab-case | `/products`, `/orders/me` |
| Trạng thái đơn hàng | UPPER_SNAKE_CASE | `PENDING`, `PAYMENT_FAILED` |

### Quy tắc chung
- Viết bằng TypeScript, **không dùng `any`** trừ khi thật sự cần.
- Tên biến, hàm, comment viết **tiếng Anh**; nội dung hiển thị trên UI viết tiếng Việt.
- Tên có nghĩa, không viết tắt khó hiểu (`qty` ok, `x1`, `tmp` không ok).
- Backend: mỗi tính năng 1 module (`products`, `auth`, `orders`, `payments`), có DTO riêng cho request/response.
- Chạy `npm run lint` và `npm run format` trước khi commit.
- Không commit `console.log` debug, file `.env`, `node_modules`.
