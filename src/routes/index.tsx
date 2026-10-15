import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Bell, Plus, Wallet } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { useData } from "@/hooks/use-data";
import { MonthPicker } from "@/components/finai/MonthPicker";
import { PageHeader, EmptyState } from "@/components/finai/PageHeader";
import { InsightsCards } from "@/components/finai/InsightsCards";
import { TransactionForm } from "@/components/finai/TransactionForm";
import { TransactionList } from "@/components/finai/TransactionList";
import { buildAlerts, categoryBreakdown, currentMonth, monthKey, periodMetrics, shiftMonth } from "@/lib/finance";
import { dateBR, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — FinAI" },
      { name: "description", content: "Saldo real, projeção do mês, faturas abertas e gastos por competência em um só lugar." },
      { property: "og:title", content: "Painel — FinAI" },
      { property: "og:description", content: "Seu painel financeiro com projeções e insights de IA." },
    ],
  }),
  component: Dashboard,
});

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.04, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  } catch {
    /* ignore */
  }
}

function Dashboard() {
  const data = useData();
  const [ym, setYm] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  const beeped = useRef(false);

  const m = useMemo(() => (data ? periodMetrics(ym, data.accounts, data.cards, data.transactions) : null), [data, ym]);
  const alerts = useMemo(() => (data ? buildAlerts(data.cards, data.transactions) : []), [data]);
  const cats = useMemo(() => (data ? categoryBreakdown(ym, data.transactions, data.categories) : []), [data, ym]);
  const evolution = useMemo(
    () =>
      data
        ? [-4, -3, -2, -1, 0, 1].map((n) => {
            const k = shiftMonth(ym, n);
            const p = periodMetrics(k, data.accounts, data.cards, data.transactions);
            return { m: k.slice(5) + "/" + k.slice(2, 4), Receitas: p.incomeComp, Despesas: p.expenseComp };
          })
        : [],
    [data, ym],
  );

  useEffect(() => {
    if (!beeped.current && data?.settings?.sound && alerts.some((a) => a.level !== "soon")) {
      beeped.current = true;
      beep();
    }
  }, [alerts, data?.settings?.sound]);

  if (!data || !m) return null;
  const monthTx = data.transactions
    .filter((t) => monthKey(t.date) === ym)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
  const hasData = data.transactions.length > 0;

  const stats = [
    { label: "Saldo real hoje", value: m.realToday, tone: m.realToday >= 0 ? "text-income" : "text-expense", hint: "Somente o que já foi pago/recebido" },
    { label: "Saldo projetado do mês", value: m.projected, tone: m.projected >= 0 ? "text-income" : "text-expense", hint: "Inclui pendências e faturas até o fim do mês" },
    { label: "Faturas abertas", value: m.openInvoices, tone: m.openInvoices > 0 ? "text-expense" : "", hint: "Faturas que vencem neste mês" },
    { label: "Gasto por competência", value: m.expenseComp, tone: "text-expense", hint: `Receitas: ${money(m.incomeComp)}` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel"
        actions={
          <>
            <MonthPicker value={ym} onChange={setYm} />
            <Button onClick={() => setOpen(true)} className="gap-1.5">
              <Plus /> Lançar
            </Button>
          </>
        }
      />

      {alerts.length > 0 && (
        <section className="space-y-2">
          {alerts.slice(0, 4).map((a) => (
            <Link
              key={a.id}
              to={a.kind === "invoice" ? "/cartoes/$id" : "/lancamentos"}
              params={a.kind === "invoice" ? { id: a.ref } : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
                a.level === "overdue" && "border-expense/40 bg-expense/10",
                a.level === "today" && "border-expense/30 bg-expense/5",
                a.level === "soon" && "border-warning/40 bg-warning/10",
              )}
            >
              {a.level === "soon" ? <Bell className="h-4 w-4 text-warning" /> : <AlertTriangle className="h-4 w-4 text-expense" />}
              <span className="flex-1 truncate font-medium">{a.title}</span>
              <span className="text-xs text-muted-foreground">
                {a.level === "overdue" ? "Vencido" : a.level === "today" ? "Vence hoje" : `Vence ${dateBR(a.due_date)}`}
              </span>
              <span className="num font-semibold">{money(Math.abs(a.amount))}</span>
            </Link>
          ))}
          {alerts.length > 4 && <p className="text-xs text-muted-foreground">+{alerts.length - 4} alertas</p>}
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={cn("rounded-2xl border bg-card p-4", i === 0 && "bg-hero")}>
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className={cn("num mt-2 text-lg font-semibold sm:text-2xl", s.tone)}>{money(s.value)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </section>

      <InsightsCards />

      {!hasData ? (
        <EmptyState
          icon={<Wallet />}
          title="Comece registrando seu primeiro lançamento"
          text="Cadastre receitas, despesas, compras parceladas ou contas fixas. Você também pode importar extratos OFX, CSV ou PDF."
          action={
            <div className="flex gap-2">
              <Button onClick={() => setOpen(true)}>Novo lançamento</Button>
              <Button variant="secondary" asChild>
                <Link to="/importar">Importar extrato</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-5">
            <div className="rounded-2xl border bg-card p-4 lg:col-span-2">
              <h2 className="mb-3 font-semibold">Despesas por categoria</h2>
              {cats.length ? (
                <div className="flex items-center gap-4">
                  <div className="h-40 w-40 shrink-0">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={cats} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2} stroke="none">
                          {cats.map((c) => (
                            <Cell key={c.id} fill={`var(--${c.color})`} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                    {cats.slice(0, 6).map((c) => (
                      <li key={c.id} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `var(--${c.color})` }} />
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="num text-xs">{money(c.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem despesas neste mês.</p>
              )}
            </div>
            <div className="rounded-2xl border bg-card p-4 lg:col-span-3">
              <h2 className="mb-3 font-semibold">Evolução por competência</h2>
              <div className="h-44">
                <ResponsiveContainer>
                  <BarChart data={evolution}>
                    <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "var(--accent)" }}
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }}
                      formatter={(v: number) => money(v)}
                    />
                    <Bar dataKey="Receitas" fill="var(--income)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Despesas" fill="var(--expense)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Lançamentos do mês</h2>
              <Link to="/lancamentos" className="text-sm text-primary">
                Ver todos
              </Link>
            </div>
            <TransactionList items={monthTx} />
          </section>
        </>
      )}
      <TransactionForm open={open} onOpenChange={setOpen} />
    </div>
  );
}
