# ☕ BrewLite

Ứng dụng đặt cà phê không dùng tiền mặt — Bài tập lớn môn Công nghệ Phần mềm, Trường Đại học Sài Gòn (HK I, 2026–2027).

## Công nghệ
| Thành phần | Công nghệ |
|---|---|
| Backend | NestJS (TypeScript), REST API |
| Frontend | Next.js (React, TypeScript), TailwindCSS, React Query, Zustand |
| CSDL | PostgreSQL 17 + TypeORM (tài khoản và lịch sử đơn) |
| DevOps | Docker Compose, GitHub Actions |

## Cấu trúc thư mục
```
brewlite/
├── backend/            # NestJS API (port 3001)
├── frontend/           # Next.js app (port 3000)
├── docker-compose.yml  # frontend + backend + PostgreSQL
├── docs/               # hợp đồng API và hướng dẫn tích hợp task 9
└── README.md
```

## Yêu cầu
- Node.js >= 20
- npm >= 10
- Git
- Docker Desktop đang chạy Linux containers (nếu dùng Docker Compose)

## Task 9 — chạy nhanh và bàn giao

Giao diện theo thiết kế Stitch của nhóm. Xem [hợp đồng API, phạm vi và kịch bản
tích hợp](docs/task-9-integration.md) trước khi ghép task 6/7/8.

### Chạy cả ba dịch vụ bằng Docker Compose

Trong PowerShell tại thư mục gốc repo:

```powershell
Copy-Item .env.example .env
# Sửa JWT_SECRET trong .env thành chuỗi ngẫu nhiên riêng; không commit .env.
docker compose up --build -d
docker compose ps
```

Không ghi đè .env nếu đã có cấu hình riêng. Backend tự chạy migration khởi tạo;
không dùng synchronize và không tự nạp dữ liệu demo. DB lưu trong named volume.
Mở frontend http://localhost:3000, API http://localhost:3001 và health
http://localhost:3001/health. Có thể mất vài phút ở lần build đầu tiên.
Máy cần trống các port 3000, 3001, 5432. NEXT_PUBLIC_API_URL được nhúng lúc build,
phải là địa chỉ trình duyệt truy cập được; thay đổi thì build lại frontend.
POSTGRES_PASSWORD dùng trong DATABASE_URL cần URL-encode nếu có ký tự đặc biệt;
ví dụ cục bộ dùng ký tự chữ/số/gạch dưới. Đổi mật khẩu env không tự đổi mật khẩu
trong volume PostgreSQL đã tồn tại.

```powershell
docker compose logs backend
docker compose stop
```

`stop` giữ dữ liệu. Không dùng `down -v` khi cần giữ DB.

### Những trang đã có

| Đường dẫn | Chức năng |
|---|---|
| `/demo/orders` | Xem giao diện lịch sử bằng dữ liệu mẫu, không cần backend |
| `/demo/orders/bl1042/confirmation` | Xác nhận đơn mẫu đã thanh toán |
| `/demo/orders/bl1010/confirmation` | Đơn mẫu thanh toán thất bại |
| `/demo/orders?state=empty` | Trạng thái chưa có đơn (`loading`, `error` cũng được hỗ trợ) |
| `/login` | Đăng ký/đăng nhập qua API hiện có |
| `/orders` | Lịch sử thật của tài khoản đang đăng nhập |
| `/orders/{id}/confirmation` | Chi tiết/xác nhận đơn thật; `id` là UUID |

Các trang thật không tự chuyển sang dữ liệu mẫu khi lỗi hoặc chưa đăng nhập.
Giao diện dùng font cục bộ và ảnh trong public/images/task9.

### Dữ liệu mẫu trong PostgreSQL (tùy chọn, chỉ phục vụ demo)

Chỉ chạy khi chủ động muốn nạp ba đơn mẫu và tài khoản demo vào DB cục bộ:

```powershell
docker compose exec -e ALLOW_DEMO_SEED=true -e DEMO_PASSWORD=DemoBrewLite123 backend npm run seed:demo
```

Đăng nhập `demo@brewlite.test`, mật khẩu bạn truyền ở DEMO_PASSWORD.
Các mã `DEMO-BL...` phân biệt với đơn thật. Chạy lại không tạo trùng đơn hoặc
đổi mật khẩu tài khoản đã có. Seed không thực hiện giao dịch thanh toán.

### Kiểm tra

```powershell
cd backend
npm.cmd run build
npm.cmd run lint
npm.cmd run format
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
cd ../frontend
npm.cmd run format
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

Frontend dùng Playwright với Microsoft Edge đã cài, kiểm tra desktop và mobile.
Nếu máy không có Edge: `npx.cmd playwright install msedge`. Không mở đồng thời
dịch vụ khác trên port 3100 trong lúc chạy test giao diện.

Nếu Compose đã chạy và đã seed, có thể kiểm thử trực tiếp bản Docker, gồm luồng
đăng nhập → lịch sử → xác nhận qua API thật. Chạy tại thư mục frontend:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'
$env:TASK9_DEMO_PASSWORD='DemoBrewLite123' # Dùng đúng mật khẩu đã seed
npm.cmd run test:e2e
Remove-Item Env:PLAYWRIGHT_BASE_URL, Env:TASK9_DEMO_PASSWORD
```

Nếu không đặt TASK9_DEMO_PASSWORD, hai ca kiểm thử đăng nhập với DB mẫu sẽ skip;
12 ca kiểm thử giao diện còn lại vẫn chạy. Không chạy live test với tài khoản thật.

Các test API với DB thật chỉ chạy khi đặt TEST_DATABASE_URL và DB đích kết thúc
bằng `_test`; nếu không đặt, suite PostgreSQL được **skip**, không coi là đã kiểm
thử DB. Tạo database kiểm thử riêng trong PostgreSQL local trước:

```powershell
docker compose exec db createdb -U brewlite brewlite_test
cd backend
$env:TEST_DATABASE_URL='postgresql://brewlite:brewlite_local@localhost:5432/brewlite_test'
npm.cmd run test:e2e -- --runInBand
Remove-Item Env:TEST_DATABASE_URL
```

Suite chạy migration rồi chỉ xóa bản ghi do chính test tạo. Kiểm tra JWT,
cách ly tài khoản, 400/401/404, lịch sử trống và dữ liệu sau restart ứng dụng.

**Phần còn chờ nhóm:** task 3–6 và 8 chưa có trong bản gốc. Vì vậy demo toàn bộ
chọn món → giỏ → thanh toán → xác nhận chỉ nghiệm thu sau khi ghép các phần này.
Hiện có thể demo đầy đủ phần task 9 với dữ liệu seed, kiểm tra API và lưu dữ liệu.

## Cài đặt & chạy

### 1. Clone repo
```bash
git clone <URL_REPO>
cd brewlite
```

### 2. Backend
Backend hiện cần PostgreSQL. Có thể chạy riêng DB với `docker compose up -d db`
sau khi chuẩn bị .env ở gốc, hoặc dùng PostgreSQL cục bộ và sửa DATABASE_URL.
Nếu .env backend cũ đã có, đối chiếu DATABASE_URL/JWT_SECRET với .env.example;
không ghi đè bí mật đang dùng. Trên PowerShell dùng `Copy-Item` thay cho `cp`,
và `npm.cmd` nếu máy chặn npm.ps1.

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```
Kiểm tra: mở http://localhost:3001 → hiện `Hello BrewLite`.

### 3. Frontend (mở terminal mới)
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
Kiểm tra: mở http://localhost:3000 → hiện `Backend nói: Hello BrewLite`.

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
