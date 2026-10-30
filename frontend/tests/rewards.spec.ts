import {
  test,
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { AuthResponse } from "../src/lib/auth";
import type { Order } from "../src/types/order";

const api = "http://127.0.0.1:3201";
async function account(request: APIRequestContext): Promise<AuthResponse> {
  const data = {
    email: `${randomUUID()}@rewards-ui.test`,
    password: "RewardsUiTest123",
  };
  expect((await request.post(`${api}/auth/register`, { data })).ok()).toBe(
    true,
  );
  const response = await request.post(`${api}/auth/login`, { data });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<AuthResponse>;
}
async function prepare(context: BrowserContext, auth: AuthResponse) {
  await context.addInitScript((data) => {
    if (!sessionStorage.getItem("rewards-ui-initialized")) {
      sessionStorage.setItem("rewards-ui-initialized", "true");
      localStorage.setItem("brewlite_token", data.access_token);
      localStorage.setItem("brewlite_user", JSON.stringify(data.user));
    }
    if (!localStorage.getItem("brewlite-cart"))
      localStorage.setItem(
        "brewlite-cart",
        JSON.stringify({
          version: 1,
          state: {
            voucherCode: "",
            items: [
              {
                productId: "1",
                name: "Cà phê sữa",
                imageUrl: "/images/coffee.jpg",
                size: "S",
                toppingIds: [],
                qty: 1,
                unitPrice: 35000,
              },
            ],
          },
        }),
      );
  }, auth);
}
async function reserve(request: APIRequestContext, auth: AuthResponse) {
  const response = await request.post(`${api}/orders`, {
    headers: { Authorization: `Bearer ${auth.access_token}` },
    data: {
      items: [{ productId: "1", size: "S", toppingIds: [], qty: 1 }],
      voucherCode: "UI10K",
    },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).orderId as string;
}
async function pay(
  request: APIRequestContext,
  auth: AuthResponse,
  id: string,
  adminToken: string,
) {
  const response = await request.post(`${api}/payments`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      "Idempotency-Key": randomUUID(),
    },
    data: { orderId: id, method: "CARD" },
  });
  expect(response.ok()).toBe(true);
  const payment = await response.json();
  expect(
    (
      await request.post(`${api}/admin/payments/${payment.paymentId}/confirm`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {},
      })
    ).ok(),
  ).toBe(true);
}
async function picker(page: Page) {
  await page.goto("/cart");
  await page
    .getByRole("button", { name: "Chọn hoặc nhập mã", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Chọn ưu đãi BrewLite" });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function fits(page: Page, name: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath(`${name}.png`),
    fullPage: false,
  });
}

test("shows available and held uses, disables held-out vouchers and refreshes after an unpaid cancellation", async ({
  page,
  context,
  request,
}) => {
  const auth = await account(request);
  await prepare(context, auth);
  const dialog = await picker(page);
  const ticket = dialog.locator("label").filter({ hasText: "UI10K" });
  await expect(ticket).toContainText("Còn 3 lượt");
  await expect(ticket.getByText("x3", { exact: true })).toBeVisible();
  const first = await reserve(request, auth);
  await expect(ticket).toContainText("Còn 2 lượt");
  await expect(ticket.getByText("x2", { exact: true })).toBeVisible();
  await expect(ticket).toContainText("1 lượt đang giữ");
  await reserve(request, auth);
  await expect(ticket).toContainText("Còn 1 lượt");
  await expect(ticket.getByText(/^x\d+$/)).toHaveCount(0);
  await reserve(request, auth);
  await expect(ticket).toContainText("Còn 0 lượt");
  await expect(ticket.getByText(/^x\d+$/)).toHaveCount(0);
  await expect(ticket).toContainText("3 lượt đang giữ");
  await expect(ticket.getByRole("radio")).toBeDisabled();
  await fits(page, "voucher-all-held");
  expect(
    (
      await request.post(`${api}/orders/${first}/cancel`, {
        headers: { Authorization: `Bearer ${auth.access_token}` },
      })
    ).ok(),
  ).toBe(true);
  await expect(ticket).toContainText("Còn 1 lượt");
  await expect(ticket.getByText(/^x\d+$/)).toHaveCount(0);
  await expect(ticket).toContainText("2 lượt đang giữ");
  await expect(ticket.getByRole("radio")).toBeEnabled();
  await fits(page, "voucher-use-restored");
});

test("hides fully consumed vouchers and shows persisted earned points in the header and order history", async ({
  page,
  context,
  request,
}) => {
  const auth = await account(request);
  await prepare(context, auth);
  const dialog = await picker(page);
  await expect(
    dialog.locator("label").filter({ hasText: "UI10K" }),
  ).toContainText("Còn 3 lượt");
  const admin = await (
    await request.post(`${api}/auth/login`, {
      data: { email: "staff@task9-ui.test", password: "StaffUiTest123" },
    })
  ).json();
  const ids: string[] = [];
  for (let index = 0; index < 3; index++) {
    const id = await reserve(request, auth);
    ids.push(id);
    await pay(request, auth, id, admin.access_token);
  }
  await expect(dialog.getByText("UI10K", { exact: true })).toHaveCount(0);
  await dialog.getByLabel("Nhập mã giảm giá").fill("UI10K");
  await dialog.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("dùng hết");
  await fits(page, "voucher-consumed");
  await page.keyboard.press("Escape");
  await page.goto("/orders");
  await expect(page.getByLabel("Số dư điểm thưởng")).toContainText("6 điểm");
  for (const id of ids)
    await expect(
      page.getByRole("article").filter({ hasText: id }),
    ).toContainText("Đã cộng 2 điểm");
  await page
    .getByRole("article")
    .filter({ hasText: ids[0] })
    .getByRole("link", { name: "Xem chi tiết", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/orders/${ids[0]}$`));
  await expect(
    page.getByRole("heading", { name: "Chi tiết đơn hàng", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Điểm thưởng của đơn")).toContainText(
    "Đã cộng 2 điểm",
  );
  await expect(
    page.getByRole("region", { name: "Tổng kết thanh toán" }),
  ).toContainText("Voucher UI10K");
  await fits(page, "order-earned-points");
});

function rewardOrder(cancelled = false, zero = false): Order {
  const now = new Date().toISOString();
  return {
    canCancelImmediately: false,
    canRequestCancellation: false,
    cancelRequest: null,
    id: "ORD-REWARDS-UI",
    status: cancelled ? "CANCELLED" : "PAID",
    subtotal: 105000,
    discount: zero ? 100000 : 30000,
    total: zero ? 5000 : 75000,
    voucherCode: "UI10K",
    voucherTitle: "Snapshot fixture",
    createdAt: now,
    expiresAt: now,
    cancelledAt: cancelled ? now : null,
    cancelReason: cancelled ? "USER_CANCELLED" : null,
    paymentMethod: "CARD",
    serverTime: now,
    canPay: false,
    benefitsPolicyVersion: 1,
    pointsEarned: cancelled || zero ? 0 : 7,
    pointsReversed: cancelled ? 7 : 0,
    pointsAwardedAt: now,
    pointsReversedAt: cancelled ? now : null,
    items: [
      {
        id: "reward-item",
        productId: "1",
        name: "Cà phê sữa",
        imageUrl: "/images/coffee.jpg",
        size: "S",
        toppingIds: [],
        qty: 3,
        unitPrice: 35000,
        lineTotal: 105000,
      },
    ],
  };
}

test("refreshes the profile after a paid cancellation and preserves the price and reversed-point audit", async ({
  page,
  context,
  request,
}) => {
  const auth = await account(request);
  await prepare(context, auth);
  let cancelled = false;
  await page.route(`${api}/auth/me`, (route) =>
    route.fulfill({ json: { ...auth.user, loyaltyPoints: cancelled ? 0 : 7 } }),
  );
  await page.route(`${api}/orders/**`, (route) =>
    route.fulfill({
      json: route.request().url().endsWith("/me")
        ? [rewardOrder(cancelled)]
        : rewardOrder(cancelled),
    }),
  );
  await page.goto("/orders/ORD-REWARDS-UI");
  await expect(page.getByLabel("Số dư điểm thưởng")).toContainText("7 điểm");
  await expect(page.getByLabel("Điểm thưởng của đơn")).toContainText(
    "Đã cộng 7 điểm",
  );
  cancelled = true;
  await page
    .getByRole("button", { name: "Cập nhật trạng thái", exact: true })
    .click();
  await expect(page.getByLabel("Điểm thưởng của đơn")).toContainText(
    "Đã thu hồi 7 điểm",
  );
  await expect(page.getByLabel("Số dư điểm thưởng")).toContainText("0 điểm");
  await expect(
    page.getByRole("region", { name: "Tổng kết thanh toán" }),
  ).toContainText(/75[.,]000/);
  await page.getByLabel("Điểm thưởng của đơn").scrollIntoViewIfNeeded();
  await fits(page, "reversed-points");
  await page.goto("/orders");
  await expect(page.getByRole("article")).toContainText("Đã thu hồi 7 điểm");
});

test("shows a settled zero-point order without inventing rewards and rejects incomplete benefit data", async ({
  page,
  context,
  request,
}) => {
  const auth = await account(request);
  await prepare(context, auth);
  let broken = false;
  await page.route(`${api}/orders/ORD-REWARDS-UI`, (route) =>
    route.fulfill({
      json: {
        ...rewardOrder(false, true),
        ...(broken ? { pointsEarned: 7, pointsAwardedAt: null } : {}),
      },
    }),
  );
  await page.goto("/orders/ORD-REWARDS-UI");
  await expect(page.getByLabel("Điểm thưởng của đơn")).toContainText(
    "Đã cộng 0 điểm",
  );
  broken = true;
  await page
    .getByRole("button", { name: "Cập nhật trạng thái", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Dữ liệu đơn hàng chưa hợp lệ",
  );
  await expect(page.getByLabel("Điểm thưởng của đơn")).toHaveCount(0);
});

test("keeps the session on profile/network failures and rejects malformed voucher counts", async ({
  page,
  context,
  request,
}) => {
  const auth = await account(request);
  await prepare(context, auth);
  let badProfile = true,
    badQuota = true;
  await page.route(`${api}/auth/me`, (route) =>
    route.fulfill(
      badProfile
        ? { status: 503, json: { message: "Offline" } }
        : { json: auth.user },
    ),
  );
  await page.route(`${api}/vouchers/quote`, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    if (badQuota && data.vouchers?.[0]?.usage)
      data.vouchers[0].usage.availableUses = -1;
    await route.fulfill({ response, json: data });
  });
  const dialog = await picker(page);
  await expect(dialog.getByRole("alert")).toContainText(
    "Dữ liệu ưu đãi chưa hợp lệ",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("brewlite_token")),
  ).toBe(auth.access_token);
  await expect(page.getByLabel("Thử cập nhật điểm")).toBeAttached();
  badQuota = false;
  await dialog.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(
    dialog.locator("label").filter({ hasText: "UI10K" }),
  ).toContainText("Còn 3 lượt");
  await page.keyboard.press("Escape");
  badProfile = false;
  await page.getByLabel("Thử cập nhật điểm").click();
  await expect(page.getByLabel("Thử cập nhật điểm")).toHaveCount(0);
});

test("isolates accounts during voucher checks and ignores a late 401 from the previous session", async ({
  page,
  context,
  request,
}) => {
  const first = await account(request),
    second = await account(request);
  await prepare(context, first);
  await reserve(request, first);
  await reserve(request, first);
  await reserve(request, first);
  let release: () => void = () => {};
  let started: () => void = () => {};
  let finished: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  const done = new Promise<void>((resolve) => {
    finished = resolve;
  });
  await page.route(`${api}/vouchers/quote`, async (route) => {
    const body = route.request().postDataJSON() as { voucherCode?: string };
    if (
      route.request().headers().authorization ===
        `Bearer ${first.access_token}` &&
      body.voucherCode === "UIPRIVATE"
    ) {
      started();
      await hold;
      await route
        .fulfill({ status: 401, json: { message: "Old session expired" } })
        .catch(() => {});
      finished();
      return;
    }
    await route.continue();
  });
  const dialog = await picker(page);
  await expect(
    dialog.locator("label").filter({ hasText: "UI10K" }),
  ).toContainText("3 lượt đang giữ");
  await dialog.getByLabel("Nhập mã giảm giá").fill("UIPRIVATE");
  await dialog.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await pending;
  await page.evaluate((auth) => {
    localStorage.setItem("brewlite_token", auth.access_token);
    localStorage.setItem("brewlite_user", JSON.stringify(auth.user));
    window.dispatchEvent(new Event("storage"));
  }, second);
  await expect(
    dialog.locator("label").filter({ hasText: "UI10K" }),
  ).toContainText("Còn 3 lượt");
  release();
  await done;
  expect(
    await page.evaluate(() => localStorage.getItem("brewlite_token")),
  ).toBe(second.access_token);
  await expect(
    page.getByText(second.user.email, { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() => {
    localStorage.removeItem("brewlite_token");
    localStorage.removeItem("brewlite_user");
    window.dispatchEvent(new Event("storage"));
  });
  await expect(
    dialog.getByText("Đăng nhập để xem số lượt voucher của bạn."),
  ).toBeVisible();
  await expect(dialog.getByText(/^Còn \d+ lượt$/)).toHaveCount(0);
});
