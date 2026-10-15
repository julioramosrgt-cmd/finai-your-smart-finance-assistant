import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/hooks/use-data";
import { MonthPicker } from "@/components/finai/MonthPicker";
import { PageHeader } from "@/components/finai/PageHeader";
import { TransactionForm } from "@/components/finai/TransactionForm";
import { TransactionList } from "@/components/finai/TransactionList";
import { cardUsage, currentMonth, invoiceFor, invoiceTotal, payInvoice, todayISO } from "@/lib/finance";
import { dateBR, money } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cartoes/$id")({
  head: () => ({
    meta: [
      { title: "Fatura do cartão — FinAI" },
      { name: "description", content: "Fatura mensal, limite disponível e pagamento do cartão." },
      { property: "og:title", content: "Fatura do cartão — FinAI" },
      { property: "og:description", content: "Gerencie a fatura do seu cartão." },
    ],
  }),
  component: Fatura,
});

function Fatura() {
  const { id } = Route.useParams();
  const data = useData();
  const [ym, setYm] = useState(currentMonth());
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAcc, setPayAcc] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  if (!data) return null;
  const card = data.cards.find((c) => c.id === id);
  if (!card) return <p>Cartão não encontrado.</p>;
  const items = data.transactions.filter((t) => t.card_id === id && t.invoice_month === ym).sort((a, b) => b.date.localeCompare(a.date));
  const open$ = invoiceTotal(id, ym, data.transactions);
  const total = invoiceTotal(id, ym, data.transactions, false);
  const u = cardUsage(card, data.transactions);
  const due = invoiceFor(card, `${ym}-01`).due_date.slice(0, 7) === ym ? invoiceFor(card, `${ym}-01`).due_date : `${ym}-${String(card.due_day).padStart(2, "0")}`;

  async function pay() {
    if (!payAcc) return toast.error("Escolha a conta de pagamento.");
    const v = await payInvoice(card!, ym, payAcc, payDate);
    toast.success(`Fatura de ${money(v)} paga.`);
    setPayOpen(false);
  }

  return (
    <div className="space-y-4">
      <Link to="/contas" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Cartões</Link>
      <PageHeader
        title={`Cartão ${card.name}`}
        subtitle={`${card.institution_name} · fecha dia ${card.closing_day} · vence dia ${card.due_day}`}
        actions={<><MonthPicker value={ym} onChange={setYm} /><Button onClick={() => setOpen(true)}><Plus /> Compra</Button></>}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Fatura com vencimento em {dateBR(due)}</p>
          <p className="num mt-1 text-2xl font-semibold text-expense">{money(open$)}</p>
          <p className="text-xs text-muted-foreground">Total da fatura: <span className="num">{money(total)}</span></p>
          <Button className="mt-3 w-full" disabled={open$ <= 0} onClick={() => { setPayDate(todayISO()); setPayAcc(data.accounts[0]?.id ?? ""); setPayOpen(true); }}>
            {open$ <= 0 && total > 0 ? "Fatura paga" : "Pagar fatura"}
          </Button>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Limite disponível</p>
          <p className={cn("num mt-1 text-2xl font-semibold", u.over ? "text-expense" : "text-income")}>{money(u.available)}</p>
          <Progress value={card.limit ? Math.min(100, (u.used / card.limit) * 100) : 0} className="mt-3 h-2" />
          <p className="mt-1.5 text-xs text-muted-foreground">Usado <span className="num">{money(u.used)}</span> de <span className="num">{money(card.limit)}</span> (inclui parcelas futuras)</p>
        </div>
      </div>
      <TransactionList items={items} emptyText="Nenhuma compra nesta fatura." />
      <TransactionForm open={open} onOpenChange={setOpen} defaultSource={`card:${card.id}`} />
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Pagar fatura</DialogTitle></DialogHeader>
          <p className="num text-2xl font-semibold">{money(open$)}</p>
          <div className="space-y-1.5">
            <Label>Debitar da conta</Label>
            <Select value={payAcc} onValueChange={setPayAcc}>
              <SelectTrigger><SelectValue placeholder="Conta" /></SelectTrigger>
              <SelectContent>{data.accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
          <DialogFooter><Button onClick={pay}>Confirmar pagamento</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
