import { expect, test } from "@playwright/test";

test("logs in and reads seeded orders through the real API", async ({
  page,
}) => {
  test.skip(
    !process.env.TASK9_DEMO_PASSWORD,
    "Requires explicit local DB seed and demo password.",
  );
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("demo@brewlite.test");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.TASK9_DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(
    page.getByRole("heading", { name: "#DEMO-BL1042", exact: true }),
  ).toBeVisible();
  await page
    .locator("article.order-card")
    .filter({
      has: page.getByRole("heading", { name: "#DEMO-BL1042", exact: true }),
    })
    .getByRole("link", { name: "Xem đơn hàng" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Đặt hàng thành công!" }),
  ).toBeVisible();
  await expect(
    page.getByText("Mã đơn: #DEMO-BL1042", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Mã đơn: #DEMO-BL1042", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bạn đang xem dữ liệu mẫu")).toHaveCount(0);
});
