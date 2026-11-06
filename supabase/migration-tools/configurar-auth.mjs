// Administração somente do projeto dedicado; segredos ficam fora do Git.
import { readFile, writeFile, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const targetRef = "omduuwlmkyfdupzgqtpq";
const privateDir = new URL("../../.migration-private/", import.meta.url);
const source = JSON.parse(
  await readFile(new URL("source.json", privateDir), "utf8"),
);
if (source.owners.length !== 1)
  throw new Error("Revise o remapeamento: esperado um proprietário.");
const env = await readFile(new URL("admin.env", privateDir), "utf8");
const token = env
  .match(/^SUPABASE_ACCESS_TOKEN\s*=\s*(.+)$/m)?.[1]
  ?.trim()
  .replace(/^['"]|['"]$/g, "");
if (!token)
  throw new Error(
    "Preencha SUPABASE_ACCESS_TOKEN no arquivo privado admin.env.",
  );
await chmod(new URL("admin.env", privateDir), 0o600);
async function management(path, options = {}) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${targetRef}/${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!response.ok)
    throw new Error(
      `Management API ${path.split("?")[0]}: HTTP ${response.status}`,
    );
  return response.json();
}
await management("config/auth", {
  method: "PATCH",
  body: JSON.stringify({
    disable_signup: true,
    external_email_enabled: true,
    site_url: "https://wsoubar.github.io/jubarte/",
    uri_allow_list:
      "https://wsoubar.github.io/jubarte/,http://localhost:5173/jubarte/,http://127.0.0.1:5173/jubarte/",
  }),
});
const keys = await management("api-keys?reveal=true");
const secret =
  keys.find((key) => key.name === "service_role" && !key.disabled)?.api_key ??
  keys.find((key) => key.type === "secret" && !key.disabled)?.api_key;
const publishable =
  keys.find((key) => key.type === "publishable" && !key.disabled)?.api_key ??
  keys.find((key) => key.name === "anon" && !key.disabled)?.api_key;
if (!secret || !publishable)
  throw new Error("Chaves necessárias não disponíveis para o token.");
const url = `https://${targetRef}.supabase.co`;
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: listing, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError)
  throw new Error(`Listar usuários: ${listError.code ?? listError.status}`);
const owner = source.owners[0];
let user = listing.users.find(
  (candidate) => candidate.email?.toLowerCase() === owner.email.toLowerCase(),
);
let credentials;
try {
  credentials = JSON.parse(
    await readFile(new URL("login.json", privateDir), "utf8"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (!user) {
  credentials = {
    email: owner.email,
    password: randomBytes(24).toString("base64url"),
    url,
    publishable,
  };
  // Salvar antes da chamada permite recuperar a senha se houver interrupção.
  await writeFile(
    new URL("login.json", privateDir),
    JSON.stringify(credentials, null, 2),
    { mode: 0o600 },
  );
  const result = await admin.auth.admin.createUser({
    email: credentials.email,
    password: credentials.password,
    email_confirm: true,
  });
  if (result.error)
    throw new Error(
      `Criar usuário: ${result.error.code ?? result.error.status}`,
    );
  user = result.data.user;
}
if (!user) throw new Error("Usuário não foi provisionado.");
const uidMap = { [owner.id]: user.id };
await writeFile(new URL("uid-map.json", privateDir), JSON.stringify(uidMap), {
  mode: 0o600,
});
await writeFile(
  new URL("destination.json", privateDir),
  JSON.stringify({ targetRef, url, publishable }),
  { mode: 0o600 },
);
const config = await management("config/auth");
if (
  !config.disable_signup ||
  !config.external_email_enabled ||
  !config.uri_allow_list?.includes("https://wsoubar.github.io/jubarte/")
) {
  throw new Error("Configuração Auth não corresponde ao esperado.");
}
console.log(
  JSON.stringify({
    authConfigurado: true,
    usuarioProvisionado: true,
    mapaSalvo: true,
    credencialLocalDisponivel: Boolean(credentials),
    targetRef,
  }),
);
