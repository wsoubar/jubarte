// Verifica o login real e a origem das requisições, sem imprimir dados pessoais.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const privateDir = new URL("../../.migration-private/", import.meta.url);
const login = JSON.parse(
  await readFile(new URL("login.json", privateDir), "utf8"),
);
const source = JSON.parse(
  await readFile(new URL("source.json", privateDir), "utf8"),
);
const targetHost = "omduuwlmkyfdupzgqtpq.supabase.co";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const hosts = new Set();
  const pageErrors = [];
  page.on("pageerror", () => pageErrors.push("erro de execução"));
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    if (host.endsWith(".supabase.co")) hosts.add(host);
  });
  await page.goto("http://127.0.0.1:5173/jubarte/");
  await page.getByLabel("E-mail", { exact: true }).fill(login.email);
  await page.getByLabel("Senha", { exact: true }).fill(login.password);
  const reads = Object.keys(source.snapshot)
    .filter((name) => name !== "jubarte_members")
    .map((name) =>
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/rest/v1/${name}` &&
          response.ok(),
      ),
    );
  await page
    .getByRole("button", { name: "Entrar no Jubarte", exact: true })
    .click();
  await Promise.all(reads);
  await page
    .locator(".topbar-left strong")
    .filter({ hasText: "Visão geral" })
    .waitFor();
  await page.goto("http://127.0.0.1:5173/jubarte/#/contas");
  await page
    .getByText(source.snapshot.jubarte_accounts[0].name, { exact: true })
    .first()
    .waitFor();
  await page.reload();
  await page
    .getByText(source.snapshot.jubarte_accounts[0].name, { exact: true })
    .first()
    .waitFor();
  await page.locator('button[title="Sair"]').click();
  await page
    .getByRole("button", { name: "Entrar no Jubarte", exact: true })
    .waitFor();
  assert.deepEqual([...hosts], [targetHost]);
  assert.equal(pageErrors.length, 0);
  console.log(
    JSON.stringify({
      loginInterface: true,
      seisTabelasCarregadas: true,
      contaMigradaVisivel: true,
      sessaoAposReload: true,
      logoutInterface: true,
      somenteDestino: true,
    }),
  );
} finally {
  await browser.close();
}
