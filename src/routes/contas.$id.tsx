import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useData } from "@/hooks/use-data";
import { MonthPicker } from "@/components/finai/MonthPicker";
import { PageHeader } from "@/components/finai/PageHeader";
import { TransactionForm } from "@/components/finai/TransactionForm";
import { TransactionList } from "@/components/finai/TransactionList";
import { accountBalance, currentMonth, monthEnd, monthKey } from "@/lib/finance";
import { money } from "@/lib/format";

export const Route = createFileRoute("/contas/$id")({
  head: () => ({
    meta: [
      { title: "Extrato da conta — FinAI" },
      { name: "description", content: "Extrato mensal da conta com saldo atual e projetado." },
      { property: "og:title", content: "Extrato da conta — FinAI" },
      { property: "og:description", content: "Extrato e saldo da conta." },
    ],
  }),
  component: Extrato,
});

function Extrato() {
  const { id } = Route.useParams();
  const data = useData();
  const [ym, setYm] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  if (!data) return null;
  const acc = data.accounts.find((a) => a.id === id);
  if (!acc) return <p>Conta não encontrada.</p>;
  const items = data.transactions
    .filter((t) => (t.account_id === id || t.to_account_id === id) && monthKey(t.date) === ym)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-4">
      <Link to="/contas" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Contas</Link>
      <PageHeader
        title={acc.name}
        subtitle={acc.institution_name}
        actions={<><MonthPicker value={ym} onChange={setYm} /><Button variant="outline" asChild><Link to="/importar"><FileUp /> Importar extrato</Link></Button><Button onClick={() => setOpen(true)}><Plus /> Lançar</Button></>}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Saldo atual</p>
          <p className="num mt-1 text-xl font-semibold">{money(accountBalance(acc, data.transactions))}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Projetado fim do mês</p>
          <p className="num mt-1 text-xl font-semibold">{money(accountBalance(acc, data.transactions, monthEnd(ym), true))}</p>
        </div>
      </div>
      <TransactionList items={items} />
      <TransactionForm open={open} onOpenChange={setOpen} defaultSource={`acc:${acc.id}`} />
    </div>
  );
}
