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
    : { email: `${randomUUID()}@prep-ui.test`, password: "PreparationUi123" };
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
    if (sessionStorage.getItem("prep-initialized")) return;
    sessionStorage.setItem("prep-initialized", "true");
    localStorage.setItem("brewlite_token", data.access_token);
    localStorage.setItem("brewlite_user", JSON.stringify(data.user));
  }, auth);
}
async function paidOrder(
  request: APIRequestContext,
  customer: AuthResponse,
  staff: AuthResponse,
) {
  const response = await request.post(`${api}/orders`, {
    headers: {
      Authorization: `Bearer ${customer.access_token}`,
      "Idempotency-Key": randomUUID(),
    },
    data: {
      items: [{ productId: "1", size: "M", toppingIds: ["cream"], qty: 2 }],
      voucherCode: "UI10K",
    },
  });
  expect(response.ok()).toBe(true);
  const created = await response.json();
  const payment = await request.post(`${api}/payments`, {
    headers: {
      Authorization: `Bearer ${customer.access_token}`,
      "Idempotency-Key": randomUUID(),
    },
    data: { orderId: created.orderId, method: "CARD" },
  });
  expect(payment.ok()).toBe(true);
  expect(
    (
      await request.post(
        `${api}/admin/payments/${(await payment.json()).paymentId}/confirm`,
        {
          headers: { Authorization: `Bearer ${staff.access_token}` },
          data: {},
        },
      )
    ).ok(),
  ).toBe(true);
  return { id: created.orderId as string, total: created.total as number };
}
async function fits(page: Page, name: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath(name),
    fullPage: false,
  });
}

test("staff advance every stage; customers see READY once and completion stays in history", async ({
  page,
  context,
  browser,
  request,
}) => {
  const customer = await login(request);
  const staffAuth = await login(request, true);
  const order = await paidOrder(request, customer, staffAuth);
  await authenticate(context, customer);
  await page.goto(`/orders/${order.id}`);
  const staff = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 390, height: 844 },
  });
  try {
    await authenticate(staff, staffAuth);
    const board = await staff.newPage();
    board.on("dialog", (dialog) => dialog.accept());
    await board.goto("/admin/orders");
    const prep = board.getByRole("region", {
      name: "Bảng pha chế",
      exact: true,
    });
    const card = prep.getByRole("article", {
      name: `Đơn ${order.id}`,
      exact: true,
    });
    await expect(card).toContainText("Size M");
    await expect(card).toContainText("2 × Cà phê sữa");
    await expect(
      prep
        .getByRole("region", { name: "Chờ pha", exact: true })
        .getByRole("article", { name: `Đơn ${order.id}`, exact: true }),
    ).toBeVisible();
    await card
      .getByRole("button", { name: "Bắt đầu pha", exact: true })
      .click();
    await expect(
      card.getByRole("button", { name: "Pha xong", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Tiến trình đơn hàng").locator('[aria-current="step"]'),
    ).toContainText("Đang pha chế");
    await expect(
      page.getByRole("button", { name: "Yêu cầu hủy đơn", exact: true }),
    ).toHaveCount(0);
    await card.getByRole("button", { name: "Pha xong", exact: true }).click();
    await expect(
      card.getByRole("button", { name: "Khách đã nhận", exact: true }),
    ).toBeVisible();
    const notice = page.getByRole("region", {
      name: "Thông báo nhận món",
      exact: true,
    });
    await expect(notice).toContainText("Đồ uống đã sẵn sàng, mời bạn ra quầy.");
    await card.scrollIntoViewIfNeeded();
    await fits(board, "preparation-ready-board.png");
    await notice.scrollIntoViewIfNeeded();
    await fits(page, "customer-ready-notice.png");
    await page.getByRole("button", { name: "Đóng thông báo nhận món" }).click();
    await page.reload();
    await expect(
      page.getByLabel("Tiến trình đơn hàng").locator('[aria-current="step"]'),
    ).toContainText("Sẵn sàng nhận");
    await expect(notice).toHaveCount(0);
    await card
      .getByRole("button", { name: "Khách đã nhận", exact: true })
      .click();
    await expect(card).toHaveCount(0);
    await expect(
      page.getByLabel("Tiến trình đơn hàng").locator('[aria-current="step"]'),
    ).toContainText("Hoàn tất");
    await expect(page.getByLabel("Điểm thưởng của đơn")).toContainText(
      `Đã cộng ${Math.floor(order.total / 10000)} điểm`,
    );
    await page.goto("/orders");
    await page.getByRole("button", { name: "Hoàn tất", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: order.id, exact: true }),
    ).toBeVisible();
    await fits(page, "completed-order-history.png");
  } finally {
    await staff.close();
  }
});

test("a PAID cancellation blocks starting preparation until staff reject the request", async ({
  page,
  context,
  browser,
  request,
}) => {
  const customer = await login(request);
  const staffAuth = await login(request, true);
  const order = await paidOrder(request, customer, staffAuth);
  await authenticate(context, customer);
  await page.goto(`/orders/${order.id}`);
  await page
    .getByRole("button", { name: "Yêu cầu hủy đơn", exact: true })
    .click();
  await page
    .getByLabel("Lý do hủy", { exact: true })
    .fill("Chờ đối chiếu với khách");
  await page
    .getByRole("button", { name: "Gửi yêu cầu hủy", exact: true })
    .click();
  await expect(
    page.getByText("Đang chờ nhân viên duyệt hủy.", { exact: false }),
  ).toBeVisible();
  const staff = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 390, height: 844 },
  });
  try {
    await authenticate(staff, staffAuth);
    const board = await staff.newPage();
    board.on("dialog", (dialog) => dialog.accept());
    await board.goto("/admin/orders");
    const prep = board
      .getByRole("region", { name: "Bảng pha chế", exact: true })
      .getByRole("article", { name: `Đơn ${order.id}`, exact: true });
    await expect(
      prep.getByRole("button", { name: "Bắt đầu pha", exact: true }),
    ).toBeDisabled();
    const blocked = await request.patch(
      `${api}/admin/orders/${order.id}/status`,
      {
        headers: { Authorization: `Bearer ${staffAuth.access_token}` },
        data: { status: "PREPARING" },
      },
    );
    expect(blocked.status()).toBe(409);
    const cancel = board
      .getByRole("region", { name: "Yêu cầu hủy đơn", exact: true })
      .getByRole("article")
      .filter({
        has: board.getByRole("heading", { name: order.id, exact: true }),
      });
    await cancel
      .getByLabel("Ghi chú xử lý / lý do từ chối")
      .fill("Khách đồng ý tiếp tục nhận món");
    await cancel
      .getByRole("button", { name: "Từ chối hủy", exact: true })
      .click();
    await expect(cancel).toHaveCount(0);
    await expect(
      prep.getByRole("button", { name: "Bắt đầu pha", exact: true }),
    ).toBeEnabled();
    await prep
      .getByRole("button", { name: "Bắt đầu pha", exact: true })
      .click();
    await expect(
      page.getByLabel("Tiến trình đơn hàng").locator('[aria-current="step"]'),
    ).toContainText("Đang pha chế");
    await fits(board, "preparation-after-review.png");
  } finally {
    await staff.close();
  }
});

test("failed board loads and status changes can be retried without moving the order early", async ({
  page,
  context,
  request,
}) => {
  const customer = await login(request);
  const staffAuth = await login(request, true);
  const order = await paidOrder(request, customer, staffAuth);
  await authenticate(context, staffAuth);
  let failList = true;
  await page.route("**/admin/orders?status=*", async (route) => {
    if (failList) {
      failList = false;
      await route.fulfill({
        status: 503,
        json: { message: "Chưa tải được bảng pha chế." },
      });
    } else await route.continue();
  });
  let failAction = true;
  await page.route(`**/admin/orders/${order.id}/status`, async (route) => {
    if (failAction) {
      failAction = false;
      await route.fulfill({
        status: 503,
        json: { message: "Chưa cập nhật được tiến trình." },
      });
    } else await route.continue();
  });
  await page.goto("/admin/orders");
  const prep = page.getByRole("region", { name: "Bảng pha chế", exact: true });
  await expect(prep.getByRole("alert")).toContainText(
    "Chưa tải được bảng pha chế.",
  );
  await prep
    .getByRole("button", { name: "Cập nhật bảng pha chế", exact: true })
    .click();
  const card = prep.getByRole("article", {
    name: `Đơn ${order.id}`,
    exact: true,
  });
  await card.getByRole("button", { name: "Bắt đầu pha", exact: true }).click();
  await expect(card.getByRole("alert")).toContainText(
    "Chưa cập nhật được tiến trình.",
  );
  await expect(
    card.getByRole("button", { name: "Bắt đầu pha", exact: true }),
  ).toBeEnabled();
  await card.getByRole("button", { name: "Bắt đầu pha", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Pha xong", exact: true }),
  ).toBeVisible();
  await fits(page, "preparation-retry.png");
});

test("late responses from another login cannot announce a foreign READY order", async ({
  page,
  context,
  request,
}) => {
  const first = await login(request);
  const next = await login(request);
  const staff = await login(request, true);
  const order = await paidOrder(request, first, staff);
  for (const status of ["PREPARING", "READY"])
    expect(
      (
        await request.patch(`${api}/admin/orders/${order.id}/status`, {
          headers: { Authorization: `Bearer ${staff.access_token}` },
          data: { status },
        })
      ).ok(),
    ).toBe(true);
  const oldResponse = await request.get(`${api}/orders/me`, {
    headers: { Authorization: `Bearer ${first.access_token}` },
  });
  const oldOrders: unknown = await oldResponse.json();
  await authenticate(context, first);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/orders/me", async (route) => {
    if (
      route.request().headers().authorization === `Bearer ${first.access_token}`
    ) {
      started();
      await gate;
      await route
        .fulfill({ status: 200, json: oldOrders })
        .catch(() => undefined);
    } else await route.continue();
  });
  await page.goto("/orders");
  await pending;
  await page.evaluate((auth) => {
    localStorage.setItem("brewlite_token", auth.access_token);
    localStorage.setItem("brewlite_user", JSON.stringify(auth.user));
    window.dispatchEvent(
      new StorageEvent("storage", { key: "brewlite_token" }),
    );
  }, next);
  release();
  await expect(
    page.getByRole("heading", {
      name: "Bạn chưa có đơn hàng nào",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Thông báo nhận món" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Đăng xuất", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("brewlite_token")),
  ).toBe(next.access_token);
});
