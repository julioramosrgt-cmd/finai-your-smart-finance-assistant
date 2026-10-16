import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CreditCard, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useData } from "@/hooks/use-data";
import { PageHeader, EmptyState } from "@/components/finai/PageHeader";
import { AccountForm, CardForm, KIND_LABEL } from "@/components/finai/AccountCardForms";
import { db, type Account, type Card } from "@/lib/db";
import { accountBalance, cardUsage, currentMonth, invoiceTotal } from "@/lib/finance";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/contas/")({
  head: () => ({
    meta: [
      { title: "Contas e cartões — FinAI" },
      { name: "description", content: "Saldos das contas, limites e faturas dos cartões de crédito." },
      { property: "og:title", content: "Contas e cartões — FinAI" },
      { property: "og:description", content: "Gerencie contas bancárias e cartões." },
    ],
  }),
  component: Contas,
});

function Contas() {
  const data = useData();
  const [accOpen, setAccOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<Account | null>(null);
  const [editCard, setEditCard] = useState<Card | null>(null);
  if (!data) return null;
  const cm = currentMonth();
  const accounts = data.accounts.map((item, index) => ({ ...item, sort_order: item.sort_order ?? index })).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
  const cards = data.cards.map((item, index) => ({ ...item, sort_order: item.sort_order ?? index })).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));

  async function moveItem(items: { id: string; sort_order?: number }[], index: number, direction: -1 | 1, update: (id: string, order: number) => Promise<unknown>) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    await Promise.all([update(items[index].id, target), update(items[target].id, index)]);
  }

  async function delAcc(a: Account) {
    const n = await db.transactions.where("account_id").equals(a.id).count();
    if (n > 0) return toast.error("Exclua ou mova os lançamentos desta conta antes.");
    await db.accounts.delete(a.id);
  }
  async function delCard(c: Card) {
    const n = await db.transactions.where("card_id").equals(c.id).count();
    if (n > 0) return toast.error("Exclua ou mova os lançamentos deste cartão antes.");
    await db.cards.delete(c.id);
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Contas e cartões" />
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Contas</h2>
          <Button size="sm" variant="secondary" onClick={() => { setEditAcc(null); setAccOpen(true); }}><Plus /> Conta</Button>
        </div>
        {accounts.length === 0 ? (
          <EmptyState icon={<Wallet />} title="Nenhuma conta" text="Adicione sua conta corrente, benefício ou investimento." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a, index) => {
              const bal = accountBalance(a, data.transactions);
              return (
                <div key={a.id} className="group rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <Link to="/contas/$id" params={{ id: a.id }} className="min-w-0">
                      <p className="truncate font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{KIND_LABEL[a.kind]} · {a.institution_name || "—"}</p>
                    </Link>
                    <div className="flex">
                      <Button aria-label="Mover conta para cima" size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0} onClick={() => moveItem(accounts, index, -1, (id, order) => db.accounts.update(id, { sort_order: order }))}><ArrowUp /></Button>
                      <Button aria-label="Mover conta para baixo" size="icon" variant="ghost" className="h-8 w-8" disabled={index === accounts.length - 1} onClick={() => moveItem(accounts, index, 1, (id, order) => db.accounts.update(id, { sort_order: order }))}><ArrowDown /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditAcc(a); setAccOpen(true); }}><Pencil /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-expense" onClick={() => delAcc(a)}><Trash2 /></Button>
                    </div>
                  </div>
                  <Link to="/contas/$id" params={{ id: a.id }}>
                    <p className={cn("num mt-3 text-2xl font-semibold", bal >= 0 ? "text-income" : "text-expense")}>{money(bal)}</p>
                    <p className="text-xs text-muted-foreground">Ver extrato →</p>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Cartões de crédito</h2>
          <Button size="sm" variant="secondary" onClick={() => { setEditCard(null); setCardOpen(true); }}><Plus /> Cartão</Button>
        </div>
        {cards.length === 0 ? (
          <EmptyState icon={<CreditCard />} title="Nenhum cartão" text="Cadastre seus cartões com limite, fechamento e vencimento." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c, index) => {
              const u = cardUsage(c, data.transactions);
              const inv = invoiceTotal(c.id, cm, data.transactions);
              return (
                <div key={c.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <Link to="/cartoes/$id" params={{ id: c.id }} className="min-w-0">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.institution_name || "—"} · fecha dia {c.closing_day} · vence dia {c.due_day}</p>
                    </Link>
                    <div className="flex">
                      <Button aria-label="Mover cartão para cima" size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0} onClick={() => moveItem(cards, index, -1, (id, order) => db.cards.update(id, { sort_order: order }))}><ArrowUp /></Button>
                      <Button aria-label="Mover cartão para baixo" size="icon" variant="ghost" className="h-8 w-8" disabled={index === cards.length - 1} onClick={() => moveItem(cards, index, 1, (id, order) => db.cards.update(id, { sort_order: order }))}><ArrowDown /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditCard(c); setCardOpen(true); }}><Pencil /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-expense" onClick={() => delCard(c)}><Trash2 /></Button>
                    </div>
                  </div>
                  <Link to="/cartoes/$id" params={{ id: c.id }} className="block">
                    <p className="mt-3 text-xs text-muted-foreground">Fatura do mês</p>
                    <p className="num text-2xl font-semibold text-expense">{money(inv)}</p>
                    <Progress value={c.limit ? Math.min(100, (u.used / c.limit) * 100) : 0} className={cn("mt-3 h-2", u.over && "[&>div]:bg-expense")} />
                    <p className={cn("mt-1.5 text-xs", u.over ? "text-expense" : "text-muted-foreground")}>
                      {u.over ? "Limite estourado · " : ""}Disponível <span className="num">{money(u.available)}</span> de <span className="num">{money(c.limit)}</span>
                    </p>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <AccountForm open={accOpen} onOpenChange={setAccOpen} editing={editAcc} />
      <CardForm open={cardOpen} onOpenChange={setCardOpen} editing={editCard} />
    </div>
  );
}
