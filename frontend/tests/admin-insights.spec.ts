import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { AuthResponse } from "../src/lib/auth";

const api = "http://127.0.0.1:3201";

async function login(
  request: APIRequestContext,
  staff = false,
): Promise<AuthResponse> {
  const data = staff
    ? { email: "staff@task9-ui.test", password: "StaffUiTest123" }
    : { email: `${randomUUID()}@insights-ui.test`, password: "InsightsUi123" };
  if (!staff)
    expect((await request.post(`${api}/auth/register`, { data })).ok()).toBe(
      true,
    );
  const response = await request.post(`${api}/auth/login`, { data });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<AuthResponse>;
}

async function authenticate(context: BrowserContext, auth: AuthResponse) {
  await context.addInitScript((data) => {
    localStorage.setItem("brewlite_token", data.access_token);
    localStorage.setItem("brewlite_user", JSON.stringify(data.user));
  }, auth);
}

async function createOrder(request: APIRequestContext, customer: AuthResponse) {
  const response = await request.post(`${api}/orders`, {
    headers: {
      Authorization: `Bearer ${customer.access_token}`,
      "Idempotency-Key": randomUUID(),
    },
    data: { items: [{ productId: "1", size: "S", toppingIds: [], qty: 1 }] },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { orderId: string; total: number };
}

async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("staff see the ingredient table with stock held for unpaid orders", async ({
  page,
  context,
  request,
}) => {
  const customer = await login(request);
  await createOrder(request, customer);
  await authenticate(context, await login(request, true));
  await page.goto("/admin/ingredients");
  await expect(
    page.getByRole("heading", { name: "Nguyên liệu", exact: true }),
  ).toBeVisible();
  const table = page.getByRole("table", { name: "Bảng nguyên liệu" });
  const coffee = table.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: /^Cà phê/ }),
  });
  await expect(coffee).toBeVisible();
  // The unpaid order holds coffee (second data cell = "held for unpaid orders")
  await expect(coffee.getByRole("cell").nth(1)).toHaveText(/^\d[\d.]* g$/);
  await expect(
    page.getByRole("heading", { name: "Số ly còn bán của từng món" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Số ly còn bán" })
      .getByText("Cà phê sữa", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Nguyên liệu", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await fits(page);
});

test("staff search the order history and open an order with its payments and statement", async ({
  page,
  context,
  request,
}) => {
  const customer = await login(request);
  const order = await createOrder(request, customer);
  await authenticate(context, await login(request, true));
  await page.goto("/admin/history");
  await expect(
    page.getByRole("heading", { name: "Lịch sử đơn", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Mã đơn hoặc email khách").fill(order.orderId);
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  const list = page.getByRole("list", { name: "Danh sách đơn" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText(customer.user.email);
  await list.getByRole("link", { name: order.orderId }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/history/${order.orderId}$`));
  await expect(
    page.getByRole("heading", { name: order.orderId }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Phiên thanh toán" }),
  ).toBeVisible();
  await expect(page.getByText("Chưa có phiên thanh toán.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sao kê của đơn" }),
  ).toBeVisible();
  await fits(page);
});

test("customers cannot open the staff ingredient and history pages", async ({
  page,
  context,
  request,
}) => {
  await authenticate(context, await login(request));
  for (const path of ["/admin/ingredients", "/admin/history"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Không có quyền truy cập" }),
    ).toBeVisible();
  }
});
