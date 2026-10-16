import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useData } from "@/hooks/use-data";
import { MonthPicker } from "@/components/finai/MonthPicker";
import { PageHeader } from "@/components/finai/PageHeader";
import { accountBalance, categoryBreakdown, currentMonth, monthEnd, periodMetrics, shiftMonth } from "@/lib/finance";
import { money } from "@/lib/format";
import type { Transaction } from "@/lib/db";

export const Route = createFileRoute("/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — FinAI" }, { name: "description", content: "Análise de receitas, despesas, evolução de saldos e despesas fixas e variáveis." }] }),
  component: Relatorios,
});

function Relatorios() {
  const data = useData();
  const [month, setMonth] = useState(currentMonth());
  const charts = useMemo(() => {
    if (!data) return null;
    const expenses = categoryBreakdown(month, data.transactions, data.categories, "expense");
    const income = categoryBreakdown(month, data.transactions, data.categories, "income");
    const byCategory = [...new Set([...expenses, ...income].map((item) => item.name))].map((name) => ({
      categoria: name,
      Receitas: income.find((item) => item.name === name)?.value ?? 0,
      Despesas: expenses.find((item) => item.name === name)?.value ?? 0,
    }));
    const trend = [-5, -4, -3, -2, -1, 0].map((offset) => {
      const key = shiftMonth(month, offset);
      const metrics = periodMetrics(key, data.accounts, data.cards, data.transactions);
      const historicalBalance = data.accounts.reduce((sum, account) => sum + accountBalance(account, data.transactions, monthEnd(key), true), 0);
      return { mes: key.slice(5) + "/" + key.slice(2), Receitas: metrics.incomeComp, Despesas: metrics.expenseComp, Saldo: historicalBalance };
    });
    const behaviorFor = (tx: Transaction) => data.subcategories.find((subcategory) => subcategory.id === tx.subcategory_id)?.behavior ?? data.categories.find((category) => category.id === tx.category_id)?.behavior ?? "variable";
    const fixed = data.transactions.filter((tx) => tx.type === "expense" && tx.date.startsWith(month) && behaviorFor(tx) === "fixed").reduce((sum, tx) => sum + tx.amount, 0);
    const variable = data.transactions.filter((tx) => tx.type === "expense" && tx.date.startsWith(month) && behaviorFor(tx) !== "fixed").reduce((sum, tx) => sum + tx.amount, 0);
    return { byCategory, trend, fixed, variable };
  }, [data, month]);

  if (!data || !charts) return null;
  const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 };
  return <div className="space-y-5">
    <PageHeader title="Relatórios e análises" subtitle="Valores por competência, calculados a partir dos lançamentos locais." actions={<MonthPicker value={month} onChange={setMonth} />} />
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-3 font-semibold">Receitas e despesas por categoria</h2>
      {charts.byCategory.length ? <div className="h-72"><ResponsiveContainer><BarChart data={charts.byCategory} margin={{ bottom: 50, left: 8, right: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="categoria" angle={-25} textAnchor="end" interval={0} height={65} fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(value) => money(Number(value))} contentStyle={tooltipStyle} /><Bar dataKey="Receitas" fill="var(--income)" radius={[5, 5, 0, 0]} /><Bar dataKey="Despesas" fill="var(--expense)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="text-sm text-muted-foreground">Sem movimentações categorizadas neste mês.</p>}
    </section>
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-3 font-semibold">Evolução nos últimos 6 meses</h2>
      <div className="h-72"><ResponsiveContainer><BarChart data={charts.trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(value) => money(Number(value))} contentStyle={tooltipStyle} /><Bar dataKey="Receitas" fill="var(--income)" radius={[5, 5, 0, 0]} /><Bar dataKey="Despesas" fill="var(--expense)" radius={[5, 5, 0, 0]} /><Bar dataKey="Saldo" fill="var(--primary)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
    </section>
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-3 font-semibold">Despesas fixas x variáveis</h2>
      <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-muted/50 p-4"><p className="text-sm text-muted-foreground">Fixas</p><p className="num mt-1 text-2xl font-semibold">{money(charts.fixed)}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-sm text-muted-foreground">Variáveis ou não classificadas</p><p className="num mt-1 text-2xl font-semibold">{money(charts.variable)}</p></div></div>
      <p className="mt-3 text-xs text-muted-foreground">Classifique categorias e subcategorias na aba Categorias; itens sem classificação são considerados variáveis.</p>
    </section>
  </div>;
}
