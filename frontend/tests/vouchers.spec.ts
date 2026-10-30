import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";

const api = "http://127.0.0.1:3201";
const password = "VoucherUiTest123";

async function account(request: APIRequestContext) {
  const email = `${randomUUID()}@voucher-ui.test`;
  expect(
    (
      await request.post(`${api}/auth/register`, { data: { email, password } })
    ).ok(),
  ).toBe(true);
  const response = await request.post(`${api}/auth/login`, {
    data: { email, password },
  });
  expect(response.ok()).toBe(true);
  return { ...(await response.json()), email };
}

async function cart(context: BrowserContext, qty = 1) {
  await context.addInitScript((quantity) => {
    // Preserve later changes and the login redirect across page navigations.
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
                qty: quantity,
                unitPrice: 35000,
              },
            ],
          },
        }),
      );
  }, qty);
}

async function picker(page: Page) {
  await page.getByRole("button", { name: "Chọn hoặc nhập mã" }).click();
  return page.getByRole("dialog", { name: "Chọn ưu đãi BrewLite" });
}

async function fits(page: Page, name = "voucher") {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath(`${name}.png`),
    fullPage: true,
  });
}

test("select a public voucher and pay the discounted amount through the QR on a second device", async ({
  page,
  context,
  request,
  browser,
}) => {
  const auth = await account(request);
  await context.addInitScript((data) => {
    localStorage.setItem("brewlite_token", data.access_token);
    localStorage.setItem("brewlite_user", JSON.stringify(data.user));
  }, auth);
  await cart(context);
  await page.goto("/cart");
  const dialog = await picker(page);
  await expect(
    dialog.getByRole("radio", { name: /Ưu đãi cho đơn từ/ }),
  ).toBeDisabled();
  await dialog.getByRole("radio", { name: /Ưu đãi kiểm thử/ }).check();
  await fits(page, "voucher-list");
  await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
  const place = page.getByRole("button", { name: /^Đặt hàng/ });
  await expect(place).toHaveText(/25[.,]000/);
  await place.click();
  await expect(page).toHaveURL(/\/checkout\/ORD-/);
  const id = decodeURIComponent(
    new URL(page.url()).pathname.split("/").at(-1)!,
  );
  await expect(page.getByText("Ưu đãi UI10K")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /^Thanh toán/ })).toHaveText(
    /25[.,]000/,
  );
  await page.goto("/cart");
  await expect(
    page.getByRole("button", { name: "Chọn hoặc nhập mã" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Tiếp tục đơn hàng" }).click();
  await page.getByRole("button", { name: /^Thanh toán/ }).click();
  await expect(page).toHaveURL(/\/pay\/PAY-/);
  const qr = page.getByText(/^http.*\/mock-gateway\//).first();
  await expect(qr).toBeVisible();
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    const screen = await phone.newPage();
    await screen.goto((await qr.textContent())!);
    await expect(screen.getByText(/25[.,]000/)).toBeVisible();
    await screen
      .getByRole("button", { name: "Xác nhận trả", exact: true })
      .click();
    await expect(screen.getByRole("status")).toContainText(
      "Đã thanh toán thành công",
    );
    await expect(page).toHaveURL(new RegExp(`/orders/${id}/confirmation$`));
    await expect(page.getByText("Ưu đãi UI10K")).toBeVisible();
    const order = await (
      await request.get(`${api}/orders/${id}`, {
        headers: { Authorization: `Bearer ${auth.access_token}` },
      })
    ).json();
    expect(order).toMatchObject({
      subtotal: 35000,
      discount: 10000,
      total: 25000,
      voucherCode: "UI10K",
      status: "PAID",
    });
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("brewlite-cart")!).state.voucherCode,
      ),
    ).toBe("");
    await fits(page);
  } finally {
    await phone.close();
  }
});

test("enter a private code, reject a wrong code and preserve selection through login", async ({
  page,
  context,
  request,
}) => {
  const auth = await account(request);
  await cart(context);
  await page.goto("/cart");
  const dialog = await picker(page);
  await expect(dialog.getByText("Mã nhập riêng kiểm thử")).toHaveCount(0);
  await dialog.getByLabel("Nhập mã giảm giá").fill("UNKNOWN");
  await dialog.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("không tồn tại");
  await dialog.getByLabel("Nhập mã giảm giá").fill(" uiprivate ");
  await dialog.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("UIPRIVATE hợp lệ");
  await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Đặt hàng/ })).toHaveText(
    /31[.,]500/,
  );
  await page.getByRole("button", { name: /^Đặt hàng/ }).click();
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await page.getByLabel("Email", { exact: true }).fill(auth.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("button", { name: /^Đặt hàng/ })).toHaveText(
    /31[.,]500/,
  );
  await page.getByRole("button", { name: /^Đặt hàng/ }).click();
  await expect(page).toHaveURL(/\/checkout\/ORD-/);
  await expect(page.getByText("Ưu đãi UIPRIVATE")).toBeVisible();
});

test("revalidates a selected voucher when quantity changes and allows removing it", async ({
  page,
  context,
}) => {
  await cart(context, 2);
  await page.goto("/cart");
  const dialog = await picker(page);
  await dialog.getByRole("radio", { name: /Ưu đãi cho đơn từ/ }).check();
  await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Đặt hàng/ })).toHaveText(
    /55[.,]000/,
  );
  await page
    .getByRole("button", { name: "Giảm số lượng", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "chưa đạt tối thiểu",
  );
  await expect(page.getByRole("button", { name: /^Đặt hàng/ })).toBeDisabled();
  await page.getByRole("button", { name: "Bỏ mã", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Đặt hàng/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /^Đặt hàng/ })).toHaveText(
    /35[.,]000/,
  );
});

test("empty and failed voucher lists keep manual input and retry accessible; Escape closes the dialog", async ({
  page,
  context,
}) => {
  await cart(context);
  let fail = true;
  await page.route(`${api}/vouchers/quote`, async (route) => {
    if (fail)
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Không tải được ưu đãi." }),
      });
    const response = await route.fetch();
    return route.fulfill({
      response,
      json: { ...(await response.json()), vouchers: [] },
    });
  });
  await page.goto("/cart");
  let dialog = await picker(page);
  await expect(dialog.getByRole("alert")).toContainText(
    "Không tải được ưu đãi",
  );
  fail = false;
  await dialog.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(
    dialog.getByText(/Hiện chưa có mã ưu đãi công khai/),
  ).toBeVisible();
  await expect(dialog.getByLabel("Nhập mã giảm giá")).toBeEnabled();
  await fits(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Chọn hoặc nhập mã" }),
  ).toBeFocused();
  dialog = await picker(page);
  await dialog.getByLabel("Nhập mã giảm giá").fill("UI10K");
  await dialog.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("UI10K hợp lệ");
});
