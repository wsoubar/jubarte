import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Button } from "./components/ui/button";
import { cents, today } from "./finance";
import type { Account, Category, Entry, Ledger } from "./types";
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe um nome.")
    .max(100, "Use até 100 caracteres."),
  value: z.string(),
  date: z.string().min(1, "Informe a data."),
  color: z.string(),
  kind: z.enum(["income", "expense", "transfer"]),
  account: z.string(),
  destination: z.string(),
  category: z.string(),
  paid: z.boolean(),
  paidDate: z.string(),
  notes: z.string().max(2000, "Use até 2.000 caracteres."),
  icon: z.string(),
});
type Values = z.infer<typeof schema>;
export function Editor({
  type,
  item,
  ledger,
  onSave,
}: {
  type: "account" | "category" | "entry";
  item?: Account | Category | Entry;
  ledger: Ledger;
  onSave: (value: Record<string, unknown>) => Promise<void>;
}) {
  const entry = item as Entry | undefined,
    account = item as Account | undefined,
    category = item as Category | undefined;
  const [error, setError] = useState("");
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:
        type === "entry"
          ? entry?.description
          : item && "name" in item
            ? item.name
            : "",
      value: (
        ((type === "account" ? account?.initial_cents : entry?.amount_cents) ??
          0) / 100
      ).toFixed(2),
      date:
        (type === "account" ? account?.initial_date : entry?.due_date) ||
        today(),
      color: item && "color" in item ? item.color : "#267dba",
      kind:
        type === "category"
          ? category?.kind || "expense"
          : entry?.kind || "expense",
      account:
        entry?.account_id || ledger.accounts.find((a) => !a.archived)?.id || "",
      destination: entry?.destination_id || "",
      category: entry?.category_id || "",
      paid: !!entry?.paid_date,
      paidDate: entry?.paid_date || today(),
      notes: entry?.notes || "",
      icon: category?.icon || "wallet",
    },
  });
  const kind = watch("kind"),
    paid = watch("paid");
  async function submit(v: Values) {
    setError("");
    try {
      let data: Record<string, unknown>;
      if (type === "account") {
        const amount = cents(v.value);
        if (
          item &&
          ledger.entries.some(
            (e) =>
              (e.account_id === item.id || e.destination_id === item.id) &&
              (e.due_date < v.date || (!!e.paid_date && e.paid_date < v.date)),
          )
        )
          throw new Error(
            "A data inicial não pode ficar depois de movimentações existentes.",
          );
        data = {
          name: v.name,
          initial_cents: amount,
          initial_date: v.date,
          color: v.color,
        };
      } else if (type === "category") {
        if (v.kind === "transfer")
          throw new Error("Selecione receita ou despesa.");
        if (
          item &&
          ledger.entries.some(
            (e) => e.category_id === item.id && e.kind !== v.kind,
          )
        )
          throw new Error(
            "Não é possível alterar o tipo de uma categoria utilizada.",
          );
        data = { name: v.name, kind: v.kind, color: v.color, icon: v.icon };
      } else {
        const amount = cents(v.value);
        if (amount <= 0) throw new Error("O valor deve ser maior que zero.");
        const source = ledger.accounts.find((a) => a.id === v.account);
        if (!source) throw new Error("Selecione uma conta.");
        if (
          kind === "transfer" &&
          (!v.destination || v.destination === v.account)
        )
          throw new Error("Escolha uma conta de destino diferente.");
        if (
          kind !== "transfer" &&
          !ledger.categories.some((c) => c.id === v.category && c.kind === kind)
        )
          throw new Error("Selecione uma categoria do mesmo tipo.");
        for (const a of ledger.accounts.filter(
          (a) =>
            a.id === v.account ||
            (kind === "transfer" && a.id === v.destination),
        )) {
          if (
            v.date < a.initial_date ||
            (v.paid && v.paidDate < a.initial_date)
          )
            throw new Error(
              "A movimentação não pode ser anterior ao saldo inicial da conta.",
            );
        }
        if (v.paid && v.paidDate > today())
          throw new Error("A data de pagamento não pode estar no futuro.");
        data = {
          description: v.name,
          kind,
          amount_cents: amount,
          account_id: v.account,
          destination_id: kind === "transfer" ? v.destination : null,
          category_id: kind === "transfer" ? null : v.category,
          due_date: v.date,
          paid_date: v.paid ? v.paidDate : null,
          notes: v.notes,
        };
      }
      await onSave(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="form-grid">
      <label className="full">
        {type === "entry" ? "Descrição" : "Nome"}
        <input
          autoFocus
          maxLength={100}
          {...register("name")}
          placeholder={type === "entry" ? "Ex.: compras do mês" : "Dê um nome"}
        />
        {errors.name && <small className="error">{errors.name.message}</small>}
      </label>
      {type !== "account" && (
        <label>
          Tipo
          <select
            {...register("kind", { onChange: () => setValue("category", "") })}
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
            {type === "entry" && (
              <option value="transfer">Transferência</option>
            )}
          </select>
        </label>
      )}
      {type !== "category" && (
        <>
          <label>
            {type === "account" ? "Saldo inicial (R$)" : "Valor (R$)"}
            <input
              {...register("value")}
              inputMode="decimal"
              placeholder="0,00"
              required
            />
          </label>
          <label>
            {type === "account" ? "Data do saldo inicial" : "Vencimento"}
            <input type="date" {...register("date")} required />
          </label>
        </>
      )}
      {type === "entry" ? (
        <>
          <label>
            Conta de origem
            <select {...register("account")} required>
              <option value="">Selecione</option>
              {ledger.accounts
                .filter((a) => !a.archived || a.id === entry?.account_id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          {kind === "transfer" ? (
            <label>
              Conta de destino
              <select {...register("destination")} required>
                <option value="">Selecione</option>
                {ledger.accounts
                  .filter((a) => !a.archived || a.id === entry?.destination_id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <label>
              Categoria
              <select {...register("category")} required>
                <option value="">Selecione</option>
                {ledger.categories
                  .filter(
                    (c) =>
                      c.kind === kind &&
                      (!c.archived || c.id === entry?.category_id),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="check full">
            <input type="checkbox" {...register("paid")} /> Já foi{" "}
            {kind === "income" ? "recebido" : "pago"}
          </label>
          {paid && (
            <label>
              Data da efetivação
              <input
                type="date"
                {...register("paidDate")}
                max={today()}
                required
              />
            </label>
          )}
          <label className="full">
            Observações
            <textarea
              {...register("notes")}
              rows={3}
              maxLength={2000}
              placeholder="Algo que você quer lembrar…"
            />
            {errors.notes && (
              <small className="error">{errors.notes.message}</small>
            )}
          </label>
        </>
      ) : (
        <label>
          Cor
          <input type="color" {...register("color")} />
        </label>
      )}
      {type === "category" && (
        <label>
          Ícone
          <select {...register("icon")}>
            <option value="wallet">Carteira</option>
            <option value="home">Casa</option>
            <option value="utensils">Alimentação</option>
            <option value="car">Transporte</option>
            <option value="coffee">Lazer</option>
            <option value="heart">Saúde</option>
            <option value="book">Educação</option>
          </select>
        </label>
      )}
      {error && (
        <div className="notice error full" role="alert">
          {error}
        </div>
      )}
      <Button className="full" disabled={isSubmitting}>
        {isSubmitting
          ? "Salvando…"
          : "Salvar " +
            (type === "entry"
              ? "lançamento"
              : type === "account"
                ? "conta"
                : "categoria")}
      </Button>
    </form>
  );
}
