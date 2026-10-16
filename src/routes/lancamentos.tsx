import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/hooks/use-data";
import { PageHeader } from "@/components/finai/PageHeader";
import { TransactionForm } from "@/components/finai/TransactionForm";
import { TransactionList } from "@/components/finai/TransactionList";
import { currentMonth, effectiveStatus, monthEnd, shiftMonth, todayISO } from "@/lib/finance";
import { money } from "@/lib/format";

export const Route = createFileRoute("/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamentos — FinAI" },
      { name: "description", content: "Extrato completo com filtros por categoria, subcategoria, conta, cartão e status." },
      { property: "og:title", content: "Lançamentos — FinAI" },
      { property: "og:description", content: "Filtre e gerencie todos os seus lançamentos." },
    ],
  }),
  component: Lancamentos,
});

const ALL = "all";

function Lancamentos() {
  const data = useData();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [type, setType] = useState(ALL);
  const [cat, setCat] = useState(ALL);
  const [sub, setSub] = useState(ALL);
  const [origin, setOrigin] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [period, setPeriod] = useState("month");
  const [from, setFrom] = useState(`${currentMonth()}-01`);
  const [to, setTo] = useState(monthEnd(currentMonth()));
  const [view, setView] = useState<"unified" | "institution">("unified");

  const dateRange = useMemo(() => {
    const today = todayISO();
    if (period === "month") return [`${currentMonth()}-01`, monthEnd(currentMonth())];
    if (period === "previous") { const previous = shiftMonth(currentMonth(), -1); return [`${previous}-01`, monthEnd(previous)]; }
    if (period === "three") return [`${shiftMonth(currentMonth(), -2)}-01`, monthEnd(currentMonth())];
    if (period === "year") return [`${today.slice(0, 4)}-01-01`, `${today.slice(0, 4)}-12-31`];
    return [from || "0000-01-01", to || "9999-12-31"];
  }, [period, from, to]);

  const items = useMemo(() => {
    if (!data) return [];
    return data.transactions
      .filter((t) => t.date >= dateRange[0] && t.date <= dateRange[1])
      .filter((t) => type === ALL || t.type === type)
      .filter((t) => cat === ALL || t.category_id === cat)
      .filter((t) => sub === ALL || t.subcategory_id === sub)
      .filter((t) => origin === ALL || `acc:${t.account_id}` === origin || `card:${t.card_id}` === origin)
      .filter((t) => status === ALL || effectiveStatus(t) === status)
      .filter((t) => !q || t.description.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, dateRange, type, cat, sub, origin, status, q]);

  if (!data) return null;
  const inc = items.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const exp = items.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lançamentos"
        actions={
          <>
            <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus /> Novo</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mês atual</SelectItem><SelectItem value="previous">Mês anterior</SelectItem>
            <SelectItem value="three">Últimos 3 meses</SelectItem><SelectItem value="year">Ano atual</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
        {period === "custom" && <>
          <Input aria-label="Data inicial" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input aria-label="Data final" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </>}
        <Select value={view} onValueChange={(v) => setView(v as typeof view)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="unified">Visão unificada</SelectItem><SelectItem value="institution">Por instituição</SelectItem></SelectContent>
        </Select>
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="transfer">Transferências</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={(v) => { setCat(v); setSub(ALL); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas categorias</SelectItem>
            {data.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sub} onValueChange={setSub} disabled={cat === ALL}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas subcategorias</SelectItem>
            {data.subcategories.filter((s) => s.category_id === cat).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={origin} onValueChange={setOrigin}>
          <SelectTrigger className="col-span-2 md:col-span-2"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas contas e cartões</SelectItem>
            {data.accounts.map((a) => <SelectItem key={a.id} value={`acc:${a.id}`}>{a.name}</SelectItem>)}
            {data.cards.map((c) => <SelectItem key={c.id} value={`card:${c.id}`}>Cartão {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-4 text-sm">
        <span>Receitas <b className="num text-income">{money(inc)}</b></span>
        <span>Despesas <b className="num text-expense">{money(exp)}</b></span>
      </div>
      {view === "unified" ? <TransactionList items={items} /> : <div className="space-y-4">
        {[...new Set(items.map((t) => t.institution_name || "Sem instituição"))].sort().map((institution) => (
          <section key={institution} className="space-y-2"><h2 className="font-semibold">{institution}</h2><TransactionList items={items.filter((t) => (t.institution_name || "Sem instituição") === institution)} /></section>
        ))}
        {!items.length && <TransactionList items={items} />}
      </div>}
      <TransactionForm open={open} onOpenChange={setOpen} />
    </div>
  );
}
