import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const db = new PGlite();
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333";
let account: string,
  destination: string,
  foreignAccount: string,
  debtor: string,
  foreignDebtor: string,
  loan: string,
  receipt: string;
async function asUser(id: string) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${id}';`,
  );
}
async function insertLoan(overrides: Record<string, unknown> = {}) {
  const data = {
    user_id: a,
    debtor_id: debtor,
    account_id: account,
    date: "2026-01-10",
    amount_cents: 10000,
    ...overrides,
  };
  return insert("jubarte_loans", data);
}
async function insertReceipt(overrides: Record<string, unknown> = {}) {
  return insert("jubarte_loan_receipts", {
    user_id: a,
    loan_id: loan,
    account_id: destination,
    date: "2026-01-11",
    amount_cents: 6000,
    ...overrides,
  });
}
async function insert(table: string, data: Record<string, unknown>) {
  const result = await db.query<{ id: string }>(
    `insert into ${table} (${Object.keys(data).join(",")}) values (${Object.keys(
      data,
    )
      .map((_, i) => "$" + (i + 1))
      .join(",")}) returning id`,
    Object.values(data),
  );
  return result.rows[0].id;
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values ('${a}'),('${b}'),('${outsider}');`,
  );
  for (const file of [
    "202610300001_jubarte.sql",
    "202610310001_jubarte_loans.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.exec(`insert into jubarte_members values ('${a}'),('${b}');`);
  await asUser(a);
  account = await insert("jubarte_accounts", {
    user_id: a,
    name: "Saída",
    initial_cents: 100000,
    initial_date: "2026-01-01",
  });
  destination = await insert("jubarte_accounts", {
    user_id: a,
    name: "Entrada",
    initial_cents: 0,
    initial_date: "2026-01-01",
  });
  debtor = await insert("jubarte_debtors", {
    user_id: a,
    name: "Pessoa A",
    kind: "person",
  });
  await asUser(b);
  foreignAccount = await insert("jubarte_accounts", {
    user_id: b,
    name: "Conta B",
    initial_cents: 0,
    initial_date: "2026-01-01",
  });
  foreignDebtor = await insert("jubarte_debtors", {
    user_id: b,
    name: "Empresa B",
    kind: "company",
  });
  await asUser(a);
}, 30000);
afterAll(async () => {
  await db.close();
});

describe.sequential(
  "segurança e integridade de empréstimos no PostgreSQL",
  () => {
    it("recusa valores, datas e referências inválidas pela API direta", async () => {
      await expect(insertLoan({ amount_cents: 0 })).rejects.toThrow();
      await expect(
        insertLoan({ amount_cents: 100000000001 }),
      ).rejects.toThrow();
      await expect(insertLoan({ date: "2999-01-01" })).rejects.toThrow();
      await expect(insertLoan({ date: "2025-12-31" })).rejects.toThrow();
      await expect(insertLoan({ due_date: "2026-01-09" })).rejects.toThrow();
      await expect(
        insertLoan({ account_id: foreignAccount }),
      ).rejects.toThrow();
      await expect(insertLoan({ debtor_id: foreignDebtor })).rejects.toThrow();
      loan = await insertLoan();
      await expect(insertReceipt({ date: "2026-01-09" })).rejects.toThrow();
      await expect(insertReceipt({ date: "2999-01-01" })).rejects.toThrow();
      await expect(insertReceipt({ amount_cents: -1 })).rejects.toThrow();
      await expect(
        insertReceipt({ account_id: foreignAccount }),
      ).rejects.toThrow();
    });
    it("permite excedente e mantém empréstimo aberto sem criar lançamentos duplicados", async () => {
      receipt = await insertReceipt();
      await insertReceipt({ date: "2026-01-12" });
      expect(
        (
          await db.query<{ closed: boolean }>(
            "select closed from jubarte_loans",
          )
        ).rows[0].closed,
      ).toBe(false);
      expect(
        (
          await db.query<{ total: number }>(
            "select sum(amount_cents)::int as total from jubarte_loan_receipts",
          )
        ).rows[0].total,
      ).toBe(12000);
      expect(
        (await db.query("select * from jubarte_entries")).rows,
      ).toHaveLength(0);
    });
    it("fecha manualmente, exige reabertura para alterações e protege as datas", async () => {
      await expect(
        db.exec(
          `update jubarte_loans set closed=true, closed_date='2026-01-11' where id='${loan}'`,
        ),
      ).rejects.toThrow();
      await db.exec(
        `update jubarte_loans set closed=true, closed_date='2026-01-12', closing_notes='Acordo encerrado' where id='${loan}'`,
      );
      await expect(insertReceipt()).rejects.toThrow(/Reabra/);
      await expect(
        db.exec(`delete from jubarte_loan_receipts where id='${receipt}'`),
      ).rejects.toThrow(/Reabra/);
      await expect(
        db.exec(
          `update jubarte_loans set amount_cents=20000 where id='${loan}'`,
        ),
      ).rejects.toThrow(/Reabra/);
      await expect(
        db.exec(`delete from jubarte_loans where id='${loan}'`),
      ).rejects.toThrow(/Reabra/);
      await db.exec(
        `update jubarte_loans set closed=false, closed_date=null, closing_notes='' where id='${loan}'`,
      );
      await expect(
        db.exec(
          `update jubarte_loans set date='2026-01-12' where id='${loan}'`,
        ),
      ).rejects.toThrow();
      await expect(
        db.exec(
          `update jubarte_accounts set initial_date='2026-01-11' where id='${account}'`,
        ),
      ).rejects.toThrow();
      await expect(
        db.exec(
          `update jubarte_accounts set initial_date='2026-01-12' where id='${destination}'`,
        ),
      ).rejects.toThrow();
      await expect(
        db.exec(`delete from jubarte_loans where id='${loan}'`),
      ).rejects.toThrow();
      await db.exec(
        `update jubarte_loan_receipts set amount_cents=5000, account_id='${account}' where id='${receipt}'`,
      );
      await db.exec(`delete from jubarte_loan_receipts where id='${receipt}'`);
    });
    it("permite fechamento com saldo não recuperado ou sem recebimentos", async () => {
      const another = await insertLoan();
      await db.exec(
        `update jubarte_loans set closed=true where id='${another}'`,
      );
      await db.exec(`update jubarte_loans set closed=true where id='${loan}'`);
    });
    it("preserva arquivados e impede novos empréstimos/recebimentos em contas arquivadas", async () => {
      await db.exec(
        `update jubarte_debtors set archived=true where id='${debtor}'`,
      );
      await expect(insertLoan()).rejects.toThrow(/arquivado/);
      await db.exec(
        `update jubarte_debtors set archived=false where id='${debtor}'; update jubarte_accounts set archived=true where id='${account}';`,
      );
      await expect(insertLoan()).rejects.toThrow(/arquivada/);
      await db.exec(
        `update jubarte_accounts set archived=false where id='${account}';`,
      );
    });
    it("isola usuários e não permite forjar relacionamentos ou proprietário", async () => {
      await asUser(b);
      for (const table of ["jubarte_loans", "jubarte_loan_receipts"])
        expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
      await expect(insertLoan()).rejects.toThrow();
      await expect(
        insertReceipt({ user_id: b, account_id: foreignAccount }),
      ).rejects.toThrow();
      expect(
        (
          await db.query(
            `update jubarte_loans set amount_cents=1 where id='${loan}' returning id`,
          )
        ).rows,
      ).toHaveLength(0);
      await asUser(a);
      await expect(
        db.exec(`update jubarte_loans set user_id='${b}' where id='${loan}'`),
      ).rejects.toThrow();
      await asUser(outsider);
      for (const table of [
        "jubarte_debtors",
        "jubarte_loans",
        "jubarte_loan_receipts",
      ]) {
        expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
      }
      await expect(
        insert("jubarte_debtors", {
          user_id: outsider,
          name: "X",
          kind: "person",
        }),
      ).rejects.toThrow();
      await db.exec("reset role;set role anon;");
      for (const table of [
        "jubarte_debtors",
        "jubarte_loans",
        "jubarte_loan_receipts",
      ])
        await expect(db.query(`select * from ${table}`)).rejects.toThrow();
    });
  },
);
