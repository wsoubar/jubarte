// Produz SQL privado com os dados; nunca grava dados reais em arquivos versionados.
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const privateDir = new URL("../../.migration-private/", import.meta.url);
const source = JSON.parse(
  await readFile(new URL("source.json", privateDir), "utf8"),
);
const uidMap = JSON.parse(
  await readFile(new URL("uid-map.json", privateDir), "utf8"),
);
const targetRef = "omduuwlmkyfdupzgqtpq";
assert.ok(source.snapshot && source.owners?.length);
assert.equal(new Set(Object.values(uidMap)).size, Object.keys(uidMap).length);
for (const rows of Object.values(source.snapshot)) {
  for (const row of rows)
    assert.ok(uidMap[row.user_id], "Proprietário sem mapeamento");
}
const values = {
  snapshot: JSON.stringify(source.snapshot),
  uid_map: JSON.stringify(uidMap),
  target_ref: targetRef,
  expected_target_ref: targetRef,
};
const tag = `$params_${randomBytes(16).toString("hex")}$`;
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const parameters = `do ${tag} begin\n${Object.entries(values)
  .map(
    ([key, value]) =>
      `perform set_config('jubarte_migration.${key}', ${literal(value)}, true);`,
  )
  .join("\n")}\nend ${tag};\n`;
for (const [name, input] of [
  ["import.sql", "02-importar.sql"],
  ["validate.sql", "04-validar.sql"],
]) {
  const script = await readFile(new URL(input, import.meta.url), "utf8");
  await writeFile(
    new URL(name, privateDir),
    `begin;\n${parameters}${script}\ncommit;\n`,
    { mode: 0o600 },
  );
}
console.log(JSON.stringify({ sqlPrivadoPreparado: true, targetRef }));
