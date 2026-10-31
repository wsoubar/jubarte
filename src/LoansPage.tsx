import { useState, type FormEvent } from "react";
import {
  Plus,
  Users,
  Building2,
  UserRound,
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Archive,
  Trash2,
  LockKeyhole,
  RotateCcw,
} from "lucide-react";
import type { Debtor, Ledger, Loan, LoanReceipt } from "./types";
import { cents, dateLabel, money, today } from "./finance";
import { loanSummary } from "./loans";
import { Button } from "./components/ui/button";
import { Modal } from "./components/ui/dialog";

export type LoanWrite = (
  type: "debtor" | "loan" | "receipt",
  values: Record<string, unknown>,
  id?: string,
  remove?: boolean,
) => Promise<void>;
type EditorState = {
  kind: "debtor" | "loan" | "receipt" | "close";
  item?: Debtor | Loan | LoanReceipt;
  debtorId?: string;
  loanId?: string;
};

export function LoansPage({
  ledger,
  onWrite,
  focusLoanId,
}: {
  ledger: Ledger;
  onWrite: LoanWrite;
  focusLoanId?: string;
}) {
  const debtors = ledger.debtors || [],
    loans = ledger.loans || [],
    receipts = ledger.receipts || [];
  const [selectedId, setSelectedId] = useState(
    () =>
      loans.find((l) => l.id === focusLoanId)?.debtor_id ||
      debtors.find((d) => !d.archived)?.id ||
      debtors[0]?.id ||
      "",
  );
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    text: string;
    run: () => Promise<void>;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const selected =
    debtors.find((d) => d.id === selectedId) ||
    debtors.find((d) => !d.archived) ||
    debtors[0];
  const summaries = loans.map((loan) => ({
    loan,
    ...loanSummary(loan, receipts),
  }));
  const sum = (key: "received" | "outstanding" | "unrecovered" | "extra") =>
    summaries.reduce((s, l) => s + l[key], 0);
  const visibleDebtors = debtors.filter(
    (d) =>
      (showArchived || !d.archived) &&
      d.name
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const ownLoans = loans
    .filter(
      (l) =>
        l.debtor_id === selected?.id &&
        (status === "all" ||
          (status === "closed"
            ? l.closed
            : status === "open"
              ? !l.closed
              : !l.closed &&
                !!l.due_date &&
                l.due_date < today() &&
                loanSummary(l, receipts).remaining > 0)),
    )
    .sort((a, b) =>
      a.id === focusLoanId
        ? -1
        : b.id === focusLoanId
          ? 1
          : b.date.localeCompare(a.date),
    );

  function confirm(title: string, text: string, run: () => Promise<void>) {
    setError("");
    setConfirmation({ title, text, run });
  }

  return (
    <div className="loans-module">
      <div className="loan-overview">
        {[
          ["Total emprestado", loans.reduce((s, l) => s + l.amount_cents, 0)],
          ["Total recebido", sum("received")],
          ["A receber · abertos", sum("outstanding")],
          ["Não recuperado · fechados", sum("unrecovered")],
          ["Recebido a mais", sum("extra")],
        ].map(([label, value]) => (
          <section className="panel loan-metric" key={label}>
            <span>{label}</span>
            <strong>{money(Number(value))}</strong>
          </section>
        ))}
      </div>
      <p className="notice">
        Empréstimos e recebimentos afetam os saldos das contas e ficam separados
        das receitas e despesas. Os totais do módulo consideram todo o
        histórico, sem filtro de período. Fechar um empréstimo não movimenta
        dinheiro.
      </p>
      <div className="debtors-layout">
        <section className="panel debtors-list" aria-label="Lista de devedores">
          <div className="panel-heading">
            <h2>
              Devedores <span className="count">{debtors.length}</span>
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Novo devedor"
              onClick={() => setEditor({ kind: "debtor" })}
            >
              <Plus size={18} />
            </Button>
          </div>
          <div className="debtor-search">
            <label>
              Buscar devedor
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pessoa ou empresa"
              />
            </label>
            <label className="loan-check">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />{" "}
              Mostrar arquivados
            </label>
          </div>
          {!visibleDebtors.length && (
            <div className="empty-state">
              <Users size={28} />
              <p>
                Nenhum devedor encontrado. Cadastre uma pessoa ou empresa para
                começar.
              </p>
              <Button onClick={() => setEditor({ kind: "debtor" })}>
                Cadastrar devedor
              </Button>
            </div>
          )}
          {visibleDebtors.map((d) => {
            const outstanding = summaries
              .filter((s) => s.loan.debtor_id === d.id)
              .reduce((sum, s) => sum + s.outstanding, 0);
            return (
              <button
                key={d.id}
                type="button"
                className={
                  "debtor-option " + (d.id === selected?.id ? "selected" : "")
                }
                aria-pressed={d.id === selected?.id}
                onClick={() => setSelectedId(d.id)}
              >
                {d.kind === "company" ? (
                  <Building2 size={20} />
                ) : (
                  <UserRound size={20} />
                )}
                <span>
                  <strong>{d.name}</strong>
                  <small>
                    {d.archived
                      ? "Arquivado"
                      : d.kind === "company"
                        ? "Empresa"
                        : "Pessoa"}{" "}
                    · A receber {money(outstanding)}
                  </small>
                </span>
              </button>
            );
          })}
        </section>
        <div className="debtor-detail">
          {!selected ? (
            <section className="panel empty-state">
              <Users size={30} />
              <h2>Um histórico para cada acordo</h2>
              <p>
                Selecione ou cadastre um devedor para registrar empréstimos e
                recebimentos.
              </p>
            </section>
          ) : (
            <>
              <section className="panel debtor-profile">
                <div>
                  <span className="eyebrow">
                    {selected.kind === "person" ? "PESSOA" : "EMPRESA"}
                    {selected.archived ? " · ARQUIVADO" : ""}
                  </span>
                  <h2>{selected.name}</h2>
                  {selected.phone && <p>{selected.phone}</p>}
                  {selected.notes && (
                    <p className="loan-notes">{selected.notes}</p>
                  )}
                </div>
                <div className="loan-actions">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setEditor({ kind: "debtor", item: selected })
                    }
                  >
                    <Pencil size={14} /> Editar devedor
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      confirm(
                        selected.archived
                          ? "Restaurar devedor"
                          : "Arquivar devedor",
                        "O histórico e os recebimentos dos empréstimos existentes serão preservados.",
                        () =>
                          onWrite(
                            "debtor",
                            { archived: !selected.archived },
                            selected.id,
                          ),
                      )
                    }
                  >
                    <Archive size={14} />
                    {selected.archived ? "Restaurar" : "Arquivar"}
                  </Button>
                  {!selected.archived && (
                    <Button
                      onClick={() =>
                        setEditor({ kind: "loan", debtorId: selected.id })
                      }
                    >
                      <Plus size={16} /> Novo empréstimo
                    </Button>
                  )}
                </div>
              </section>
              <div className="loan-list-heading">
                <h2>Empréstimos de {selected.name}</h2>
                <label>
                  <span className="sr-only">Situação dos empréstimos</span>
                  <select
                    aria-label="Situação dos empréstimos"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">Todos</option>
                    <option value="open">Abertos</option>
                    <option value="closed">Fechados</option>
                    <option value="overdue">Atrasados</option>
                  </select>
                </label>
              </div>
              {!ownLoans.length && (
                <section className="panel empty-state">
                  <p>Nenhum empréstimo para esta seleção.</p>
                </section>
              )}
              {ownLoans.map((loan) => {
                const summary = loanSummary(loan, receipts);
                const payments = receipts
                  .filter((r) => r.loan_id === loan.id)
                  .sort((a, b) => a.date.localeCompare(b.date));
                const overdue =
                  !loan.closed &&
                  summary.remaining > 0 &&
                  !!loan.due_date &&
                  loan.due_date < today();
                return (
                  <article
                    className="panel loan-card"
                    key={loan.id}
                    aria-label={"Empréstimo de " + money(loan.amount_cents)}
                  >
                    <div className="loan-card-heading">
                      <div>
                        <span
                          className={
                            "pill " +
                            (loan.closed
                              ? "paid"
                              : overdue
                                ? "overdue"
                                : "pending")
                          }
                        >
                          {loan.closed
                            ? "Fechado"
                            : overdue
                              ? "Atrasado"
                              : "Aberto"}
                        </span>
                        <h3>{money(loan.amount_cents)}</h3>
                        <p>
                          <ArrowUpRight size={14} /> {dateLabel(loan.date)} ·{" "}
                          {
                            ledger.accounts.find(
                              (a) => a.id === loan.account_id,
                            )?.name
                          }
                        </p>
                        {loan.due_date && (
                          <p>Vencimento: {dateLabel(loan.due_date)}</p>
                        )}
                      </div>
                      <div className="loan-actions">
                        {loan.closed ? (
                          <Button
                            variant="outline"
                            onClick={() =>
                              confirm(
                                "Reabrir empréstimo",
                                "O saldo não recuperado voltará a compor o total a receber. Nenhum lançamento será criado.",
                                () =>
                                  onWrite(
                                    "loan",
                                    {
                                      closed: false,
                                      closed_date: null,
                                      closing_notes: "",
                                    },
                                    loan.id,
                                  ),
                              )
                            }
                          >
                            <RotateCcw size={14} /> Reabrir empréstimo
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setEditor({ kind: "receipt", loanId: loan.id })
                              }
                            >
                              <ArrowDownLeft size={15} /> Registrar recebimento
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setEditor({
                                  kind: "loan",
                                  item: loan,
                                  debtorId: selected.id,
                                })
                              }
                            >
                              <Pencil size={14} /> Editar empréstimo
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setEditor({
                                  kind: "close",
                                  item: loan,
                                  loanId: loan.id,
                                })
                              }
                            >
                              <LockKeyhole size={14} /> Fechar empréstimo
                            </Button>
                            <Button
                              variant="ghost"
                              disabled={payments.length > 0}
                              title={
                                payments.length
                                  ? "Exclua os recebimentos antes de excluir o empréstimo."
                                  : "Excluir empréstimo"
                              }
                              onClick={() =>
                                confirm(
                                  "Excluir empréstimo",
                                  "A saída será removida do histórico e o saldo da conta será recalculado. Esta ação não pode ser desfeita.",
                                  () => onWrite("loan", {}, loan.id, true),
                                )
                              }
                            >
                              <Trash2 size={14} /> Excluir empréstimo
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {loan.notes && <p className="loan-notes">{loan.notes}</p>}
                    <dl className="loan-values">
                      <div>
                        <dt>Recebido</dt>
                        <dd>{money(summary.received)}</dd>
                      </div>
                      <div>
                        <dt>{loan.closed ? "Não recuperado" : "A receber"}</dt>
                        <dd>
                          {money(
                            loan.closed
                              ? summary.unrecovered
                              : summary.outstanding,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Recebido a mais</dt>
                        <dd>{money(summary.extra)}</dd>
                      </div>
                    </dl>
                    {loan.closed && (
                      <p className="notice">
                        Fechado manualmente
                        {loan.closed_date
                          ? " em " + dateLabel(loan.closed_date)
                          : ""}
                        .{loan.closing_notes && " " + loan.closing_notes} Reabra
                        para corrigir ou adicionar recebimentos.
                      </p>
                    )}
                    {!loan.closed && summary.remaining === 0 && (
                      <p className="notice">
                        O valor emprestado já foi coberto. Você ainda pode
                        registrar recebimentos ou fechar o empréstimo
                        manualmente.
                      </p>
                    )}
                    <h4>Histórico de recebimentos</h4>
                    {!payments.length ? (
                      <p className="muted">Nenhum recebimento registrado.</p>
                    ) : (
                      <ul className="loan-receipts">
                        {payments.map((receipt) => (
                          <li key={receipt.id}>
                            <ArrowDownLeft size={18} />
                            <div>
                              <strong>{money(receipt.amount_cents)}</strong>
                              <small>
                                {dateLabel(receipt.date)} ·{" "}
                                {
                                  ledger.accounts.find(
                                    (a) => a.id === receipt.account_id,
                                  )?.name
                                }
                              </small>
                              {receipt.notes && (
                                <p className="loan-notes">{receipt.notes}</p>
                              )}
                            </div>
                            {!loan.closed && (
                              <div className="loan-actions">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={
                                    "Editar recebimento de " +
                                    money(receipt.amount_cents)
                                  }
                                  onClick={() =>
                                    setEditor({
                                      kind: "receipt",
                                      item: receipt,
                                      loanId: loan.id,
                                    })
                                  }
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={
                                    "Excluir recebimento de " +
                                    money(receipt.amount_cents)
                                  }
                                  onClick={() =>
                                    confirm(
                                      "Excluir recebimento",
                                      "A entrada será removida do histórico e o saldo da conta será recalculado.",
                                      () =>
                                        onWrite(
                                          "receipt",
                                          {},
                                          receipt.id,
                                          true,
                                        ),
                                    )
                                  }
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </>
          )}
        </div>
      </div>
      <Modal
        title={
          editor
            ? editor.kind === "close"
              ? "Fechar empréstimo"
              : (editor.item
                  ? "Editar "
                  : editor.kind === "loan"
                    ? "Novo "
                    : "Novo ") +
                (editor.kind === "debtor"
                  ? "devedor"
                  : editor.kind === "loan"
                    ? "empréstimo"
                    : "recebimento")
            : ""
        }
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        {editor && (
          <LoanForm
            key={editor.kind + (editor.item?.id || "new")}
            state={editor}
            ledger={ledger}
            onSave={async (values) => {
              const newDebtorId =
                editor.kind === "debtor" && !editor.item
                  ? crypto.randomUUID()
                  : undefined;
              await onWrite(
                editor.kind === "close" ? "loan" : editor.kind,
                newDebtorId ? { ...values, id: newDebtorId } : values,
                editor.item?.id,
              );
              if (newDebtorId) setSelectedId(newDebtorId);
              setEditor(null);
            }}
          />
        )}
      </Modal>
      <Modal
        title={confirmation?.title || ""}
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null);
        }}
      >
        <p>{confirmation?.text}</p>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="confirm-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setConfirmation(null)}
          >
            Cancelar
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await confirmation?.run();
                setConfirmation(null);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Não foi possível concluir.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Aguarde…" : "Confirmar"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function LoanForm({
  state,
  ledger,
  onSave,
}: {
  state: EditorState;
  ledger: Ledger;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const debtor = state.item as Debtor | undefined,
    loan = state.item as Loan | undefined,
    receipt = state.item as LoanReceipt | undefined;
  const parent =
    state.kind === "close"
      ? loan
      : ledger.loans?.find((l) => l.id === state.loanId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget),
      text = (name: string) => String(form.get(name) || "").trim();
    try {
      let values: Record<string, unknown>;
      if (state.kind === "debtor") {
        if (!text("name")) throw new Error("Informe o nome.");
        values = {
          name: text("name"),
          kind: text("kind"),
          phone: text("phone"),
          notes: text("notes"),
          archived: debtor?.archived || false,
        };
      } else if (state.kind === "close") {
        const date = text("closed_date");
        if (
          date &&
          (date < parent!.date ||
            date > today() ||
            ledger.receipts?.some(
              (r) => r.loan_id === parent!.id && r.date > date,
            ))
        )
          throw new Error(
            "O fechamento deve estar entre a última movimentação do empréstimo e hoje.",
          );
        values = {
          closed: true,
          closed_date: date || null,
          closing_notes: text("closing_notes"),
        };
      } else {
        const amount = cents(text("amount")),
          date = text("date"),
          account = ledger.accounts.find((a) => a.id === text("account"));
        if (amount <= 0) throw new Error("O valor deve ser maior que zero.");
        if (
          !account ||
          (account.archived &&
            account.id !==
              (state.item && "account_id" in state.item
                ? state.item.account_id
                : undefined))
        )
          throw new Error("Selecione uma conta ativa.");
        if (!date || date > today() || date < account.initial_date)
          throw new Error(
            "A data deve estar entre o saldo inicial da conta e hoje.",
          );
        values = {
          amount_cents: amount,
          date,
          account_id: account.id,
          notes: text("notes"),
        };
        if (state.kind === "loan") {
          const due = text("due_date");
          if (due && due < date)
            throw new Error(
              "O vencimento não pode ser anterior ao empréstimo.",
            );
          if (
            ledger.receipts?.some(
              (r) => r.loan_id === loan?.id && r.date < date,
            )
          )
            throw new Error(
              "A saída não pode ser posterior aos recebimentos existentes.",
            );
          values = {
            ...values,
            debtor_id: state.debtorId,
            due_date: due || null,
            closed: false,
            closed_date: null,
            closing_notes: "",
          };
        } else {
          if (!parent || parent.closed || date < parent.date)
            throw new Error(
              "Escolha uma data a partir da saída de um empréstimo aberto.",
            );
          values.loan_id = parent.id;
        }
      }
      await onSave(values);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-grid" onSubmit={submit}>
      {state.kind === "debtor" ? (
        <>
          <label className="full">
            Nome
            <input
              name="name"
              autoFocus
              required
              maxLength={100}
              defaultValue={debtor?.name || ""}
            />
          </label>
          <label>
            Tipo
            <select
              name="kind"
              aria-label="Tipo de devedor"
              defaultValue={debtor?.kind || "person"}
            >
              <option value="person">Pessoa</option>
              <option value="company">Empresa</option>
            </select>
          </label>
          <label>
            Telefone
            <input
              name="phone"
              type="tel"
              maxLength={50}
              defaultValue={debtor?.phone || ""}
            />
          </label>
        </>
      ) : state.kind === "close" ? (
        <>
          <p className="notice full">
            Você pode fechar com qualquer valor recebido. Nenhuma movimentação
            de ajuste será criada. O histórico será preservado.
          </p>
          <label className="full">
            Data do fechamento (opcional)
            <input
              name="closed_date"
              type="date"
              min={parent?.date}
              max={today()}
              defaultValue={today()}
            />
          </label>
          <label className="full">
            Observação do fechamento
            <textarea name="closing_notes" maxLength={2000} rows={3} />
          </label>
        </>
      ) : (
        <>
          <label>
            Valor (R$)
            <input
              name="amount"
              autoFocus
              required
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={
                state.item
                  ? (
                      (loan?.amount_cents || receipt?.amount_cents || 0) / 100
                    ).toFixed(2)
                  : ""
              }
            />
          </label>
          <label>
            {state.kind === "loan"
              ? "Data do empréstimo"
              : "Data do recebimento"}
            <input
              name="date"
              type="date"
              required
              max={today()}
              defaultValue={loan?.date || receipt?.date || today()}
            />
          </label>
          <label className="full">
            {state.kind === "loan" ? "Conta de saída" : "Conta de entrada"}
            <select
              name="account"
              required
              defaultValue={loan?.account_id || receipt?.account_id || ""}
            >
              <option value="">Selecione a conta</option>
              {ledger.accounts
                .filter(
                  (a) =>
                    !a.archived ||
                    a.id === loan?.account_id ||
                    a.id === receipt?.account_id,
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.archived ? " (arquivada)" : ""}
                  </option>
                ))}
            </select>
          </label>
          {state.kind === "loan" && (
            <label className="full">
              Vencimento (opcional)
              <input
                name="due_date"
                type="date"
                defaultValue={loan?.due_date || ""}
              />
            </label>
          )}
          {state.kind === "receipt" && (
            <p className="notice full">
              Cada recebimento pode entrar em uma conta diferente. O total
              recebido pode ultrapassar o valor emprestado.
            </p>
          )}
        </>
      )}
      {state.kind !== "close" && (
        <label className="full">
          Observações
          <textarea
            name="notes"
            maxLength={2000}
            rows={3}
            defaultValue={state.item?.notes || ""}
          />
        </label>
      )}
      {error && (
        <div className="notice error full" role="alert">
          {error}
        </div>
      )}
      <Button className="full" disabled={busy}>
        {busy
          ? "Salvando…"
          : state.kind === "close"
            ? "Confirmar fechamento"
            : "Salvar " +
              (state.kind === "debtor"
                ? "devedor"
                : state.kind === "loan"
                  ? "empréstimo"
                  : "recebimento")}
      </Button>
    </form>
  );
}
