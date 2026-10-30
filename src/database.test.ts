// Real PostgreSQL execution in WASM; no access to the shared Supabase project.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const db = new PGlite();
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333";
let account: string, other: string, category: string;
async function uid(id: string) {
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}';`);
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${alice}'),('${bob}'),('${outsider}');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610300001_jubarte.sql", "utf8"),
  );
  await db.exec(`insert into jubarte_members values ('${alice}'),('${bob}');`);
  await uid(alice);
  account = (
    await db.query<{ id: string }>(
      `insert into jubarte_accounts(user_id,name,initial_cents,initial_date) values ('${alice}','Conta A',10000,'2026-01-01') returning id`,
    )
  ).rows[0].id;
  category = (
    await db.query<{ id: string }>(
      `insert into jubarte_categories(user_id,name,kind) values ('${alice}','Casa','expense') returning id`,
    )
  ).rows[0].id;
  await uid(bob);
  other = (
    await db.query<{ id: string }>(
      `insert into jubarte_accounts(user_id,name,initial_cents,initial_date) values ('${bob}','Conta B',10000,'2026-01-01') returning id`,
    )
  ).rows[0].id;
}, 30000);
afterAll(async () => {
  await db.close();
});
async function insert(overrides: Record<string, string | number | null> = {}) {
  const data = {
    user_id: alice,
    kind: "expense",
    description: "Compra",
    amount_cents: 500,
    account_id: account,
    category_id: category,
    due_date: "2026-01-10",
    paid_date: "2026-01-10",
    ...overrides,
  };
  return db.query(
    `insert into jubarte_entries(${Object.keys(data).join(",")}) values (${Object.keys(
      data,
    )
      .map((_, i) => "$" + (i + 1))
      .join(",")}) returning id`,
    Object.values(data),
  );
}
describe.sequential("RLS e invariantes PostgreSQL", () => {
  it("isola registros de outro usuário autorizado", async () => {
    await uid(bob);
    const r = await db.query("select * from jubarte_accounts");
    expect(r.rows).toHaveLength(1);
    expect((r.rows[0] as { id: string }).id).toBe(other);
    await expect(insert()).rejects.toThrow();
  });
  it("bloqueia usuário sem autorização e inclusão de membros", async () => {
    await uid(outsider);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select jubarte_is_authorized() as allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    expect(
      (await db.query("select * from jubarte_accounts")).rows,
    ).toHaveLength(0);
    await expect(
      db.exec(`insert into jubarte_members values ('${outsider}')`),
    ).rejects.toThrow();
  });
  it("bloqueia acesso anônimo", async () => {
    await db.exec("reset role;set role anon");
    await expect(db.query("select * from jubarte_entries")).rejects.toThrow();
  });
  it("aceita lançamento válido e impede referências a outra conta", async () => {
    await uid(alice);
    expect((await insert()).rows).toHaveLength(1);
    await expect(insert({ account_id: other })).rejects.toThrow();
  });
  it("rejeita data anterior, valor inválido e pagamento futuro", async () => {
    await uid(alice);
    await expect(insert({ due_date: "2025-12-31" })).rejects.toThrow();
    await expect(insert({ amount_cents: -1 })).rejects.toThrow();
    await expect(insert({ paid_date: "2099-01-01" })).rejects.toThrow();
  });
  it("rejeita categoria incompatível", async () => {
    await uid(alice);
    await expect(insert({ kind: "income" })).rejects.toThrow();
  });
  it("transferência exige destino distinto do mesmo usuário e dispensa categoria", async () => {
    await uid(alice);
    await expect(
      insert({ kind: "transfer", destination_id: account, category_id: null }),
    ).rejects.toThrow();
    await expect(
      insert({ kind: "transfer", destination_id: other, category_id: null }),
    ).rejects.toThrow();
    const dest = (
      await db.query<{ id: string }>(
        `insert into jubarte_accounts(user_id,name,initial_cents,initial_date) values ('${alice}','Reserva',0,'2026-01-01') returning id`,
      )
    ).rows[0].id;
    expect(
      (
        await insert({
          kind: "transfer",
          destination_id: dest,
          category_id: null,
        })
      ).rows,
    ).toHaveLength(1);
  });
  it("protege edições de contas e categorias já utilizadas", async () => {
    await uid(alice);
    await expect(
      db.exec(
        `update jubarte_accounts set initial_date='2026-02-01' where id='${account}'`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `update jubarte_categories set kind='income' where id='${category}'`,
      ),
    ).rejects.toThrow();
  });
  it("não permite novos lançamentos com recursos arquivados", async () => {
    await uid(alice);
    await db.exec(
      `update jubarte_accounts set archived=true where id='${account}'`,
    );
    await expect(insert()).rejects.toThrow();
    await db.exec(
      `update jubarte_accounts set archived=false where id='${account}';update jubarte_categories set archived=true where id='${category}'`,
    );
    await expect(insert()).rejects.toThrow();
  });
  it("revogar associação remove acesso sem apagar dados", async () => {
    await db.exec(
      `reset role;delete from jubarte_members where user_id='${alice}'`,
    );
    await uid(alice);
    expect((await db.query("select * from jubarte_entries")).rows).toHaveLength(
      0,
    );
  });
});
