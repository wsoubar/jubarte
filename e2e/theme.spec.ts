import { test, expect } from "@playwright/test";

test("tema escuro cobre login, configurações, formulários e persiste ao recarregar", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page.screenshot({
    path: "/tmp/jubarte-dark-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Escuro", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Claro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Escuro", exact: true }).click();
  await page.screenshot({
    path: "/tmp/jubarte-dark-settings.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({
    path: "/tmp/jubarte-dark-login.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page.getByRole("link", { name: "Minhas contas", exact: true }).click();
  await page.getByRole("button", { name: "Nova conta" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCSS("background-color", "rgb(20, 37, 54)");
  await expect(dialog.getByLabel("Nome", { exact: true })).toHaveCSS(
    "color",
    "rgb(226, 237, 245)",
  );
  await page.screenshot({
    path: "/tmp/jubarte-dark-modal.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("aside")).not.toBeInViewport();
  await page.screenshot({
    path: "/tmp/jubarte-dark-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("troca de tema funciona com armazenamento bloqueado", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Armazenamento bloqueado", "SecurityError");
      },
    });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
