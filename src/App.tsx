import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  ChartNoAxesCombined,
  Settings,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Download,
  Search,
  SlidersHorizontal,
  MoreHorizontal,
  Check,
  Archive,
  Trash2,
  Pencil,
  ArrowRightLeft,
  TrendingUp,
  ShieldCheck,
  Waves,
  Home,
  Utensils,
  Car,
  Coffee,
  Heart,
  BookOpen,
} from "lucide-react";
import { supabase } from "./supabase";
import { Auth } from "./Auth";
import { ThemePicker, ThemeToggle } from "./theme";
import { loadLedger } from "./data";
import { demoLedger } from "./demo";
import {
  balance,
  categoryTotals,
  dateLabel,
  money,
  monthBounds,
  monthly,
  selectEntries,
  today,
  totals,
} from "./finance";
import type { Account, Category, Entry, Filters, Ledger } from "./types";
import { Button } from "./components/ui/button";
import { Modal } from "./components/ui/dialog";
import { Editor } from "./forms";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
const nav = [
  ["/", "Visão geral", LayoutDashboard],
  ["/lancamentos", "Lançamentos", ArrowLeftRight],
  ["/contas", "Minhas contas", Wallet],
  ["/categorias", "Categorias", Tags],
  ["/relatorios", "Relatórios", ChartNoAxesCombined],
  ["/configuracoes", "Configurações", Settings],
] as const;
const iconMap: Record<string, typeof Wallet> = {
  wallet: Wallet,
  home: Home,
  utensils: Utensils,
  car: Car,
  coffee: Coffee,
  heart: Heart,
  book: BookOpen,
};
function Brand() {
  return (
    <div className="brand">
      <img
        src={import.meta.env.BASE_URL + "logo.png"}
        alt="Baleia jubarte saltando"
      />
      <span>
        jubarte<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
const emptyLedger: Ledger = { accounts: [], categories: [], entries: [] };
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(!supabase),
    [demo, setDemo] = useState(false),
    [recovery, setRecovery] = useState(false),
    [authError, setAuthError] = useState("");
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(error.message);
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        setRecovery(false);
        queryClient.clear();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
  if (!ready)
    return <div className="center-screen">Preparando seu espaço…</div>;
  if (authError)
    return (
      <div className="center-screen">
        <p role="alert">{authError}</p>
        <Button onClick={() => window.location.reload()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (recovery)
    return (
      <Auth onDemo={() => {}} recovery onRecovered={() => setRecovery(false)} />
    );
  if (!session && !demo) return <Auth onDemo={() => setDemo(true)} />;
  return (
    <Workspace
      demo={demo}
      userId={session?.user.id || "demo"}
      email={session?.user.email || "Demonstração"}
      onExit={async () => {
        setDemo(false);
        if (session) await supabase!.auth.signOut();
      }}
    />
  );
}
function Workspace({
  demo,
  userId,
  email,
  onExit,
}: {
  demo: boolean;
  userId: string;
  email: string;
  onExit: () => void;
}) {
  const client = useQueryClient(),
    location = useLocation();
  const [demoData, setDemoData] = useState(demoLedger),
    [openNav, setOpenNav] = useState(false),
    [notice, setNotice] = useState(""),
    [working, setWorking] = useState(false);
  const [editor, setEditor] = useState<{
    type: "account" | "category" | "entry";
    item?: Account | Category | Entry;
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
  } | null>(null);
  const [filters, setFilters] = useState<Filters>({
    ...monthBounds(),
    account: "",
    category: "",
    status: "",
    search: "",
  });
  const [page, setPage] = useState(1);
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["ledger", userId],
    queryFn: loadLedger,
    enabled: !demo,
  });
  const ledger = demo ? demoData : data || emptyLedger;
  const section =
    nav.find((n) => n[0] === location.pathname)?.[1] || "Visão geral";
  useEffect(() => {
    setPage(1);
  }, [filters]);
  useEffect(() => {
    setOpenNav(false);
  }, [location]);
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(id);
    }
  }, [notice]);
  const rows = selectEntries(ledger.entries, filters),
    sum = totals(rows),
    activeAccounts = ledger.accounts.filter((a) => !a.archived),
    accountsForBalance = ledger.accounts.filter(
      (a) => !filters.account || a.id === filters.account,
    ),
    real = accountsForBalance.reduce(
      (s, a) => s + balance(a, ledger.entries, filters.end),
      0,
    ),
    projected = accountsForBalance.reduce(
      (s, a) => s + balance(a, ledger.entries, filters.end, true),
      0,
    ),
    cats = categoryTotals(ledger, rows).filter((c) => c.kind === "expense"),
    months = monthly(ledger, filters);
  const isDashboard = location.pathname === "/",
    isReports = location.pathname === "/relatorios";
  async function write(
    type: "account" | "category" | "entry",
    values: Record<string, unknown>,
    id?: string,
    remove = false,
  ) {
    const key =
      type === "account"
        ? "accounts"
        : type === "category"
          ? "categories"
          : "entries";
    if (demo) {
      setDemoData(
        (prev) =>
          ({
            ...prev,
            [key]: remove
              ? prev[key].filter((x) => x.id !== id)
              : id
                ? prev[key].map((x) => (x.id === id ? { ...x, ...values } : x))
                : [
                    ...prev[key],
                    {
                      id: crypto.randomUUID(),
                      user_id: "demo",
                      archived: false,
                      ...values,
                    },
                  ],
          }) as Ledger,
      );
      return;
    }
    const db = supabase!;
    const request = remove
      ? db
          .from("jubarte_" + key)
          .delete()
          .eq("id", id!)
      : id
        ? db
            .from("jubarte_" + key)
            .update(values)
            .eq("id", id)
        : db.from("jubarte_" + key).insert({ ...values, user_id: userId });
    const { error } = await request;
    if (error) throw new Error(error.message);
    await client.invalidateQueries({ queryKey: ["ledger", userId] });
  }
  function action(fn: () => Promise<void>) {
    setWorking(true);
    return fn()
      .catch((e) =>
        setNotice(
          e instanceof Error ? e.message : "Não foi possível concluir.",
        ),
      )
      .finally(() => setWorking(false));
  }
  function changeFilter(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  async function exportPDF() {
    setWorking(true);
    try {
      const { downloadReport } = await import("./report");
      await downloadReport(ledger, filters);
      setNotice("Seu relatório está pronto.");
    } catch {
      setNotice("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setWorking(false);
    }
  }
  const errorMessage =
    error instanceof Error
      ? error.message
      : "Não foi possível carregar seus dados.";
  function monthMove(delta: number) {
    const d = new Date(filters.start + "T12:00:00Z");
    const next = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1, 12),
    )
      .toISOString()
      .slice(0, 10);
    setFilters((f) => ({ ...f, ...monthBounds(next) }));
  }
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (openNav ? "is-open" : "")}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-only btn btn-ghost"
            aria-label="Fechar menu"
            onClick={() => setOpenNav(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-label">SEU ESPAÇO FINANCEIRO</div>
        <nav>
          {nav.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end
              className={({ isActive }) =>
                "nav-link " + (isActive ? "active" : "")
              }
            >
              <Icon size={19} />
              <span>{label}</span>
              {path === "/" && <span className="nav-active-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="calm-card">
            <div className="calm-icon">
              <Waves size={22} />
            </div>
            <strong>Um passo de cada vez.</strong>
            <p>
              Cuidar do seu dinheiro é<br />
              cuidar do seu amanhã.
            </p>
            <span>
              Vamos juntos <ArrowRight size={13} />
            </span>
          </div>
          <button
            className="profile"
            onClick={() => void onExit()}
            title="Sair"
          >
            <span className="avatar">
              {demo ? "D" : email.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{demo ? "Modo demonstração" : "Meu espaço"}</strong>
              <small>{demo ? "Dados fictícios" : email}</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {openNav && (
        <button
          className="nav-scrim"
          aria-label="Fechar menu"
          onClick={() => setOpenNav(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-only btn btn-ghost btn-icon"
              onClick={() => setOpenNav(true)}
              aria-label="Abrir menu"
            >
              <Menu size={21} />
            </button>
            <span>Meu espaço</span>
            <ChevronRight size={14} />
            <strong>{section}</strong>
          </div>
          <div className="topbar-right">
            <ThemeToggle />
            <span className="private-badge">
              <ShieldCheck size={14} /> Ambiente pessoal
            </span>
            <span className="avatar small">
              {email.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="workspace">
          {demo && (
            <div className="demo-banner">
              <span>
                <strong>Você está na demonstração.</strong> Explore à vontade.
                Os dados são fictícios e não são salvos.
              </span>
              <button onClick={() => void onExit()}>
                Sair da demonstração <ArrowRight size={14} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {isDashboard
                  ? "SEU DINHEIRO, COM MAIS CLAREZA"
                  : isReports
                    ? "INFORMAÇÃO PARA DECIDIR MELHOR"
                    : "TUDO NO SEU LUGAR"}
              </span>
              <h1>
                {section}
                <span className="title-dot">.</span>
              </h1>
              <p>
                {isDashboard
                  ? "Um olhar tranquilo para a sua vida financeira."
                  : isReports
                    ? "Entenda seus números e acompanhe sua evolução."
                    : location.pathname === "/lancamentos"
                      ? "Cada movimento conta. Acompanhe todos eles por aqui."
                      : location.pathname === "/contas"
                        ? "Seu dinheiro organizado, de uma conta a outra."
                        : location.pathname === "/categorias"
                          ? "Organize seus movimentos do seu jeito."
                          : "Seu espaço, suas preferências."}
              </p>
            </div>
            <div className="heading-actions">
              {isReports ? (
                <Button
                  disabled={
                    working ||
                    (!demo && isPending) ||
                    !!error ||
                    filters.start > filters.end
                  }
                  onClick={() => void exportPDF()}
                >
                  <Download size={17} />
                  {working ? "Gerando…" : "Exportar PDF"}
                </Button>
              ) : (
                location.pathname !== "/configuracoes" && (
                  <Button
                    onClick={() =>
                      setEditor({
                        type:
                          location.pathname === "/contas"
                            ? "account"
                            : location.pathname === "/categorias"
                              ? "category"
                              : "entry",
                      })
                    }
                  >
                    <Plus size={18} />
                    {location.pathname === "/contas"
                      ? "Nova conta"
                      : location.pathname === "/categorias"
                        ? "Nova categoria"
                        : "Novo lançamento"}
                  </Button>
                )
              )}
            </div>
          </div>
          {!demo && isPending ? (
            <div className="loading-state">
              <div className="spinner" />
              Buscando seus dados com segurança…
            </div>
          ) : error ? (
            <div className="empty-state panel">
              <ShieldCheck size={32} />
              <h2>Não foi possível abrir seu espaço</h2>
              <p>{errorMessage}</p>
              <Button onClick={() => void refetch()}>Tentar novamente</Button>
            </div>
          ) : (
            <>
              {(isDashboard ||
                isReports ||
                location.pathname === "/lancamentos") && (
                <>
                  <div className="period-bar">
                    <div className="period-label">
                      <span className="period-dot" />
                      {isDashboard
                        ? "Seu resumo financeiro"
                        : "Período de análise"}
                    </div>
                    <div className="period-control">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Mês anterior"
                        onClick={() => monthMove(-1)}
                      >
                        <ChevronLeft size={16} />
                      </Button>
                      <label className="sr-only" htmlFor="start">
                        Data inicial
                      </label>
                      <input
                        id="start"
                        type="date"
                        value={filters.start}
                        onChange={(e) => {
                          if (e.target.value)
                            changeFilter("start", e.target.value);
                        }}
                        min="1900-01-01"
                        max="2100-12-31"
                      />
                      <span>—</span>
                      <label className="sr-only" htmlFor="end">
                        Data final
                      </label>
                      <input
                        id="end"
                        type="date"
                        value={filters.end}
                        onChange={(e) => {
                          if (e.target.value)
                            changeFilter("end", e.target.value);
                        }}
                        min="1900-01-01"
                        max="2100-12-31"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Próximo mês"
                        onClick={() => monthMove(1)}
                      >
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  </div>
                  {filters.start > filters.end && (
                    <div className="notice error" role="alert">
                      A data inicial deve ser anterior à data final.
                    </div>
                  )}
                  {(isReports || location.pathname === "/lancamentos") && (
                    <div className="filter-bar">
                      <div className="search-box">
                        <Search size={17} />
                        <input
                          aria-label="Buscar lançamentos"
                          placeholder="Buscar lançamento…"
                          value={filters.search}
                          onChange={(e) =>
                            changeFilter("search", e.target.value)
                          }
                        />
                      </div>
                      <select
                        aria-label="Filtrar conta"
                        value={filters.account}
                        onChange={(e) =>
                          changeFilter("account", e.target.value)
                        }
                      >
                        <option value="">Todas as contas</option>
                        {ledger.accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                            {a.archived ? " (arquivada)" : ""}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Filtrar categoria"
                        value={filters.category}
                        onChange={(e) =>
                          changeFilter("category", e.target.value)
                        }
                      >
                        <option value="">Todas as categorias</option>
                        {ledger.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Filtrar situação"
                        value={filters.status}
                        onChange={(e) => changeFilter("status", e.target.value)}
                      >
                        <option value="">Todas as situações</option>
                        <option value="paid">Efetivados</option>
                        <option value="pending">Pendentes</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Limpar filtros"
                        title="Limpar filtros"
                        onClick={() =>
                          setFilters({
                            ...monthBounds(),
                            account: "",
                            category: "",
                            status: "",
                            search: "",
                          })
                        }
                      >
                        <SlidersHorizontal size={18} />
                      </Button>
                    </div>
                  )}
                </>
              )}
              {(isDashboard || isReports) && (
                <>
                  <div className="stat-grid">
                    <Stat
                      label="Saldo realizado"
                      value={real}
                      icon={<Wallet size={20} />}
                      primary
                      note={"Até " + dateLabel(filters.end)}
                    />
                    <Stat
                      label="Receitas do período"
                      value={sum.income}
                      icon={<ArrowDownLeft size={20} />}
                      tone="green"
                      note="Valores recebidos"
                    />
                    <Stat
                      label="Despesas do período"
                      value={sum.expense}
                      icon={<ArrowUpRight size={20} />}
                      tone="orange"
                      note="Valores pagos"
                    />
                    <Stat
                      label="Saldo previsto"
                      value={projected}
                      icon={<TrendingUp size={20} />}
                      note="Inclui pendências até a data final"
                    />
                  </div>
                  {isReports && (
                    <div className="notice report-note">
                      Realizados usam a data de pagamento; pendências usam o
                      vencimento. Saldos consideram todo o histórico das contas
                      selecionadas, sem filtros de categoria, busca ou situação.
                    </div>
                  )}
                  <div className="chart-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Evolução financeira</h2>
                          <p>
                            {isReports
                              ? "Receitas, despesas e saldo ao longo do período"
                              : "Seu saldo realizado ao longo do mês"}
                          </p>
                        </div>
                        <span className="legend-label">
                          <i /> Saldo
                        </span>
                      </div>
                      <div className="main-chart">
                        {ledger.entries.length || ledger.accounts.length ? (
                          <BalanceChart ledger={ledger} filters={filters} />
                        ) : (
                          <Empty text="Adicione uma conta para começar a acompanhar seu saldo." />
                        )}
                      </div>
                      <div className="chart-foot">
                        <span>
                          <span className="mini-dot green" /> Receitas{" "}
                          <strong>{money(sum.income)}</strong>
                        </span>
                        <span>
                          <span className="mini-dot orange" /> Despesas{" "}
                          <strong>{money(sum.expense)}</strong>
                        </span>
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Para onde foi seu dinheiro?</h2>
                          <p>Despesas pagas por categoria</p>
                        </div>
                        <span className="muted">
                          <MoreHorizontal size={20} />
                        </span>
                      </div>
                      {cats.length ? (
                        <div className="category-chart">
                          <div className="donut">
                            <ResponsiveContainer width="100%" height={170}>
                              <PieChart>
                                <Pie
                                  isAnimationActive={false}
                                  data={cats}
                                  dataKey="value"
                                  innerRadius={57}
                                  outerRadius={77}
                                  paddingAngle={4}
                                  stroke="none"
                                >
                                  {cats.map((c) => (
                                    <Cell key={c.id} fill={c.color} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(v) => money(Number(v))} />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="donut-center">
                              <small>Total de despesas</small>
                              <strong>{money(sum.expense)}</strong>
                            </div>
                          </div>
                          <div className="category-list">
                            {cats.slice(0, 5).map((c) => (
                              <div key={c.id}>
                                <span>
                                  <i style={{ background: c.color }} />
                                  {c.name}
                                </span>
                                <strong>{money(c.value)}</strong>
                                <small>
                                  {Math.round((c.value / sum.expense) * 100)}%
                                </small>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <Empty text="Suas despesas por categoria vão aparecer aqui." />
                      )}
                    </section>
                  </div>
                </>
              )}
              {isDashboard && (
                <div className="bottom-grid">
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Últimos lançamentos</h2>
                        <p>Os movimentos mais recentes do período</p>
                      </div>
                      <NavLink to="/lancamentos" className="text-link">
                        Ver todos <ArrowRight size={14} />
                      </NavLink>
                    </div>
                    <EntryTable
                      rows={rows.slice(0, 5)}
                      ledger={ledger}
                      onEdit={(e) => setEditor({ type: "entry", item: e })}
                    />
                  </section>
                  <section className="panel accounts-overview">
                    <div className="panel-heading">
                      <div>
                        <h2>Minhas contas</h2>
                        <p>Cada valor no seu lugar</p>
                      </div>
                      <NavLink
                        to="/contas"
                        className="icon-link"
                        aria-label="Ver contas"
                      >
                        <ArrowUpRight size={18} />
                      </NavLink>
                    </div>
                    {activeAccounts.length ? (
                      activeAccounts.map((a) => (
                        <div className="account-line" key={a.id}>
                          <span
                            className="category-icon"
                            style={{
                              background: a.color + "16",
                              color: a.color,
                            }}
                          >
                            <Wallet size={19} />
                          </span>
                          <span>
                            {a.name}
                            <small>Saldo realizado</small>
                          </span>
                          <strong>
                            {money(balance(a, ledger.entries, filters.end))}
                          </strong>
                        </div>
                      ))
                    ) : (
                      <Empty text="Cadastre sua primeira conta." />
                    )}
                    <div className="upcoming">
                      <span>
                        <span className="mini-dot orange" /> Próximos
                        vencimentos
                      </span>
                      {ledger.entries
                        .filter((e) => !e.paid_date && e.due_date >= today())
                        .sort((a, b) => a.due_date.localeCompare(b.due_date))
                        .slice(0, 3)
                        .map((e) => (
                          <div key={e.id}>
                            <span>
                              {e.description}
                              <small>{dateLabel(e.due_date)}</small>
                            </span>
                            <strong>{money(e.amount_cents)}</strong>
                          </div>
                        ))}
                      {!ledger.entries.some(
                        (e) => !e.paid_date && e.due_date >= today(),
                      ) && <p>Nenhuma pendência pela frente.</p>}
                    </div>
                  </section>
                </div>
              )}
              {location.pathname === "/lancamentos" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>
                      Seus lançamentos{" "}
                      <span className="count">{rows.length}</span>
                    </h2>
                    <span className="muted">
                      {money(sum.income - sum.expense)} no período
                    </span>
                  </div>
                  <EntryTable
                    rows={rows.slice((page - 1) * 12, page * 12)}
                    ledger={ledger}
                    onEdit={(e) => setEditor({ type: "entry", item: e })}
                    onDelete={(e) =>
                      setConfirm({
                        title: "Excluir lançamento?",
                        message:
                          "O lançamento será removido e os saldos serão recalculados.",
                        action: async () => {
                          await write("entry", {}, e.id, true);
                          setConfirm(null);
                        },
                      })
                    }
                    onPay={(e) =>
                      void action(async () => {
                        await write("entry", { paid_date: today() }, e.id);
                        setNotice("Lançamento efetivado.");
                      })
                    }
                  />
                  <div className="pagination">
                    <span>
                      {rows.length} lançamento(s) · página {page} de{" "}
                      {Math.max(1, Math.ceil(rows.length / 12))}
                    </span>
                    <div>
                      <Button
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        disabled={page * 12 >= rows.length}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                </section>
              )}
              {location.pathname === "/contas" && (
                <>
                  <div className="notice">
                    Saldos em {dateLabel(today())}. Transferências movimentam
                    suas contas sem alterar receitas ou despesas.
                  </div>
                  <div className="resource-grid">
                    {ledger.accounts.map((a) => (
                      <section
                        className={
                          "panel account-card " + (a.archived ? "archived" : "")
                        }
                        key={a.id}
                      >
                        <span
                          className="category-icon"
                          style={{ color: a.color, background: a.color + "18" }}
                        >
                          <Wallet size={23} />
                        </span>
                        <span className="resource-status">
                          {a.archived ? "Arquivada" : "Conta ativa"}
                        </span>
                        <h2>{a.name}</h2>
                        <span className="muted">Saldo realizado</span>
                        <strong className="account-value">
                          {money(balance(a, ledger.entries, today()))}
                        </strong>
                        <p>
                          Previsto:{" "}
                          {money(balance(a, ledger.entries, today(), true))}
                        </p>
                        <div className="resource-actions">
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setEditor({ type: "account", item: a })
                            }
                          >
                            <Pencil size={15} /> Editar
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              void action(() =>
                                write(
                                  "account",
                                  { archived: !a.archived },
                                  a.id,
                                ),
                              )
                            }
                          >
                            <Archive size={15} />
                            {a.archived ? "Restaurar" : "Arquivar"}
                          </Button>
                        </div>
                      </section>
                    ))}
                    {!ledger.accounts.length && (
                      <section className="panel">
                        <Empty text="Crie sua primeira conta com o saldo atual para começar." />
                      </section>
                    )}
                  </div>
                </>
              )}
              {location.pathname === "/categorias" && (
                <div className="resource-grid">
                  {ledger.categories.map((c) => {
                    const Icon = iconMap[c.icon] || Tags;
                    return (
                      <section
                        className={
                          "panel category-card " +
                          (c.archived ? "archived" : "")
                        }
                        key={c.id}
                      >
                        <span
                          className="category-icon"
                          style={{ color: c.color, background: c.color + "18" }}
                        >
                          <Icon size={23} />
                        </span>
                        <h2>{c.name}</h2>
                        <span
                          className={
                            "pill " + (c.kind === "income" ? "paid" : "pending")
                          }
                        >
                          {c.kind === "income" ? "Receita" : "Despesa"}
                          {c.archived ? " · Arquivada" : ""}
                        </span>
                        <div className="resource-actions">
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setEditor({ type: "category", item: c })
                            }
                          >
                            <Pencil size={15} />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() =>
                              void action(() =>
                                write(
                                  "category",
                                  { archived: !c.archived },
                                  c.id,
                                ),
                              )
                            }
                          >
                            <Archive size={15} />
                            {c.archived ? "Restaurar" : "Arquivar"}
                          </Button>
                        </div>
                      </section>
                    );
                  })}
                  {!ledger.categories.length && (
                    <section className="panel">
                      <Empty text="Cadastre categorias como Salário, Moradia e Alimentação." />
                    </section>
                  )}
                </div>
              )}
              {isReports && (
                <>
                  <section className="panel comparison-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Comparativo mensal</h2>
                        <p>
                          Valores efetivados, agrupados pela data de pagamento
                        </p>
                      </div>
                    </div>
                    <div className="comparison-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={months} barGap={6}>
                          <CartesianGrid vertical={false} stroke="#edf1f5" />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            width={65}
                            tickFormatter={(v) => money(v)}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip formatter={(v) => money(Number(v))} />
                          <Legend />
                          <Bar
                            isAnimationActive={false}
                            name="Receitas"
                            dataKey="income"
                            fill="#27a99b"
                            radius={[5, 5, 0, 0]}
                          />
                          <Bar
                            isAnimationActive={false}
                            name="Despesas"
                            dataKey="expense"
                            fill="#e8ac74"
                            radius={[5, 5, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Mês</th>
                            <th>Receitas</th>
                            <th>Despesas</th>
                            <th>Resultado</th>
                            <th>Saldo das contas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {months.map((m) => (
                            <tr key={m.month}>
                              <td>{m.label}</td>
                              <td>{money(m.income)}</td>
                              <td>{money(m.expense)}</td>
                              <td>{money(m.income - m.expense)}</td>
                              <td>{money(m.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Detalhamento do relatório</h2>
                      <span className="muted">
                        {rows.length} lançamento(s) no PDF
                      </span>
                    </div>
                    <EntryTable
                      rows={rows.slice((page - 1) * 12, page * 12)}
                      ledger={ledger}
                      onEdit={(e) => setEditor({ type: "entry", item: e })}
                    />
                    <div className="pagination">
                      <span>Página {page}</span>
                      <div>
                        <Button
                          variant="outline"
                          disabled={page === 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          disabled={page * 12 >= rows.length}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  </section>
                </>
              )}
              {location.pathname === "/configuracoes" && (
                <section className="panel settings-panel">
                  <div className="settings-icon">
                    <ShieldCheck size={28} />
                  </div>
                  <h2>Seu espaço pessoal</h2>
                  <p>Um lugar seguro e organizado para suas finanças.</p>
                  <ThemePicker />
                  <dl>
                    <div>
                      <dt>E-mail</dt>
                      <dd>{email}</dd>
                    </div>
                    <div>
                      <dt>Moeda</dt>
                      <dd>Real brasileiro · BRL</dd>
                    </div>
                    <div>
                      <dt>Idioma</dt>
                      <dd>Português do Brasil</dd>
                    </div>
                    <div>
                      <dt>Fuso horário</dt>
                      <dd>America/Sao_Paulo</dd>
                    </div>
                    <div>
                      <dt>Relatórios</dt>
                      <dd>Baixados no seu dispositivo</dd>
                    </div>
                  </dl>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (demo) {
                        setNotice("A demonstração não altera senhas.");
                        return;
                      }
                      void action(async () => {
                        const { error } =
                          await supabase!.auth.resetPasswordForEmail(email, {
                            redirectTo:
                              window.location.origin + import.meta.env.BASE_URL,
                          });
                        if (error) throw error;
                        setNotice(
                          "Link de recuperação enviado para seu e-mail.",
                        );
                      });
                    }}
                  >
                    Enviar link para alterar senha
                  </Button>
                  <Button variant="ghost" onClick={() => void onExit()}>
                    <LogOut size={16} /> Sair do Jubarte
                  </Button>
                </section>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              <Waves size={15} /> Jubarte · Suas finanças em águas tranquilas.
            </span>
            <span>Feito para o seu amanhã.</span>
          </footer>
        </main>
      </div>
      <Modal
        title={
          editor
            ? (editor.item ? "Editar " : "Nova ") +
              (editor.type === "account"
                ? "conta"
                : editor.type === "category"
                  ? "categoria"
                  : "movimentação")
            : ""
        }
        open={!!editor}
        onOpenChange={(v) => {
          if (!v) setEditor(null);
        }}
      >
        {editor && (
          <Editor
            key={editor.type + (editor.item?.id || "new")}
            {...editor}
            ledger={ledger}
            onSave={async (value) => {
              await write(editor.type, value, editor.item?.id);
              setEditor(null);
              setNotice("Salvo com sucesso.");
            }}
          />
        )}
      </Modal>
      <Modal
        title={confirm?.title || ""}
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v && !working) setConfirm(null);
        }}
      >
        <p>{confirm?.message}</p>
        <div className="confirm-actions">
          <Button
            variant="outline"
            disabled={working}
            onClick={() => setConfirm(null)}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={working}
            onClick={() => confirm && void action(confirm.action)}
          >
            {working ? "Excluindo…" : "Excluir lançamento"}
          </Button>
        </div>
      </Modal>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  icon,
  primary = false,
  tone = "",
  note,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  primary?: boolean;
  tone?: string;
  note: string;
}) {
  return (
    <section className={"stat-card " + (primary ? "primary " : "") + tone}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{money(value)}</strong>
      <small>
        {primary ? (
          <span className="stat-dot" />
        ) : (
          <span className={"mini-dot " + tone} />
        )}{" "}
        {note}
      </small>
      {primary && <Waves className="stat-wave" />}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Waves size={28} />
      <p>{text}</p>
    </div>
  );
}
function BalanceChart({
  ledger,
  filters,
}: {
  ledger: Ledger;
  filters: Filters;
}) {
  const points = [];
  const start = new Date(filters.start + "T12:00:00Z"),
    end = new Date(filters.end + "T12:00:00Z");
  const days = Math.max(0, Math.round((+end - +start) / 86400000));
  const step = Math.max(1, Math.ceil(days / 60));
  for (let i = 0; i <= days; i += step) {
    const date = new Date(+start + i * 86400000).toISOString().slice(0, 10);
    points.push({
      date,
      label: dateLabel(date).slice(0, 5),
      saldo: ledger.accounts
        .filter((a) => !filters.account || a.id === filters.account)
        .reduce((s, a) => s + balance(a, ledger.entries, date), 0),
    });
  }
  if (points.length && points.at(-1)?.date !== filters.end)
    points.push({
      date: filters.end,
      label: dateLabel(filters.end).slice(0, 5),
      saldo: ledger.accounts
        .filter((a) => !filters.account || a.id === filters.account)
        .reduce((s, a) => s + balance(a, ledger.entries, filters.end), 0),
    });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={points}
        margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="balance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#35a9ae" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#35a9ae" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#edf1f5" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          minTickGap={32}
          tick={{ fill: "#8b99aa", fontSize: 11 }}
        />
        <YAxis
          width={65}
          tickFormatter={(v) =>
            "R$ " + (v / 100000).toLocaleString("pt-BR") + " mil"
          }
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#8b99aa", fontSize: 11 }}
        />
        <Tooltip
          formatter={(v) => money(Number(v))}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e5ebef",
            fontSize: 12,
          }}
        />
        <Area
          isAnimationActive={false}
          name="Saldo"
          type="stepAfter"
          dataKey="saldo"
          stroke="#269da4"
          strokeWidth={2.5}
          fill="url(#balance-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
function EntryTable({
  rows,
  ledger,
  onEdit,
  onDelete,
  onPay,
}: {
  rows: Entry[];
  ledger: Ledger;
  onEdit: (e: Entry) => void;
  onDelete?: (e: Entry) => void;
  onPay?: (e: Entry) => void;
}) {
  if (!rows.length)
    return (
      <Empty text="Nenhum lançamento por aqui. Adicione um ou ajuste o período." />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            <th>Categoria / conta</th>
            <th>Data</th>
            <th>Situação</th>
            <th className="right">Valor</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const c = ledger.categories.find((c) => c.id === e.category_id),
              Icon =
                e.kind === "transfer"
                  ? ArrowRightLeft
                  : iconMap[c?.icon || "wallet"] || Wallet;
            return (
              <tr key={e.id}>
                <td>
                  <button className="entry-name" onClick={() => onEdit(e)}>
                    <span
                      className="category-icon"
                      style={{
                        color: c?.color || "#267dba",
                        background: (c?.color || "#267dba") + "16",
                      }}
                    >
                      <Icon size={17} />
                    </span>
                    <span>
                      {e.description}
                      {e.notes && <small>{e.notes}</small>}
                    </span>
                  </button>
                </td>
                <td>
                  <span className="table-category">
                    {e.kind === "transfer" ? "Transferência" : c?.name || "—"}
                    <small>
                      {ledger.accounts.find((a) => a.id === e.account_id)?.name}
                      {e.destination_id
                        ? " → " +
                          ledger.accounts.find((a) => a.id === e.destination_id)
                            ?.name
                        : ""}
                    </small>
                  </span>
                </td>
                <td className="date-cell">
                  {dateLabel(e.paid_date || e.due_date)}
                </td>
                <td>
                  <span
                    className={
                      "pill " +
                      (e.paid_date
                        ? "paid"
                        : e.due_date < today()
                          ? "overdue"
                          : "pending")
                    }
                  >
                    {e.paid_date
                      ? "Efetivado"
                      : e.due_date < today()
                        ? "Vencido"
                        : "Pendente"}
                  </span>
                </td>
                <td
                  className={
                    "amount right " + (e.kind === "income" ? "income" : "")
                  }
                >
                  {e.kind === "income"
                    ? "+ "
                    : e.kind === "expense"
                      ? "− "
                      : ""}
                  {money(e.amount_cents)}
                </td>
                <td>
                  <div className="row-actions">
                    {!e.paid_date && onPay && (
                      <button
                        title="Efetivar hoje"
                        aria-label={"Efetivar " + e.description}
                        onClick={() => onPay(e)}
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      title="Editar"
                      aria-label={"Editar " + e.description}
                      onClick={() => onEdit(e)}
                    >
                      <Pencil size={14} />
                    </button>
                    {onDelete && (
                      <button
                        title="Excluir"
                        aria-label={"Excluir " + e.description}
                        onClick={() => onDelete(e)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
