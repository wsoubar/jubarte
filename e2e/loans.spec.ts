import { test, expect, type Page } from "@playwright/test";

async function demo(page: Page) {
  await page.goto("./#/devedores");
  await page.getByRole("button", { name: "Explorar demonstração" }).click();
  await page.getByRole("button", { name: "Novo devedor", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Ana Souza");
  await dialog.getByLabel("Telefone").fill("11999990000");
  await dialog.getByRole("button", { name: "Salvar devedor" }).click();
  await expect(dialog).not.toBeVisible();
}
async function lend(page: Page, value = "100") {
  await page
    .getByRole("button", { name: "Novo empréstimo", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor (R$)").fill(value);
  await dialog.getByLabel("Conta de saída").selectOption("bank");
  await dialog.getByRole("button", { name: "Salvar empréstimo" }).click();
  await expect(dialog).not.toBeVisible();
}
async function receive(page: Page, account: string) {
  await page.getByRole("button", { name: "Registrar recebimento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor (R$)").fill("60");
  await dialog.getByLabel("Conta de entrada").selectOption(account);
  await dialog.getByRole("button", { name: "Salvar recebimento" }).click();
  await expect(dialog).not.toBeVisible();
}
async function close(page: Page) {
  await page
    .getByRole("button", { name: "Fechar empréstimo", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Observação do fechamento")
    .fill("Acordo concluído");
  await page.getByRole("button", { name: "Confirmar fechamento" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

test("visão geral mostra dinheiro emprestado, recebimentos e fechados sem misturar saldos", async ({
  page,
}) => {
  await demo(page);
  await lend(page);
  await receive(page, "reserve");
  async function overview(outstanding: string) {
    await page.getByRole("link", { name: "Visão geral", exact: true }).click();
    await expect(page.locator(".stat-grid > *")).toHaveCount(5);
    const card = page.getByRole("link", {
      name: "Ver empréstimos a receber",
      exact: true,
    });
    await expect(card.locator("strong")).toHaveText(outstanding);
  }
  await overview("R$ 40,00");
  await page
    .getByRole("link", { name: "Ver empréstimos a receber", exact: true })
    .click();
  await close(page);
  await overview("R$ 0,00");
  await page
    .getByRole("link", { name: "Ver empréstimos a receber", exact: true })
    .click();
  await lend(page);
  await receive(page, "wallet");
  await overview("R$ 40,00");
  await page.screenshot({
    path: "/tmp/jubarte-dashboard-loans-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Mês anterior" }).click();
  await overview("R$ 40,00");
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("aside")).not.toBeInViewport();
  await page.screenshot({
    path: "/tmp/jubarte-dashboard-loans-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page
    .getByRole("link", { name: "Ver empréstimos a receber", exact: true })
    .click();
  await receive(page, "reserve");
  await overview("R$ 0,00");
});

test("devedor, 100 emprestados, 2x60 em contas distintas, fechamento e correções", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  await lend(page);
  await receive(page, "reserve");
  await receive(page, "wallet");
  const card = page.getByRole("article");
  await expect(card.getByText("Aberto", { exact: true })).toBeVisible();
  await expect(card.locator(".loan-values")).toContainText("R$ 120,00");
  await expect(card.locator(".loan-values")).toContainText("R$ 20,00");
  await expect(card.locator(".loan-receipts li")).toHaveCount(2);
  await close(page);
  await expect(card.getByText("Fechado", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar recebimento" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Minhas contas", exact: true }).click();
  await expect(
    page
      .locator(".account-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Conta principal",
          exact: true,
        }),
      })
      .locator(".account-value"),
  ).toHaveText("R$ 17.207,20");
  await expect(
    page
      .locator(".account-card")
      .filter({
        has: page.getByRole("heading", {
          name: "Reserva de emergência",
          exact: true,
        }),
      })
      .locator(".account-value"),
  ).toHaveText("R$ 22.060,00");
  await expect(
    page
      .locator(".account-card")
      .filter({
        has: page.getByRole("heading", { name: "Carteira", exact: true }),
      })
      .locator(".account-value"),
  ).toHaveText("R$ 245,00");
  await page.getByRole("link", { name: "Lançamentos", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Buscar lançamentos" })
    .fill("Ana Souza");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: /Excluir .*empréstimo/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Abrir Empréstimo concedido · Ana Souza" })
    .click();
  await page.getByRole("button", { name: "Reabrir empréstimo" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Editar empréstimo", exact: true })
    .click();
  await page.getByRole("dialog").getByLabel("Valor (R$)").fill("150");
  await page.getByRole("button", { name: "Salvar empréstimo" }).click();
  await expect(card.locator(".loan-values")).toContainText("R$ 30,00");
  await page
    .getByRole("button", { name: "Excluir recebimento de R$ 60,00" })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(card.locator(".loan-receipts li")).toHaveCount(1);
  await close(page);
  await expect(card.locator(".loan-values")).toContainText(
    "Não recuperadoR$ 90,00",
  );
  await page.getByRole("link", { name: "Relatórios", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  await (await download).saveAs("/tmp/jubarte-loans.pdf");
  await page.getByRole("link", { name: "Devedores", exact: true }).click();
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await page.screenshot({
    path: "/tmp/jubarte-loans-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("aside")).not.toBeInViewport();
  await page.screenshot({
    path: "/tmp/jubarte-loans-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("empresa, validação, exclusão e arquivamento sem perder histórico", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Editar devedor" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Tipo de devedor", { exact: true })
    .selectOption("company");
  await page
    .getByRole("dialog")
    .getByLabel("Nome", { exact: true })
    .fill("Empresa E2E");
  await page.getByRole("button", { name: "Salvar devedor" }).click();
  await page
    .getByRole("button", { name: "Novo empréstimo", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const date = await dialog.getByLabel("Data do empréstimo").inputValue();
  await dialog.getByLabel("Valor (R$)").fill("0");
  await dialog.getByLabel("Conta de saída").selectOption("bank");
  await dialog.getByRole("button", { name: "Salvar empréstimo" }).click();
  await expect(dialog.getByRole("alert")).toContainText("maior que zero");
  await dialog.getByLabel("Valor (R$)").fill("100");
  await dialog.getByLabel("Data do empréstimo").fill("2000-01-01");
  await dialog.getByRole("button", { name: "Salvar empréstimo" }).click();
  await expect(dialog.getByRole("alert")).toContainText("saldo inicial");
  await dialog.getByLabel("Data do empréstimo").fill(date);
  await dialog.getByRole("button", { name: "Salvar empréstimo" }).click();
  await expect(dialog).not.toBeVisible();
  await receive(page, "reserve");
  await page
    .getByRole("button", { name: "Editar recebimento de R$ 60,00" })
    .click();
  await page.getByRole("dialog").getByLabel("Valor (R$)").fill("80");
  await page
    .getByRole("dialog")
    .getByLabel("Conta de entrada")
    .selectOption("wallet");
  await page.getByRole("button", { name: "Salvar recebimento" }).click();
  await expect(page.locator(".loan-values")).toContainText("R$ 20,00");
  await expect(
    page.getByRole("button", { name: "Excluir empréstimo", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Excluir recebimento de R$ 80,00" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(page.locator(".loan-receipts li")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Excluir empréstimo", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await lend(page, "50");
  await close(page);
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Novo empréstimo", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Mostrar arquivados").check();
  await expect(
    page.getByRole("button", { name: /Empresa E2E.*Arquivado/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Novo empréstimo", exact: true }),
  ).toBeVisible();
});
