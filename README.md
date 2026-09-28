# ☕ BrewLite

Ứng dụng đặt cà phê không dùng tiền mặt — Bài tập lớn môn Công nghệ Phần mềm, Trường Đại học Sài Gòn (HK I, 2026–2027).

## Công nghệ
| Thành phần | Công nghệ |
|---|---|
| Backend | NestJS (TypeScript), REST API |
| Frontend | Next.js (React, TypeScript), TailwindCSS, React Query, Zustand |
| CSDL | PostgreSQL (thêm ở các sprint sau) |
| DevOps | Docker Compose, GitHub Actions |

## Cấu trúc thư mục
```
brewlite/
├── backend/            # NestJS API (port 3001)
├── frontend/           # Next.js app (port 3000)
├── docker-compose.yml  # hoàn thiện ở Sprint 2–3
└── README.md
```

## Yêu cầu
- Node.js >= 20
- npm >= 10
- Git

## Cài đặt & chạy

### 1. Clone repo
```bash
git clone <URL_REPO>
cd brewlite
git checkout dev
```

### 2. Backend
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
- `main`: bản ổn định, **không push trực tiếp**.
- `dev`: nhánh làm việc chung, merge qua Pull Request.
- Mỗi task 1 nhánh riêng tách từ `dev`: `feature/task-<số>-<mô-tả-ngắn>`
  (ví dụ `feature/task-2-api-products`).
- Commit message theo dạng: `feat(products): add GET /products`, `fix(cart): ...`, `docs: ...`
- Mọi PR cần **ít nhất 1 người review** trước khi merge vào `dev`.

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