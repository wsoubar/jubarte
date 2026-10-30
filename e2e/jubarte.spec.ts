import { test, expect } from "@playwright/test";
test("demo: dashboard, CRUD, transferências, PDF, links diretos e celular", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo a bordo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral." }),
  ).toBeVisible();
  await expect(
    page.getByText("Saldo realizado", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/jubarte-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "Minhas contas", exact: true }).click();
  await page.getByRole("button", { name: "Nova conta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Conta E2E");
  await dialog.getByLabel("Saldo inicial (R$)").fill("100,00");
  await dialog.getByRole("button", { name: "Salvar conta" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Conta E2E" })).toBeVisible();
  await page.getByRole("link", { name: "Lançamentos", exact: true }).click();
  await page.getByRole("button", { name: "Novo lançamento" }).click();
  await dialog.getByLabel("Descrição").fill("Compra E2E");
  await dialog.getByLabel("Valor (R$)").fill("25,00");
  await dialog
    .getByLabel("Conta de origem")
    .selectOption({ label: "Conta E2E" });
  await dialog
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption({ label: "Alimentação" });
  await dialog.getByLabel("Já foi pago").check();
  await dialog.getByRole("button", { name: "Salvar lançamento" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Editar Compra E2E" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar Compra E2E" }).click();
  await dialog.getByLabel("Valor (R$)").fill("30,00");
  await dialog.getByRole("button", { name: "Salvar lançamento" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText("R$ 30,00", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Excluir Compra E2E" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Excluir lançamento" })
    .click();
  await expect(
    page.getByRole("button", { name: "Editar Compra E2E" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Novo lançamento" }).click();
  await dialog.getByLabel("Descrição").fill("Transferência E2E");
  await dialog
    .getByRole("combobox", { name: "Tipo", exact: true })
    .selectOption("transfer");
  await dialog.getByLabel("Valor (R$)").fill("40");
  await dialog
    .getByLabel("Conta de origem")
    .selectOption({ label: "Conta E2E" });
  await dialog
    .getByLabel("Conta de destino")
    .selectOption({ label: "Reserva de emergência" });
  await dialog.getByLabel("Já foi pago").check();
  await dialog.getByRole("button", { name: "Salvar lançamento" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("link", { name: "Relatórios", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Comparativo mensal" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  const pdf = await download;
  await pdf.saveAs("/tmp/jubarte-report.pdf");
  expect(pdf.suggestedFilename()).toMatch(/jubarte.*\.pdf/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("link", { name: "Visão geral", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral." }),
  ).toBeVisible();
  await expect(page.locator("aside")).not.toBeInViewport();
  await page.screenshot({ path: "/tmp/jubarte-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bem-vindo a bordo" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral." }),
  ).toBeVisible();
});
test("empty states and keyboard dialog dismissal", async ({ page }) => {
  await page.goto("./#/categorias");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page.getByRole("button", { name: "Nova categoria" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("link", { name: "Lançamentos", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar lançamentos" })
    .fill("não existe");
  await expect(
    page.getByText("Nenhum lançamento por aqui.", { exact: false }),
  ).toBeVisible();
});

test("PDF vazio e relatório longo preservam conteúdo e paginação", async ({
  page,
}) => {
  await page.goto("./");
  for (const kind of ["long", "empty"]) {
    const download = page.waitForEvent("download");
    await page.evaluate(async (kind) => {
      const reportUrl = new URL("src/report.tsx", location.href).href;
      const demoUrl = new URL("src/demo.ts", location.href).href;
      const financeUrl = new URL("src/finance.ts", location.href).href;
      const { downloadReport } = await import(/* @vite-ignore */ reportUrl);
      const { demoLedger } = await import(/* @vite-ignore */ demoUrl);
      const { monthBounds } = await import(/* @vite-ignore */ financeUrl);
      const ledger = demoLedger();
      if (kind === "long")
        ledger.entries = Array.from({ length: 100 }, (_, i) => ({
          ...ledger.entries[i % 8],
          id: "long-" + i,
          description: "Movimentação " + i + " — São Paulo",
          notes:
            i === 0
              ? "Observação extensa. ".repeat(95)
              : "Conferência de paginação",
        }));
      else {
        ledger.entries = [];
        ledger.accounts = [];
        ledger.categories = [];
      }
      await downloadReport(ledger, {
        ...monthBounds(),
        account: "",
        category: "",
        status: "",
        search: "",
      });
    }, kind);
    const file = await download;
    await file.saveAs("/tmp/jubarte-" + kind + ".pdf");
  }
});
