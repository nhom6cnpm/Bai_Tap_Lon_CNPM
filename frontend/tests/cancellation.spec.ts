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
const item = { productId: "1", size: "S", toppingIds: [], qty: 1 };
async function account(
  request: APIRequestContext,
  admin = false,
): Promise<AuthResponse> {
  const data = admin
    ? { email: "staff@task9-ui.test", password: "StaffUiTest123" }
    : { email: `${randomUUID()}@cancel-ui.test`, password: "Cancellation123" };
  if (!admin)
    expect((await request.post(`${api}/auth/register`, { data })).ok()).toBe(
      true,
    );
  const response = await request.post(`${api}/auth/login`, { data });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<AuthResponse>;
}
async function authenticate(context: BrowserContext, auth: AuthResponse) {
  await context.addInitScript((value) => {
    if (sessionStorage.getItem("cancellation-initialized")) return;
    sessionStorage.setItem("cancellation-initialized", "true");
    localStorage.setItem("brewlite_token", value.access_token);
    localStorage.setItem("brewlite_user", JSON.stringify(value.user));
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
async function order(
  request: APIRequestContext,
  auth: AuthResponse,
  payment = false,
  reported = false,
) {
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const response = await request.post(`${api}/orders`, {
    headers: { ...headers, "Idempotency-Key": randomUUID() },
    data: { items: [item], voucherCode: "UI10K" },
  });
  expect(response.ok()).toBe(true);
  const id = (await response.json()).orderId as string;
  let paymentId = "";
  if (payment) {
    const opened = await request.post(`${api}/payments`, {
      headers: { ...headers, "Idempotency-Key": randomUUID() },
      data: { orderId: id, method: "WALLET" },
    });
    expect(opened.ok()).toBe(true);
    paymentId = (await opened.json()).paymentId;
    if (reported)
      expect(
        // Ngân hàng giả lập: money arrives, staff must decide
        (
          await request.post(`${api}/mock-bank/payments/${paymentId}/transfer`)
        ).ok(),
      ).toBe(true);
  }
  return { id, paymentId };
}
async function sendRequest(page: Page, reason: string) {
  await page
    .getByRole("button", { name: "Yêu cầu hủy đơn", exact: true })
    .click();
  await page.getByLabel("Lý do hủy", { exact: true }).fill(reason);
  await page
    .getByRole("button", { name: "Gửi yêu cầu hủy", exact: true })
    .click();
  await expect(
    page.getByText("Đang chờ nhân viên duyệt hủy.", { exact: false }),
  ).toBeVisible();
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

test("cancels an unpaid checkout, returns voucher use and keeps the current cart", async ({
  page,
  context,
  request,
}) => {
  const auth = await account(request);
  await authenticate(context, auth);
  const created = await order(request, auth);
  await page.goto(`/checkout/${created.id}`);
  await page.getByRole("button", { name: "Hủy đơn hàng", exact: true }).click();
  await expect(
    page.getByText("Nếu bạn vừa chuyển tiền,", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận hủy", exact: true }).click();
  await expect(
    page.getByText("Đơn đã hết hạn hoặc đã bị hủy.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Thanh toán ·/ })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Về giỏ hàng", exact: true }).click();
  await expect(page.getByText("Cà phê sữa", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Chọn hoặc nhập mã", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .locator("label")
      .filter({ hasText: "UI10K" })
      .getByText("x3", { exact: true }),
  ).toBeVisible();
  await fits(page, "cancel-restored-voucher.png");
});

test("cancels an unreported QR payment and shows a closed order instead of a rejected payment", async ({
  page,
  context,
  request,
}) => {
  const auth = await account(request);
  await authenticate(context, auth);
  const created = await order(request, auth, true);
  await page.goto(`/pay/${created.paymentId}`);
  await page.getByRole("button", { name: "Hủy đơn hàng", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận hủy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đơn hàng đã hết hạn hoặc bị hủy" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Thanh toán thất bại" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Mở ngân hàng giả lập" }),
  ).toHaveCount(0);
  await fits(page, "cancel-qr.png");
});

test("staff see a reported cancellation, reject with a reason and approve the next request", async ({
  page,
  context,
  browser,
  request,
}) => {
  const auth = await account(request);
  const admin = await account(request, true);
  await authenticate(context, auth);
  const staff = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 390, height: 844 },
  });
  try {
    await authenticate(staff, admin);
    const board = await staff.newPage();
    board.on("dialog", (dialog) => dialog.accept());
    await board.goto("/admin/orders");
    await expect(
      board.getByRole("heading", { name: "Yêu cầu hủy đơn", exact: true }),
    ).toBeVisible();
    await expect(
      board.getByRole("button", { name: "Cập nhật danh sách", exact: true }),
    ).toBeEnabled();
    const created = await order(request, auth, true, true);
    await page.goto(`/pay/${created.paymentId}`);
    await sendRequest(page, "Khách cần đổi thời gian");
    await expect(board.getByText("Có 1 yêu cầu hủy mới.")).toBeVisible();
    const card = board
      .getByRole("region", { name: "Yêu cầu hủy đơn", exact: true })
      .getByRole("article")
      .filter({
        has: board.getByRole("heading", { name: created.id, exact: true }),
      });
    await expect(
      card.getByText("Lý do: Khách cần đổi thời gian"),
    ).toBeVisible();
    const payments = await staff.newPage();
    await payments.goto(`/admin/payments?orderId=${created.id}`);
    await expect(
      payments.getByRole("button", {
        name: "Xác nhận đã nhận tiền",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      payments.getByRole("button", { name: "Từ chối", exact: true }),
    ).toBeDisabled();
    await expect(
      card.getByRole("button", { name: "Từ chối hủy", exact: true }),
    ).toBeDisabled();
    await card
      .getByLabel("Ghi chú xử lý / lý do từ chối")
      .fill("Khách xác nhận tiếp tục nhận món");
    await card
      .getByRole("button", { name: "Từ chối hủy", exact: true })
      .click();
    await expect(card).toHaveCount(0);
    await expect(
      page.getByText("Yêu cầu hủy bị từ chối:", { exact: false }),
    ).toContainText("Khách xác nhận tiếp tục nhận món");
    await sendRequest(page, "Xin hủy lần nữa");
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Đồng ý hủy", exact: true }).click();
    await expect(card).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Đơn hàng đã hết hạn hoặc bị hủy" }),
    ).toBeVisible();
    await page.goto(`/orders/${created.id}`);
    await expect(
      page.getByText("Yêu cầu hủy đã được chấp nhận.", { exact: false }),
    ).toBeVisible();
    await fits(page, "cancel-approved.png");
  } finally {
    await staff.close();
  }
});

test("approved PAID cancellation reverses points while keeping price and successful payment history", async ({
  page,
  context,
  browser,
  request,
}) => {
  const auth = await account(request);
  const admin = await account(request, true);
  await authenticate(context, auth);
  const created = await order(request, auth, true);
  expect(
    (
      await request.post(`${api}/admin/payments/${created.paymentId}/confirm`, {
        headers: { Authorization: `Bearer ${admin.access_token}` },
        data: {},
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`/orders/${created.id}`);
  await expect(page.getByLabel("Số dư điểm thưởng")).toContainText("2 điểm");
  await expect(page.getByLabel("Điểm thưởng của đơn")).toContainText(
    "Đã cộng 2 điểm",
  );
  await sendRequest(page, "Không thể nhận món");
  const staff = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 390, height: 844 },
  });
  try {
    await authenticate(staff, admin);
    const board = await staff.newPage();
    board.on("dialog", (dialog) => dialog.accept());
    await board.goto("/admin/orders");
    const card = board
      .getByRole("region", { name: "Yêu cầu hủy đơn", exact: true })
      .getByRole("article")
      .filter({
        has: board.getByRole("heading", { name: created.id, exact: true }),
      });
    // Ngân hàng giả lập: approving refunds automatically, no money note needed
    await expect(
      card.getByText("hệ thống tự hoàn", { exact: false }),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Đồng ý hủy", exact: true }),
    ).toBeEnabled();
    await card
      .getByLabel("Ghi chú xử lý / lý do từ chối")
      .fill("Đã trao đổi cách xử lý tiền tại quầy");
    await fits(board, "staff-paid-cancellation.png");
    await card.getByRole("button", { name: "Đồng ý hủy", exact: true }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByLabel("Điểm thưởng của đơn")).toContainText(
      "Đã thu hồi 2 điểm",
    );
    await expect(page.getByLabel("Số dư điểm thưởng")).toContainText("0 điểm");
    await expect(page.getByText("25.000đ", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Đã hoàn 25.000đ về tài khoản", { exact: false }),
    ).toBeVisible();
    const payment = await request.get(`${api}/payments/${created.paymentId}`, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    });
    expect((await payment.json()).status).toBe("SUCCESS");
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("brewlite-cart")!).state.items.length,
      ),
    ).toBe(1);
    await page.getByLabel("Điểm thưởng của đơn").scrollIntoViewIfNeeded();
    await fits(page, "paid-cancel-points.png");
  } finally {
    await staff.close();
  }
});

test("a failed request can be retried and a customer cannot open the staff board", async ({
  page,
  context,
  request,
}) => {
  const auth = await account(request);
  await authenticate(context, auth);
  const created = await order(request, auth, true, true);
  let fail = true;
  await page.route(`**/orders/${created.id}/cancel-request`, async (route) => {
    if (fail) {
      fail = false;
      await route.fulfill({
        status: 503,
        json: { message: "Chưa gửi được yêu cầu, hãy thử lại." },
      });
    } else await route.continue();
  });
  await page.goto(`/orders/${created.id}`);
  await page
    .getByRole("button", { name: "Yêu cầu hủy đơn", exact: true })
    .click();
  await page
    .getByLabel("Lý do hủy", { exact: true })
    .fill("Lý do giữ lại khi lỗi");
  await page
    .getByRole("button", { name: "Gửi yêu cầu hủy", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Chưa gửi được yêu cầu" }),
  ).toContainText("Chưa gửi được yêu cầu");
  await expect(page.getByLabel("Lý do hủy", { exact: true })).toHaveValue(
    "Lý do giữ lại khi lỗi",
  );
  await page
    .getByRole("button", { name: "Gửi yêu cầu hủy", exact: true })
    .click();
  await expect(
    page.getByText("Đang chờ nhân viên duyệt hủy.", { exact: false }),
  ).toBeVisible();
  const pending = await request.get(`${api}/orders/${created.id}`, {
    headers: { Authorization: `Bearer ${auth.access_token}` },
  });
  const admin = await account(request, true);
  expect(
    (
      await request.post(`${api}/admin/orders/${created.id}/cancel`, {
        headers: { Authorization: `Bearer ${admin.access_token}` },
        data: { requestId: (await pending.json()).cancelRequest.id },
      })
    ).ok(),
  ).toBe(true);
  await page.goto("/admin/orders");
  await expect(
    page.getByRole("heading", { name: "Không có quyền truy cập" }),
  ).toBeVisible();
  await fits(page, "customer-no-staff-access.png");
});
