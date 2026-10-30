import { reviewAsStaff } from "./staff";
import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Order, OrderStatus } from "../src/types/order";

const api = "http://127.0.0.1:3201";
const password = "Task9Demo123";

async function account(request: APIRequestContext) {
  const email = `${randomUUID()}@task9-ui.test`;
  expect(
    (
      await request.post(`${api}/auth/register`, { data: { email, password } })
    ).ok(),
  ).toBe(true);
  const response = await request.post(`${api}/auth/login`, {
    data: { email, password },
  });
  expect(response.ok()).toBe(true);
  return {
    ...((await response.json()) as {
      access_token: string;
      user: { id: string; email: string; loyaltyPoints: number };
    }),
    email,
  };
}

async function authenticate(
  context: BrowserContext,
  auth: Awaited<ReturnType<typeof account>>,
) {
  await context.addInitScript((data) => {
    localStorage.setItem("brewlite_token", data.access_token);
    localStorage.setItem("brewlite_user", JSON.stringify(data.user));
  }, auth);
}

function order(status: OrderStatus, index = 0, expiresIn = 240000): Order {
  const now = Date.now();
  return {
    id: `ORD-${status}-${index}`,
    status,
    total: 35000,
    subtotal: 35000,
    discount: 0,
    voucherCode: null,
    voucherTitle: null,
    createdAt: new Date(now - 60000).toISOString(),
    expiresAt: new Date(now + expiresIn).toISOString(),
    cancelledAt: status === "CANCELLED" ? new Date(now).toISOString() : null,
    cancelReason: status === "CANCELLED" ? "PAYMENT_TIMEOUT" : null,
    paymentMethod: status === "PAID" ? "WALLET" : null,
    serverTime: new Date(now).toISOString(),
    canPay: ["PENDING", "PAYMENT_FAILED"].includes(status) && expiresIn > 0,
    items: [
      {
        id: `item-${status}-${index}`,
        productId: "1",
        name: "Cà phê sữa",
        imageUrl: "/images/coffee.jpg",
        size: "S",
        toppingIds: [],
        qty: 1,
        unitPrice: 35000,
        lineTotal: 35000,
      },
    ],
  };
}

async function mockOrders(page: Page, orders: Order[]) {
  await page.route(`${api}/orders/**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const id = decodeURIComponent(
      new URL(route.request().url()).pathname.slice("/orders/".length),
    );
    const body = id === "me" ? orders : orders.find((entry) => entry.id === id);
    await route.fulfill({
      status: body ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(body ?? { message: "Không tìm thấy đơn hàng" }),
    });
  });
}

async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test
      .info()
      .outputPath(
        `screen-${new URL(page.url()).pathname.replace(/[^a-z0-9]/gi, "-")}.png`,
      ),
    fullPage: true,
  });
}

test("login returns to own empty history with shared navigation", async ({
  page,
  request,
}) => {
  const auth = await account(request);
  await page.goto("/orders");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập để xem đơn hàng" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Đơn hàng", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("main")
    .getByRole("link", { name: "Đăng nhập", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(auth.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(
    page.getByRole("heading", { name: "Bạn chưa có đơn hàng nào" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link", { name: "Đơn hàng", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await fits(page);
});

test("all statuses, timeout reason, filters and payment links; no reorder action", async ({
  page,
  context,
  request,
}) => {
  await authenticate(context, await account(request));
  const orders = (
    [
      "PENDING",
      "PAID",
      "PAYMENT_FAILED",
      "PREPARING",
      "READY",
      "COMPLETED",
      "CANCELLED",
    ] as const
  ).map((status, index) => order(status, index));
  await mockOrders(page, orders);
  await page.goto("/orders");
  await expect(page.getByRole("article")).toHaveCount(7);
  await fits(page);
  await expect(
    page.getByText("Đã hủy — quá hạn thanh toán", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Thanh toán", exact: true }),
  ).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Đặt lại/ })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Thất bại / Đã hủy", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByRole("button", { name: "Hoàn tất", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await fits(page);
});

test("history loading, network error, retry and logout never expose stale orders", async ({
  page,
  context,
  request,
}) => {
  await authenticate(context, await account(request));
  let fail = true;
  await page.route(`${api}/orders/me`, async (route) => {
    if (fail) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return route.fulfill({ status: 503, body: "{}" });
    }
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([order("PAID")]),
    });
  });
  await page.goto("/orders");
  await expect(page.getByRole("status")).toContainText("Đang tải đơn hàng");
  await expect(
    page.getByRole("heading", { name: "Chưa tải được đơn hàng" }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đăng nhập để xem đơn hàng" }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("expired sessions are cleared and missing/foreign order details stay private", async ({
  page,
  context,
  request,
}) => {
  await authenticate(context, await account(request));
  await page.route(`${api}/orders/me`, (route) =>
    route.fulfill({ status: 401, body: "{}" }),
  );
  await page.goto("/orders");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập để xem đơn hàng" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("brewlite_token")),
  ).toBeNull();
  await page.unroute(`${api}/orders/me`);
  const auth = await account(request);
  await page.evaluate((data) => {
    localStorage.setItem("brewlite_token", data.access_token);
    localStorage.setItem("brewlite_user", JSON.stringify(data.user));
  }, auth);
  await page.goto("/orders/ORD-missing");
  await expect(
    page.getByRole("heading", { name: "Không tìm thấy đơn hàng" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Đặt hàng thành công!" }),
  ).toHaveCount(0);
});

test("only PAID can show confirmation; pending, failed, cancelled and completed use detail", async ({
  page,
  context,
  request,
}) => {
  await authenticate(context, await account(request));
  const orders = (
    [
      "PAID",
      "PENDING",
      "PAYMENT_FAILED",
      "CANCELLED",
      "PREPARING",
      "READY",
      "COMPLETED",
    ] as const
  ).map((status) => order(status));
  await mockOrders(page, orders);
  await page.goto("/orders/ORD-PAID-0/confirmation");
  await expect(
    page.getByRole("heading", { name: "Đặt hàng thành công!" }),
  ).toBeVisible();
  await expect(
    page.getByText("Mời tới quầy lấy nước.", { exact: true }),
  ).toBeVisible();
  for (const entry of orders.filter((entry) => entry.status !== "PAID")) {
    await page.goto(`/orders/${entry.id}/confirmation?status=SUCCESS`);
    await expect(page).toHaveURL(new RegExp(`/orders/${entry.id}$`));
    await expect(
      page.getByRole("heading", { name: "Chi tiết đơn hàng", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Đặt hàng thành công!" }),
    ).toHaveCount(0);
  }
  await fits(page);
});

test("checkout recovers from API without local snapshot and uses backend time despite browser skew", async ({
  page,
  context,
  request,
}) => {
  await authenticate(context, await account(request));
  const pending = order("PENDING");
  await mockOrders(page, [pending]);
  await page.clock.setFixedTime(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
  await page.goto(`/checkout/${pending.id}`);
  await expect(
    page.getByRole("heading", { name: "Chọn cách thanh toán" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    /Vui lòng thanh toán trong 0[34]:/,
  );
  await expect(page.getByRole("button", { name: /^Thanh toán/ })).toBeEnabled();
  await fits(page);
});

test("expired orders cannot pay in history or direct checkout", async ({
  page,
  context,
  request,
}) => {
  await authenticate(context, await account(request));
  const pending = order("PENDING", 0, -1000);
  await mockOrders(page, [pending]);
  await page.goto("/orders");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Thanh toán", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/checkout/${pending.id}`);
  await expect(page.getByRole("status")).toContainText("Đơn đã hết hạn");
  await expect(page.getByRole("button", { name: /^Thanh toán/ })).toHaveCount(
    0,
  );
});

async function createFromCart(page: Page) {
  await page.goto("/products/1");
  await page.getByRole("button", { name: /^Thêm vào giỏ hàng/ }).click();
  await page.goto("/cart");
  await page.getByRole("button", { name: /^Đặt hàng/ }).click();
  await expect(page).toHaveURL(/\/checkout\/ORD-/);
  return decodeURIComponent(new URL(page.url()).pathname.split("/").at(-1)!);
}

test("live wallet QR on a second device leads to own PAID confirmation and history", async ({
  page,
  context,
  browser,
  request,
}) => {
  const auth = await account(request);
  await authenticate(context, auth);
  const id = await createFromCart(page);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("brewlite-cart")!).state.items.length,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: /^Thanh toán/ }).click();
  await expect(page).toHaveURL(/\/pay\/PAY-/);
  await expect(
    page.getByRole("img", { name: `Mã QR đơn hàng ${id}` }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tôi đã chuyển tiền", exact: true })
    .click();
  await expect(
    page.getByText("Đang chờ nhân viên xác nhận…", { exact: true }),
  ).toBeVisible();
  const pending = await (
    await request.get(`${api}/orders/${id}`, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    })
  ).json();
  expect(pending.status).toBe("PENDING");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("brewlite-cart")!).state.items.length,
    ),
  ).toBe(1);
  await reviewAsStaff(browser, request, id);
  await expect(page).toHaveURL(new RegExp(`/orders/${id}/confirmation$`));
  await expect(
    page.getByRole("heading", { name: "Đặt hàng thành công!" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("brewlite-cart")!).state.items.length,
    ),
  ).toBe(0);
  await page.getByRole("link", { name: /Lịch sử đơn hàng/ }).click();
  await expect(page.getByRole("article").filter({ hasText: id })).toContainText(
    "Đã thanh toán",
  );
  await fits(page);
});

test("live card failure preserves cart and retries the same order with the same deadline", async ({
  page,
  context,
  request,
  browser,
}) => {
  const auth = await account(request);
  await authenticate(context, auth);
  const id = await createFromCart(page);
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const original = await (
    await request.get(`${api}/orders/${id}`, { headers })
  ).json();
  await page.getByRole("radio", { name: /Thẻ/ }).check();
  await page.getByRole("button", { name: /^Thanh toán/ }).click();
  await expect(
    page.getByRole("heading", { name: "Thanh toán thẻ tại quầy" }),
  ).toBeVisible();
  await reviewAsStaff(browser, request, id, "reject");
  await expect(
    page.getByRole("heading", { name: "Thanh toán thất bại", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("brewlite-cart")!).state.items.length,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/checkout/${id}$`));
  await page.getByRole("radio", { name: /Thẻ/ }).check();
  await page.getByRole("button", { name: /^Thanh toán/ }).click();
  await expect(page).toHaveURL(/\/pay\/PAY-/);
  await reviewAsStaff(browser, request, id);
  await expect(page).toHaveURL(new RegExp(`/orders/${id}/confirmation$`));
  const current = await (
    await request.get(`${api}/orders/${id}`, { headers })
  ).json();
  expect(current.expiresAt).toBe(original.expiresAt);
  expect(current.status).toBe("PAID");
  expect(
    await (await request.get(`${api}/orders/me`, { headers })).json(),
  ).toHaveLength(1);
  await fits(page);
});

test("a reserved cart resumes its own order even when remaining availability is zero", async ({
  page,
  context,
  request,
}) => {
  const auth = await account(request);
  await authenticate(context, auth);
  const id = await createFromCart(page);
  await page.route(`${api}/products/availability`, async (route) => {
    const response = await route.fetch();
    const result = await response.json();
    await route.fulfill({
      json: {
        ...result,
        available: false,
        items: result.items.map((item: Record<string, unknown>) => ({
          ...item,
          stock: 0,
        })),
      },
    });
  });
  await page.goto("/cart");
  await page
    .getByRole("button", { name: "Tiếp tục đơn hàng", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/checkout/${id}$`));
  const response = await request.get(`${api}/orders/me`, {
    headers: { Authorization: `Bearer ${auth.access_token}` },
  });
  expect(await response.json()).toHaveLength(1);
});

test("paying an earlier order preserves a newer different cart", async ({
  page,
  context,
  request,
  browser,
}) => {
  await authenticate(context, await account(request));
  const id = await createFromCart(page);
  await page.getByRole("button", { name: /^Thanh toán/ }).click();
  await expect(page).toHaveURL(/\/pay\/PAY-/);
  const paymentUrl = page.url();
  await page.goto("/products/2");
  await page.getByRole("button", { name: /^Thêm vào giỏ hàng/ }).click();
  const before = await page.evaluate(() =>
    localStorage.getItem("brewlite-cart"),
  );
  await page.goto(paymentUrl);
  await page
    .getByRole("button", { name: "Tôi đã chuyển tiền", exact: true })
    .click();
  await reviewAsStaff(browser, request, id);
  await expect(page).toHaveURL(new RegExp(`/orders/${id}/confirmation$`));
  expect(await page.evaluate(() => localStorage.getItem("brewlite-cart"))).toBe(
    before,
  );
});

test("reported payment resumes safely with a skewed browser clock; customer has no admin access and logout hides payment", async ({
  page,
  context,
  request,
}) => {
  await authenticate(context, await account(request));
  const id = await createFromCart(page);
  await page.getByRole("button", { name: /^Thanh toán/ }).click();
  await expect(page).toHaveURL(/\/pay\/PAY-/);
  const paymentUrl = page.url();
  await page.clock.setFixedTime(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
  await page.reload();
  await expect(page.getByRole("status")).toContainText(
    /Thời gian còn lại: 1[34]:/,
  );
  await page
    .getByRole("button", { name: "Tôi đã chuyển tiền", exact: true })
    .click();
  await expect(
    page.getByText("Đang chờ nhân viên xác nhận…", { exact: true }),
  ).toBeVisible();
  await page.goto(`/checkout/${id}`);
  await page.getByRole("button", { name: /^Thanh toán/ }).click();
  await expect(page).toHaveURL(paymentUrl);
  await expect(
    page.getByText("Đang chờ nhân viên xác nhận…", { exact: true }),
  ).toBeVisible();
  await page.goto("/admin/payments");
  await expect(
    page.getByRole("heading", { name: "Không có quyền truy cập" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Xác nhận đã nhận tiền" }),
  ).toHaveCount(0);
  await page.goto(paymentUrl);
  await expect(
    page.getByText("Đang chờ nhân viên xác nhận…", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Đăng nhập lại", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText(id);
});
