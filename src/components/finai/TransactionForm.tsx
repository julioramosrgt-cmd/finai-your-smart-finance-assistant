import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, type Period, type Transaction, type TxType } from "@/lib/db";
import { buildTransactions, normalizeTx, todayISO } from "@/lib/finance";
import { parseMoney } from "@/lib/format";
import { useData } from "@/hooks/use-data";
import { useProfile } from "@/hooks/use-profile";

type Scope = "one" | "series";

export function TransactionForm({
  open,
  onOpenChange,
  editing,
  defaultSource,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing?: Transaction | null;
  defaultSource?: string; // "acc:id" | "card:id"
}) {
  const data = useData();
  const profile = useProfile();
  const [type, setType] = useState<TxType>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [due, setDue] = useState(todayISO());
  const [source, setSource] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [cat, setCat] = useState("");
  const [sub, setSub] = useState("");
  const [installments, setInstallments] = useState("1");
  const [recurring, setRecurring] = useState<Period | "none">("none");
  const [paid, setPaid] = useState(false);
  const [scope, setScope] = useState<Scope>("one");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setDescription(editing.description.replace(/ \(\d+\/\d+\)$/, ""));
      setAmount(String(editing.amount).replace(".", ","));
      setDate(editing.date);
      setDue(editing.due_date);
      setSource(editing.card_id ? `card:${editing.card_id}` : `acc:${editing.account_id}`);
      setToAccount(editing.to_account_id ?? "");
      setCat(editing.category_id);
      setSub(editing.subcategory_id ?? "");
      setPaid(editing.status === "paid");
      setScope("one");
    } else {
      setType("expense");
      setDescription("");
      setAmount("");
      setDate(todayISO());
      setDue(todayISO());
      setSource(defaultSource ?? "");
      setToAccount("");
      setCat("");
      setSub("");
      setInstallments("1");
      setRecurring("none");
      setPaid(false);
    }
  }, [open, editing, defaultSource]);

  const isCard = source.startsWith("card:");
  const cats = useMemo(
    () => (data?.categories ?? []).filter((c) => c.kind === (type === "income" ? "income" : "expense")),
    [data, type],
  );
  const subs = (data?.subcategories ?? []).filter((s) => s.category_id === cat);

  async function save() {
    const value = parseMoney(amount);
    if (!description.trim() || value <= 0 || !source) {
      toast.error("Preencha descrição, valor e origem.");
      return;
    }
    if (type === "transfer" && (!toAccount || isCard)) {
      toast.error("Transferências precisam de conta de origem e destino.");
      return;
    }
    const [kind, id] = source.split(":");
    if (kind === "acc" && !data?.accounts.some((account) => account.id === id)) {
      toast.error("Selecione uma conta do perfil ativo.");
      return;
    }
    if (kind === "card" && !data?.cards.some((card) => card.id === id)) {
      toast.error("Selecione um cartão do perfil ativo.");
      return;
    }
    if (type === "transfer" && !data?.accounts.some((account) => account.id === toAccount)) {
      toast.error("Selecione uma conta de destino do perfil ativo.");
      return;
    }
    if (editing) {
      const patch = {
        type,
        category_id: type === "transfer" ? "" : cat,
        subcategory_id: sub || undefined,
        account_id: kind === "acc" ? id : undefined,
        card_id: kind === "card" ? id : undefined,
        to_account_id: type === "transfer" ? toAccount : undefined,
      };
      if (scope === "series" && editing.series_id) {
        const all = await db.transactions.where("series_id").equals(editing.series_id).toArray();
        const targets = all.filter((t) => t.date >= editing.date);
        await db.transaction("rw", db.transactions, db.cards, db.accounts, async () => {
          for (const t of targets) {
            const desc = t.is_installment ? `${description.trim()} (${t.current_installment}/${t.total_installments})` : description.trim();
            const next = await normalizeTx({ ...t, ...patch, description: desc, amount: t.is_installment ? t.amount : value });
            await db.transactions.put(next);
          }
        });
      } else {
        const desc = editing.is_installment
          ? `${description.trim()} (${editing.current_installment}/${editing.total_installments})`
          : description.trim();
        const next = await normalizeTx({
          ...editing,
          ...patch,
          description: desc,
          amount: value,
          date,
          due_date: due,
          status: kind === "card" ? editing.status : paid ? "paid" : "pending",
          paid_at: kind === "card" ? editing.paid_at : paid ? (editing.paid_at ?? todayISO()) : undefined,
        });
        await db.transactions.put(next);
      }
      toast.success("Lançamento atualizado. Saldos e limites recalculados.");
    } else {
      const txs = await buildTransactions({
        description,
        amount: value,
        date,
        due_date: isCard ? date : due,
        type,
        source: kind === "card" ? { kind: "card", id } : { kind: "account", id },
        to_account_id: toAccount,
        category_id: type === "transfer" ? "" : cat,
        subcategory_id: sub,
        installments: Math.max(1, Number(installments) || 1),
        recurring: recurring === "none" ? undefined : recurring,
        paid,
      });
      await db.transactions.bulkAdd(txs.map((transaction) => ({ ...transaction, profile })));
      toast.success(txs.length > 1 ? `${txs.length} lançamentos projetados.` : "Lançamento criado.");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Tabs value={type} onValueChange={(v) => setType(v as TxType)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="expense">Despesa</TabsTrigger>
              <TabsTrigger value="income">Receita</TabsTrigger>
              <TabsTrigger value="transfer">Transferência</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-3 space-y-1.5">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Supermercado" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>{Number(installments) > 1 && !editing ? "Valor total" : "Valor"}</Label>
              <Input inputMode="decimal" className="num" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{type === "transfer" ? "Conta de origem" : "Conta ou cartão"}</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {data?.accounts.map((a) => (
                  <SelectItem key={a.id} value={`acc:${a.id}`}>
                    {a.name} · {a.institution_name}
                  </SelectItem>
                ))}
                {type !== "transfer" &&
                  data?.cards.map((c) => (
                    <SelectItem key={c.id} value={`card:${c.id}`}>
                      Cartão {c.name} · {c.institution_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {type === "transfer" && (
            <div className="space-y-1.5">
              <Label>Conta de destino</Label>
              <Select value={toAccount} onValueChange={setToAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {data?.accounts
                    .filter((a) => `acc:${a.id}` !== source)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {type !== "transfer" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={cat} onValueChange={(v) => { setCat(v); setSub(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {cats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subcategoria</Label>
                <Select value={sub} onValueChange={setSub} disabled={!subs.length}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {subs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {(!editing || scope === "one") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isCard ? "Data da compra" : "Competência"}</Label>
                <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); if (!editing) setDue(e.target.value); }} />
              </div>
              {!isCard && (
                <div className="space-y-1.5">
                  <Label>Vencimento</Label>
                  <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                </div>
              )}
            </div>
          )}
          {!editing && type !== "transfer" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                <Input type="number" min={1} max={72} value={installments} disabled={recurring !== "none"} onChange={(e) => setInstallments(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Recorrência</Label>
                <Select value={recurring} onValueChange={(v) => setRecurring(v as Period | "none")} disabled={Number(installments) > 1}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {!isCard && (!editing || scope === "one") && (
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Já foi pago / recebido</p>
                <p className="text-xs text-muted-foreground">Datas futuras ficam pendentes e não alteram o saldo atual.</p>
              </div>
              <Switch checked={paid} onCheckedChange={setPaid} />
            </div>
          )}
          {editing?.series_id && (
            <div className="space-y-1.5">
              <Label>Aplicar alteração em</Label>
              <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="one">Só esta ocorrência</TabsTrigger>
                  <TabsTrigger value="series">Esta e as próximas</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
