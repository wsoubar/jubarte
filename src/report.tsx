import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Image,
  Svg,
  Rect,
} from "@react-pdf/renderer";
import type { Filters, Ledger } from "./types";
import { withLoanEntries } from "./loans";
import {
  balance,
  categoryTotals,
  dateLabel,
  money,
  monthly,
  selectEntries,
  totals,
} from "./finance";
const s = StyleSheet.create({
  page: {
    padding: 36,
    paddingBottom: 55,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#243b53",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  logo: { width: 42, height: 42 },
  brandName: { fontSize: 24, color: "#123c61", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 19, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  muted: { color: "#6d7e8f", fontSize: 8, lineHeight: 1.6 },
  summary: { flexDirection: "row", gap: 10, marginVertical: 18 },
  card: { padding: 12, backgroundColor: "#f1f7f8", flex: 1, borderRadius: 5 },
  value: { fontSize: 13, marginTop: 6, fontFamily: "Helvetica-Bold" },
  section: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    borderBottom: "1px solid #e8edf1",
    paddingVertical: 8,
  },
  head: {
    backgroundColor: "#edf4f7",
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 4,
  },
  cell: { width: "20%", paddingRight: 6, lineHeight: 1.5 },
  description: { width: "32%", paddingRight: 6, lineHeight: 1.5 },
  small: { width: "16%", paddingRight: 6, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#7c8a98",
    fontSize: 8,
  },
  barLabel: { width: "30%" },
  barAmount: { width: "25%", textAlign: "right" },
  note: { marginTop: 12, fontSize: 8, color: "#6d7e8f", lineHeight: 1.5 },
});
export function Report({
  ledger: sourceLedger,
  filters,
  generatedAt,
}: {
  ledger: Ledger;
  filters: Filters;
  generatedAt: string;
}) {
  const ledger = withLoanEntries(sourceLedger);
  const entries = selectEntries(ledger.entries, filters),
    t = totals(entries),
    accounts = ledger.accounts.filter(
      (a) => !filters.account || a.id === filters.account,
    ),
    real = accounts.reduce(
      (n, a) => n + balance(a, ledger.entries, filters.end),
      0,
    ),
    predicted = accounts.reduce(
      (n, a) => n + balance(a, ledger.entries, filters.end, true),
      0,
    ),
    cats = categoryTotals(ledger, entries).filter((c) => c.kind === "expense"),
    months = monthly(ledger, filters);
  const selectedAccount =
      ledger.accounts.find((a) => a.id === filters.account)?.name || "Todas",
    selectedCategory =
      ledger.categories.find((c) => c.id === filters.category)?.name || "Todas";
  return (
    <Document title="Jubarte - Relatório financeiro" author="Jubarte">
      <Page size="A4" style={s.page}>
        <View style={s.brand}>
          <Image style={s.logo} src={import.meta.env.BASE_URL + "logo.png"} />
          <Text style={s.brandName}>jubarte.</Text>
        </View>
        <Text style={s.title}>Seu relatório financeiro</Text>
        <Text>
          {dateLabel(filters.start)} a {dateLabel(filters.end)}
        </Text>
        <Text style={s.muted}>
          Contas: {selectedAccount} | Categoria: {selectedCategory} | Situação:{" "}
          {filters.status === "paid"
            ? "Efetivados"
            : filters.status === "pending"
              ? "Pendentes"
              : "Todas"}
        </Text>
        {filters.search && <Text style={s.muted}>Busca: {filters.search}</Text>}
        <Text style={s.muted}>
          Gerado em {generatedAt} · Valores em reais (BRL)
        </Text>
        <View style={s.summary}>
          {[
            ["Saldo realizado", real],
            ["Receitas", t.income],
            ["Despesas", t.expense],
            ["Saldo previsto", predicted],
          ].map(([label, value]) => (
            <View key={label} style={s.card}>
              <Text style={s.muted}>{label}</Text>
              <Text style={s.value}>{money(Number(value))}</Text>
            </View>
          ))}
        </View>
        <Text style={s.note}>
          Valores realizados usam a data de pagamento; pendências usam o
          vencimento. Transferências, empréstimos e seus recebimentos não entram
          em receitas e despesas. Saldos incluem todo o histórico das contas
          selecionadas até a data final, independentemente dos filtros de
          categoria, situação e busca.
        </Text>
        <Text style={s.section}>Despesas por categoria</Text>
        {!cats.length && (
          <Text style={s.muted}>
            Nenhuma despesa paga para os filtros selecionados.
          </Text>
        )}
        {cats.map((c) => (
          <View key={c.id} style={s.row} wrap={false}>
            <Text style={s.barLabel}>{c.name}</Text>
            <Svg width={180} height={12}>
              <Rect x={0} y={0} width={180} height={10} rx={3} fill="#edf1f5" />
              <Rect
                x={0}
                y={0}
                width={Math.max(1, (c.value / Math.max(t.expense, 1)) * 180)}
                height={10}
                rx={3}
                fill={c.color}
              />
            </Svg>
            <Text style={s.barAmount}>
              {money(c.value)} (
              {Math.round((c.value / Math.max(t.expense, 1)) * 100)}%)
            </Text>
          </View>
        ))}
        <Text style={s.section}>Comparativo mensal e evolução patrimonial</Text>
        <View style={[s.row, s.head]} wrap={false}>
          {["Mês", "Receitas", "Despesas", "Resultado", "Saldo"].map((x) => (
            <Text key={x} style={s.cell}>
              {x}
            </Text>
          ))}
        </View>
        {months.map((m) => (
          <View key={m.month} style={s.row} wrap={false}>
            {[
              m.label,
              money(m.income),
              money(m.expense),
              money(m.income - m.expense),
              money(m.balance),
            ].map((x, i) => (
              <Text key={i} style={s.cell}>
                {x}
              </Text>
            ))}
          </View>
        ))}
        <Text style={s.section}>Saldo por conta na data final</Text>
        {accounts.map((a) => (
          <View key={a.id} style={s.row} wrap={false}>
            <Text style={{ width: "50%" }}>
              {a.name}
              {a.archived ? " (arquivada)" : ""}
            </Text>
            <Text style={{ width: "25%" }}>
              {money(balance(a, ledger.entries, filters.end))}
            </Text>
            <Text style={{ width: "25%" }}>
              Previsto: {money(balance(a, ledger.entries, filters.end, true))}
            </Text>
          </View>
        ))}
        <View fixed style={s.footer}>
          <Text>Jubarte · Relatório pessoal e confidencial</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
      <Page size="A4" style={s.page}>
        <View fixed>
          <Text style={s.title}>Detalhamento dos lançamentos</Text>
          <Text style={s.muted}>
            {dateLabel(filters.start)} a {dateLabel(filters.end)} ·{" "}
            {entries.length} lançamento(s)
          </Text>
          <View style={[s.row, s.head]}>
            <Text style={s.description}>Descrição / categoria</Text>
            <Text style={s.cell}>Conta</Text>
            <Text style={s.small}>Data</Text>
            <Text style={s.small}>Situação</Text>
            <Text style={s.small}>Valor</Text>
          </View>
        </View>
        {!entries.length && (
          <Text style={s.note}>
            Nenhum lançamento para os filtros selecionados.
          </Text>
        )}
        {entries.map((e) => (
          <View style={s.row} key={e.id}>
            <View style={s.description}>
              <Text>{e.description}</Text>
              <Text style={s.muted}>
                {e.kind === "transfer"
                  ? "Transferência"
                  : e.kind === "loan_out"
                    ? "Empréstimo concedido"
                    : e.kind === "loan_in"
                      ? "Recebimento de empréstimo"
                      : ledger.categories.find((c) => c.id === e.category_id)
                          ?.name}
              </Text>
              {e.notes && <Text style={s.muted}>{e.notes}</Text>}
            </View>
            <Text style={s.cell}>
              {ledger.accounts.find((a) => a.id === e.account_id)?.name}
              {e.destination_id
                ? " → " +
                  ledger.accounts.find((a) => a.id === e.destination_id)?.name
                : ""}
            </Text>
            <Text style={s.small}>{dateLabel(e.paid_date || e.due_date)}</Text>
            <Text style={s.small}>
              {e.paid_date ? "Efetivado" : "Pendente"}
            </Text>
            <Text style={s.small}>
              {e.kind === "expense" || e.kind === "loan_out"
                ? "- "
                : e.kind === "income" || e.kind === "loan_in"
                  ? "+ "
                  : ""}
              {money(e.amount_cents)}
            </Text>
          </View>
        ))}
        <View fixed style={s.footer}>
          <Text>Jubarte · Relatório pessoal e confidencial</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
export async function downloadReport(ledger: Ledger, filters: Filters) {
  if (!filters.start || !filters.end || filters.start > filters.end)
    throw new Error("Período inválido");
  const blob = await pdf(
    <Report
      ledger={ledger}
      filters={filters}
      generatedAt={new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date())}
    />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `jubarte-${filters.start}-${filters.end}.pdf`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
