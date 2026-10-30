import { expect, type APIRequestContext, type Browser } from "@playwright/test";

export async function reviewAsStaff(
  browser: Browser,
  request: APIRequestContext,
  orderId: string,
  decision: "confirm" | "reject" = "confirm",
) {
  const response = await request.post("http://127.0.0.1:3201/auth/login", {
    data: { email: "staff@task9-ui.test", password: "StaffUiTest123" },
  });
  expect(response.ok()).toBe(true);
  const auth = await response.json();
  expect(auth.user.role).toBe("ADMIN");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    await context.addInitScript((data) => {
      localStorage.setItem("brewlite_token", data.access_token);
      localStorage.setItem("brewlite_user", JSON.stringify(data.user));
    }, auth);
    const page = await context.newPage();
    page.on("dialog", (dialog) =>
      dialog.accept(decision === "reject" ? "Chưa nhận được tiền" : undefined),
    );
    await page.goto(
      `http://127.0.0.1:3200/admin/payments?orderId=${encodeURIComponent(orderId)}`,
    );
    const action = page.getByRole("button", {
      name: decision === "confirm" ? "Xác nhận đã nhận tiền" : "Từ chối",
      exact: true,
    });
    await expect(action).toHaveCount(1);
    await expect(page.getByText(orderId, { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() =>
        [...document.querySelectorAll("*")]
          .filter(
            (element) => element.getBoundingClientRect().right > innerWidth + 1,
          )
          .slice(0, 6)
          .map((element) => ({
            tag: element.tagName,
            className: element.className,
            right: element.getBoundingClientRect().right,
          })),
      ),
    ).toEqual([]);
    await action.click();
    await expect(action).toHaveCount(0);
  } finally {
    await context.close();
  }
}
