// Login e CRUD descartável pela mesma API usada pelo frontend, somente no destino.
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const privateDir = new URL("../../.migration-private/", import.meta.url);
const login = JSON.parse(
  await readFile(new URL("login.json", privateDir), "utf8"),
);
const source = JSON.parse(
  await readFile(new URL("source.json", privateDir), "utf8"),
);
assert.equal(login.url, "https://omduuwlmkyfdupzgqtpq.supabase.co");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = createClient(login.url, login.publishable, options);
const anon = createClient(login.url, login.publishable, options);
function checked(result, operation) {
  if (result.error)
    throw new Error(
      `${operation}: ${result.error.code ?? result.error.status ?? "erro"}`,
    );
  return result.data;
}
const authenticated = checked(
  await client.auth.signInWithPassword({
    email: login.email,
    password: login.password,
  }),
  "login",
);
assert.ok(authenticated.session);
assert.equal(
  checked(await client.rpc("jubarte_is_authorized"), "autorização"),
  true,
);
for (const table of Object.keys(source.snapshot)) {
  const result = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  checked(result, `leitura ${table}`);
  assert.equal(result.count, source.snapshot[table].length);
  const unauthenticated = await anon
    .from(table)
    .select("*", { count: "exact", head: true });
  assert.ok(unauthenticated.error || unauthenticated.count === 0);
}
const id = randomUUID();
let created = false;
try {
  checked(
    await client
      .from("jubarte_debtors")
      .insert({
        id,
        user_id: authenticated.user.id,
        name: "Teste temporário de migração",
        kind: "person",
      }),
    "criação",
  );
  created = true;
  checked(
    await client
      .from("jubarte_debtors")
      .update({ notes: "Validação descartável" })
      .eq("id", id),
    "alteração",
  );
  const row = checked(
    await client.from("jubarte_debtors").select("notes").eq("id", id).single(),
    "consulta",
  );
  assert.equal(row.notes, "Validação descartável");
} finally {
  if (created) {
    checked(
      await client.from("jubarte_debtors").delete().eq("id", id),
      "remoção do teste",
    );
    assert.equal(
      checked(
        await client.from("jubarte_debtors").select("id").eq("id", id),
        "confirmar limpeza",
      ).length,
      0,
    );
  }
  checked(await client.auth.signOut(), "logout");
}
assert.equal(
  checked(await client.auth.getSession(), "sessão após logout").session,
  null,
);
console.log(
  JSON.stringify({
    login: true,
    autorizacao: true,
    leituraSeteTabelas: true,
    bloqueioAnonimo: true,
    crud: true,
    logout: true,
  }),
);
