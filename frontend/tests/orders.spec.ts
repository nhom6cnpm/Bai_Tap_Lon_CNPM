import { expect, test } from "@playwright/test";

test("history filters orders, expands detail, and fits the viewport", async ({
  page,
}, testInfo) => {
  await page.goto("/demo/orders");
  await expect(
    page.getByRole("heading", { name: "Đơn hàng của bạn" }),
  ).toBeVisible();
  await expect(page.locator("article.order-card")).toHaveCount(4);
  await page.screenshot({
    path: `test-results/history-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Hoàn tất (2)" }).click();
  await expect(page.locator("article.order-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Đang thực hiện (1)" }).click();
  await expect(page.locator("article.order-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Xem chi tiết", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Chi tiết đơn & tiến trình nhận món" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Thu gọn" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("confirmation shows the correct order and total", async ({
  page,
}, testInfo) => {
  await page.goto("/demo/orders/bl1042/confirmation");
  await expect(
    page.getByRole("heading", { name: "Đặt hàng thành công!" }),
  ).toBeVisible();
  await expect(page.getByText("Mã đơn: #BL1042")).toBeVisible();
  await expect(page.getByText("159.000", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chi tiết đơn hàng", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/confirmation-${testInfo.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("failed payment never appears as a successful order", async ({ page }) => {
  await page.goto("/demo/orders/bl1010/confirmation");
  await expect(
    page.getByRole("heading", { name: "Thanh toán chưa thành công" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Đặt hàng thành công!" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sao chép mã nhận nước" }),
  ).toHaveCount(0);
});

test("preview exposes empty, loading and retry states", async ({ page }) => {
  await page.goto("/demo/orders?state=empty");
  await expect(
    page.getByRole("heading", { name: "Bạn chưa có đơn hàng nào" }),
  ).toBeVisible();
  await page.goto("/demo/orders?state=loading");
  await expect(
    page.getByRole("status", { name: "Đang tải đơn hàng" }),
  ).toBeVisible();
  await page.goto("/demo/orders?state=error");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Chưa tải được đơn hàng",
  );
  await page.getByRole("link", { name: "Thử lại" }).click();
  await expect(page.locator("article.order-card")).toHaveCount(4);
});

test("real history does not fall back to demo orders without login", async ({
  page,
}) => {
  await page.goto("/orders");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập để xem đơn hàng" }),
  ).toBeVisible();
  await expect(page.locator("article.order-card")).toHaveCount(0);
});

test("real history handles expired sessions and does not retain orders", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("brewlite.accessToken", "expired-test-token"),
  );
  await page.route("**/orders/me", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/orders");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập để xem đơn hàng" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("brewlite.accessToken")),
  ).toBeNull();
  await expect(page.locator("article.order-card")).toHaveCount(0);
});
