# Kiểm thử UI bằng production image Docker

Đây là profile kiểm thử tùy chọn, dùng cùng 62 ca Playwright desktop/mobile.
Chạy ứng dụng thông thường vẫn dùng `docker compose up -d --build`.
Profile này dùng API/frontend riêng 3201/3200 và database kiểm thử riêng.

## Chuẩn bị

PowerShell, từ thư mục gốc repo; Docker Desktop đang mở, 3200/3201 còn trống,
frontend đã `npm ci` và có trình duyệt Playwright (Windows mặc định dùng Edge).
Nếu Docker chưa có trong PATH, dùng đường dẫn `docker.exe` trên máy thay cho `docker`.

```powershell
docker compose build backend frontend
$apiImage = docker compose images -q backend
$postgresInfo = (docker inspect brewlite-postgres | ConvertFrom-Json)[0]
$networkName = $postgresInfo.NetworkSettings.Networks.PSObject.Properties.Name | Select-Object -First 1

# Chọn tên DB mới ở mỗi lần chuẩn bị; luôn kết thúc bằng _ui_test.
$uiDatabase = 'brewlite_handoff_ui_test'
docker exec brewlite-postgres createdb -U brewlite $uiDatabase

docker run -d --name brewlite-handoff-ui-backend --network $networkName -p 127.0.0.1:3201:3001 `
  -e "DATABASE_URL=postgresql://brewlite:brewlite@brewlite-postgres:5432/$uiDatabase" `
  -e JWT_SECRET=task9-ui-test-jwt -e FRONTEND_URL=http://127.0.0.1:3200 `
  -e ADMIN_EMAIL=staff@task9-ui.test -e ADMIN_PASSWORD=StaffUiTest123 `
  -e ORDER_PAYMENT_TIMEOUT_MINUTES=15 $apiImage
```

Đợi `http://127.0.0.1:3201/products` trả 200; backend tự migration và tạo admin
kiểm thử từ biến môi trường. Sau đó nạp fixture và chạy frontend:

```powershell
docker cp backend/test/docker-ui-fixtures.sql brewlite-postgres:/tmp/docker-ui-fixtures.sql
docker exec brewlite-postgres psql -U brewlite -d $uiDatabase -v ON_ERROR_STOP=1 -f /tmp/docker-ui-fixtures.sql

docker build --build-arg NEXT_PUBLIC_API_URL=http://127.0.0.1:3201 `
  --build-arg NEXT_PUBLIC_APP_URL=http://127.0.0.1:3200 `
  -t brewlite-handoff-ui-frontend ./frontend
docker run -d --name brewlite-handoff-ui-frontend -p 127.0.0.1:3200:3000 brewlite-handoff-ui-frontend

cd frontend
# Chỉ đặt biến này nếu docker.exe chưa có trong PATH:
# $env:DOCKER_EXE = 'D:\DockerApp\resources\bin\docker.exe'
npm.cmd run test:e2e:docker
```

Đợi frontend tại 3200 sẵn sàng trước khi chạy test. Credential trong ví dụ chỉ
thuộc database kiểm thử. Fixture từ chối DB không có hậu tố `_ui_test` hoặc đã có
đơn/voucher; không có lệnh tự xóa dữ liệu để vượt qua guard.

`playwright.docker.config.ts` kiểm tra tên container, port bind localhost,
NODE_ENV=production, URL DB và `current_database()` thật trước khi chạy test.
Không khởi động server Node local, không truncate hay seed database chính.
Các test vẫn tạo tài khoản/đơn và thay trạng thái trong database kiểm thử.

Nếu tên container đã tồn tại từ lượt kiểm tra trước, dừng và xóa đúng hai
container kiểm thử trước khi chuẩn bị lại; dùng tên DB mới. Kết thúc lượt kiểm tra:

```powershell
docker stop brewlite-handoff-ui-frontend brewlite-handoff-ui-backend
docker rm brewlite-handoff-ui-frontend brewlite-handoff-ui-backend
```

Các lệnh này không xóa image, volume hoặc DB. Không dùng `down -v` cho môi trường
đồ án. Log/kết quả nằm ở `frontend/test-results`; không commit dữ liệu test.
