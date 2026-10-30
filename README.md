# ☕ BrewLite

Ứng dụng đặt cà phê không dùng tiền mặt — Bài tập lớn môn Công nghệ Phần mềm, Trường Đại học Sài Gòn (HK I, 2026–2027).

Nền làm việc Task 9: [kế hoạch tích hợp với schema và auth của nhóm](docs/task-9-integration-plan.md).

Task 9 đã tích hợp: [API, giao diện và cách chạy](docs/task-9-integration.md),
[kết quả kiểm thử](docs/task-9-validation.md).

Máy Ân tiếp tục làm việc tại `D:\Do_an_CNPM\Bai_Tap_Lon_CNPM`.
Bản Docker đang chạy từ nhánh `feature/task-9-staff-payment-integration`, đã ghép
Task 9/10c/d và voucher với thanh toán nhân viên mới. Code đang phát triển ở nhánh
`feature/task-9-preparation-board`. Các nhánh cũ vẫn được giữ;
[ghi nhận xử lý merge và giữ bản cũ](docs/workspace-recovery.md).

**Theo dõi công việc của Ân:** [Thứ tự thực hiện Task 9 và Task 10c/d/e](docs/task-9-10-plan.md)
— checklist, phạm vi đã chốt và bước tiếp theo.

Task 10c: [giữ nguyên liệu, hủy/hết hạn và kiểm thử PostgreSQL](docs/task-10c-inventory.md).

Task 10d: [khóa yêu cầu thanh toán và gửi lại an toàn](docs/task-10d-payments.md).

Task 10e: [giao diện chọn/nhập voucher, API quote và lưu giảm giá trên đơn](docs/task-10e-vouchers.md).
Đã có giao diện và nền xử lý trên nhánh `feature/task-10-vouchers`; có cấu hình
[ba voucher mẫu](backend/voucher-samples.json) để nạp bằng `npm run vouchers:seed`
trong backend. Cách chỉnh/xem chi tiết ở tài liệu Task 10e.

Bước tiếp theo: [nền dữ liệu lượt voucher, điểm và yêu cầu hủy](docs/task-10-benefits-foundation.md)
đã có trên nhánh `feature/task-10-benefits-foundation`; chưa bật đếm lượt/tích điểm trên bản Docker.

[Backend hạn mức voucher và tích điểm](docs/task-10-voucher-points.md) đã hoàn thành
trên `feature/task-10-voucher-points`; giữ/chốt/trả lượt và điểm theo transaction.
[Giao diện số lượt voucher và cập nhật điểm](docs/task-10-voucher-points-ui.md)
đã hoàn thành trên `feature/task-10-voucher-points-ui`. Bản Docker/database đang
chạy vẫn ở bản tích hợp thanh toán nhân viên; cập nhật môi trường ở bước bàn giao.

[Bước 4 — hủy ngay/yêu cầu hủy và nhân viên duyệt](docs/task-9-cancellation-review.md)
đã hoàn thành trên `feature/task-9-cancellation-review`, kế thừa các bước voucher/điểm.
Có giao diện khách và `/admin/orders`.

[Bước 5 — bảng pha chế và thông báo nhận món](docs/task-9-preparation-board.md)
triển khai trên `feature/task-9-preparation-board`, kế thừa các bước trước.
Nhân viên cập nhật PAID → PREPARING → READY → COMPLETED; khách theo dõi trên lịch
sử/chi tiết đơn. Bản Docker đang chạy chưa cập nhật các bước mới này.

**Bản tích hợp mới nhất (30/10/2026):** nhánh `feature/task-9-staff-payment-integration`
đã ghép main `61f4474` (PR #30). [Luồng nhân viên xác nhận, thời hạn 15 phút và cách chạy thử](docs/staff-payment-integration.md).
Các tài liệu Task 10c/d cũ ghi lại luồng 5 phút/callback trước thay đổi này.

## Công nghệ

API và giao diện số ly còn bán theo size/topping:
[hướng dẫn tích hợp](docs/selection-availability.md).

| Thành phần | Công nghệ |
|---|---|
| Backend | NestJS (TypeScript), REST API |
| Frontend | Next.js (React, TypeScript), TailwindCSS, React Query, Zustand |
| CSDL | PostgreSQL 16 + TypeORM (Migrations) |
| DevOps | Docker, Docker Compose, GitHub Actions |

## Cấu trúc thư mục
```
brewlite/
├── backend/            # NestJS API (port 3001)
├── frontend/           # Next.js app (port 3000)
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
git clone <URL_REPO>
cd brewlite

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

Trên Windows, chạy `ipconfig` để xem IPv4 Wi-Fi. Sau khi thay đổi địa chỉ,
chạy `docker compose up -d --build frontend`. Nếu mở cả ứng dụng trên điện thoại,
cần cấu hình thêm `NEXT_PUBLIC_API_URL=http://<IP-máy-tính>:3001` và
`FRONTEND_URL=http://<IP-máy-tính>:3000`. File `.env` được Git bỏ qua.

QR hiện chứa liên kết `/admin/payments?orderId=...` để **nhân viên** tra cứu đơn;
phải đăng nhập ADMIN để duyệt. Khách bấm **Tôi đã chuyển tiền** chỉ báo cho nhân viên,
đơn vẫn PENDING. Nhân viên xác nhận mới chuyển PAID; từ chối chuyển PAYMENT_FAILED.
Đây là luồng mô phỏng xác nhận tại cửa hàng, chưa tích hợp ngân hàng/VNPay.

Task 10c giữ nguyên liệu khi tạo đơn PENDING, mặc định **15 phút từ lúc tạo đơn**
theo cập nhật Task 8 ngày 30/10. Thời hạn được lưu trong `orders.expiresAt`;
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

# Chạy kiểm thử đơn vị (Unit Tests)
npm test

# Chạy e2e với PostgreSQL và database riêng, tên phải kết thúc bằng _test.
# Tạo DB một lần từ thư mục gốc:
# docker compose exec postgres createdb -U brewlite brewlite_task10_test
# PowerShell, từ backend:
$env:TEST_DATABASE_URL = 'postgresql://brewlite:brewlite@127.0.0.1:5432/brewlite_task10_test'
npm run test:e2e
# Không đặt TEST_DATABASE_URL thì các suite DB bị skip, không phải test đã qua.

# Kiểm tra linter
npm run lint

# Tự động định dạng mã nguồn
npm run format
```

---

## Checklist Demo End-to-End (Bàn giao)
- [ ] **Menu**: Mở http://localhost:3000 hiển thị danh sách 6 món cà phê / trà.
- [ ] **Chi tiết món**: Bấm vào món xem giá gốc, chọn Size (S/M/L) và Topping, giá cập nhật theo thời gian thực.
- [ ] **Giỏ hàng**: Thêm món vào giỏ, điều chỉnh số lượng, tổng tiền khớp với tính toán.
- [ ] **Đăng ký & Đăng nhập**: Đăng ký tài khoản người dùng mới và đăng nhập nhận JWT token.
- [ ] **Đặt hàng**: Đặt món từ giỏ hàng, đơn hàng được lưu vào PostgreSQL với trạng thái `PENDING`.
- [ ] **Bảo toàn dữ liệu**: Dừng và khởi động lại (`docker-compose down` rồi `up`) — tài khoản và đơn hàng vẫn còn nguyên vẹn trong PostgreSQL volume `pgdata`.

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
