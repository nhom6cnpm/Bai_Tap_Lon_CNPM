# ☕ BrewLite

Ứng dụng đặt cà phê không dùng tiền mặt — Bài tập lớn môn Công nghệ Phần mềm, Trường Đại học Sài Gòn (HK I, 2026–2027).

## Công nghệ
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

### Thanh toán và trang admin (nhân viên xác nhận)

Thanh toán **không** để khách tự xác nhận. Luồng:

1. Khách đặt đơn → đơn `PENDING`, chọn **Chuyển khoản / Ví** hoặc **Thẻ tại quầy**.
2. Màn hình thanh toán hiện **mã QR chứa mã đơn**. Khách chuyển tiền với nội dung là mã đơn, rồi bấm **"Tôi đã chuyển tiền"**. Lúc này đơn **vẫn là `PENDING`**, phiên thanh toán chuyển sang `CUSTOMER_REPORTED`.
3. Nhân viên mở **http://localhost:3000/admin/payments**. Trang tự làm mới mỗi 4 giây, có thông báo, âm báo và số khách đang chờ trên tab.
4. Nhân viên bấm **Xác nhận đã nhận tiền** → đơn `PAID`, hoặc **Từ chối** → đơn `PAYMENT_FAILED` (khách có thể thử lại). Màn hình của khách tự cập nhật.

Tài khoản admin được tạo sẵn khi backend khởi động, lấy từ biến môi trường `ADMIN_EMAIL` / `ADMIN_PASSWORD` (mặc định `admin@brewlite.vn` / `admin123`). Khi nộp hoặc triển khai thật, hãy đổi mật khẩu này trong file `.env`. Tài khoản khách thường gọi API `/admin/*` sẽ nhận lỗi 403.

Để nhân viên quét QR của khách bằng điện thoại (cùng mạng Wi-Fi), tạo file `.env` ở **thư mục gốc của repo** và điền IPv4 của máy tính:

```env
NEXT_PUBLIC_APP_URL=http://<IP-máy-tính>:3000
```

Trên Windows, chạy `ipconfig` để xem IPv4. Trên macOS, chạy `ipconfig getifaddr en0`. Sau đó chạy `docker compose up -d --build frontend`. File `.env` được Git bỏ qua.

Mỗi đơn có **15 phút** để thanh toán và chờ nhân viên xác nhận. Để đổi, thêm `ORDER_PAYMENT_TIMEOUT_MINUTES=<số phút>` vào `.env` ở thư mục gốc rồi build lại. Compose truyền cùng giá trị này cho backend và frontend. Việc tự hủy đơn quá hạn thuộc Task 10c.

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
# Điền JWT_SECRET vào .env
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

# Chạy kiểm thử tích hợp (e2e Tests) — yêu cầu PostgreSQL đang chạy:
# (Khởi động DB: docker compose up -d postgres)
npm run test:e2e

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
