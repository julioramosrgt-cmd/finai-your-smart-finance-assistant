import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CheckCircle2, MoreVertical, Pencil, Repeat, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, type Transaction } from "@/lib/db";
import { effectiveStatus, todayISO } from "@/lib/finance";
import { dateBR, money } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { TransactionForm } from "./TransactionForm";
import { cn } from "@/lib/utils";

export function StatusBadge({ t }: { t: Transaction }) {
  const s = effectiveStatus(t);
  const soon = s === "pending" && t.due_date <= new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  if (s === "paid") return <Badge className="border-0 bg-income/15 text-income">Pago</Badge>;
  if (s === "overdue") return <Badge className="border-0 bg-expense/15 text-expense">Vencido</Badge>;
  if (soon) return <Badge className="border-0 bg-warning/20 text-warning">Vence em breve</Badge>;
  return <Badge variant="secondary">Pendente</Badge>;
}

export function TransactionList({ items, emptyText = "Nenhum lançamento neste período." }: { items: Transaction[]; emptyText?: string }) {
  const data = useData();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [paying, setPaying] = useState<Transaction | null>(null);
  const [payDate, setPayDate] = useState(todayISO());

  const name = (t: Transaction) =>
    t.card_id
      ? data?.cards.find((c) => c.id === t.card_id)?.name
      : data?.accounts.find((a) => a.id === t.account_id)?.name;
  const cat = (t: Transaction) =>
    [t.investment_operation ? `Investimentos / ${t.investment_operation === "aporte" ? "Aporte" : "Resgate"}` : data?.categories.find((c) => c.id === t.category_id)?.name, data?.subcategories.find((s) => s.id === t.subcategory_id)?.name]
      .filter(Boolean)
      .join(" · ");

  async function remove(scope: "one" | "series") {
    if (!deleting) return;
    if (scope === "series" && deleting.series_id) {
      const ids = (await db.transactions.where("series_id").equals(deleting.series_id).toArray())
        .filter((t) => t.date >= deleting.date)
        .map((t) => t.id);
      await db.transactions.bulkDelete(ids);
      toast.success(`${ids.length} lançamentos excluídos.`);
    } else {
      await db.transactions.delete(deleting.id);
      toast.success("Lançamento excluído. Saldo e limite estornados.");
    }
    setDeleting(null);
  }

  async function pay() {
    if (!paying) return;
    await db.transactions.update(paying.id, { status: "paid", paid_at: payDate });
    toast.success("Baixa realizada.");
    setPaying(null);
  }

  if (!items.length) return <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {items.map((t) => {
          const Icon = t.type === "income" ? ArrowDownLeft : t.type === "transfer" ? ArrowLeftRight : ArrowUpRight;
          const s = effectiveStatus(t);
          return (
            <li key={t.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  t.type === "income" ? "bg-income/15 text-income" : t.type === "transfer" ? "bg-accent text-muted-foreground" : "bg-expense/15 text-expense",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {t.description}
                  {t.is_recurring && <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {dateBR(t.date)} · {name(t) ?? "—"}
                  {cat(t) && ` · ${cat(t)}`}
                  {t.card_id && t.invoice_month && ` · fatura ${t.invoice_month.slice(5)}/${t.invoice_month.slice(0, 4)}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={cn("num text-sm font-semibold", t.type === "income" ? "text-income" : t.type === "expense" ? "text-expense" : "")}>
                  {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}
                  {money(t.amount)}
                </span>
                <StatusBadge t={t} />
              </div>
              <div className="flex items-center">
                {!t.card_id && s !== "paid" && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-income" aria-label="Baixar/Pagar" onClick={() => { setPayDate(todayISO()); setPaying(t); }}>
                    <CheckCircle2 />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ações">
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!t.to_card_id && (
                      <DropdownMenuItem onClick={() => setEditing(t)}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                    )}
                    {t.status === "paid" && !t.card_id && (
                      <DropdownMenuItem onClick={() => db.transactions.update(t.id, { status: "pending", paid_at: undefined })}>
                        Desfazer baixa
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-expense" onClick={() => setDeleting(t)}>
                      <Trash2 /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      <TransactionForm open={!!editing} onOpenChange={(o) => !o && setEditing(null)} editing={editing} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.series_id
                ? "Este lançamento faz parte de uma série (parcelas ou recorrência)."
                : "Saldos, faturas e limites serão recalculados automaticamente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {deleting?.series_id && (
              <AlertDialogAction className="bg-secondary text-secondary-foreground hover:bg-secondary/80" onClick={() => remove("series")}>
                Esta e as próximas
              </AlertDialogAction>
            )}
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => remove("one")}>
              {deleting?.series_id ? "Só esta" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Baixar / Pagar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {paying?.description} · <span className="num">{money(paying?.amount ?? 0)}</span>
          </p>
          <div className="space-y-1.5">
            <Label>Data do pagamento</Label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={pay}>Confirmar baixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
