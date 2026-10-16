import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db, uid, type Account, type AccountKind, type Card } from "@/lib/db";
import { normalizeTx } from "@/lib/finance";
import { parseMoney } from "@/lib/format";
import { useProfile } from "@/hooks/use-profile";
import { useData } from "@/hooks/use-data";

export const KIND_LABEL: Record<AccountKind, string> = {
  checking: "Conta corrente",
  benefit_card: "Cartão benefício",
  investment: "Investimento",
  loan: "Empréstimo",
};

export function AccountForm({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing?: Account | null }) {
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [kind, setKind] = useState<AccountKind>("checking");
  const [bal, setBal] = useState("");
  const [linkedAccount, setLinkedAccount] = useState("");
  const profile = useProfile();
  const data = useData();
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setBank(editing?.institution_name ?? "");
    setKind(editing?.kind ?? "checking");
    setBal(editing ? String(editing.initial_balance).replace(".", ",") : "");
    setLinkedAccount(editing?.linked_account_id ?? "");
  }, [open, editing]);
  async function save() {
    if (!name.trim()) return toast.error("Informe o nome.");
    const linkedAccountRecord = data?.accounts.find((account) => account.id === linkedAccount && account.kind === "checking");
    if (kind === "investment" && !linkedAccountRecord) return toast.error("Vincule o investimento a uma conta corrente do mesmo perfil.");
    const accounts = await db.accounts.where("profile").equals(editing?.profile ?? profile).toArray();
    const acc: Account = {
      id: editing?.id ?? uid(),
      profile: editing?.profile ?? profile,
      name: name.trim(),
      institution_name: bank.trim(),
      kind,
      initial_balance: parseMoney(bal),
      linked_account_id: kind === "investment" ? linkedAccount : undefined,
      created_at: editing?.created_at ?? new Date().toISOString(),
      sort_order: editing?.sort_order ?? Math.max(-1, ...accounts.map((account, index) => account.sort_order ?? index)) + 1,
    };
    await db.accounts.put(acc);
    if (editing) {
      const txs = await db.transactions.where("account_id").equals(acc.id).toArray();
      for (const t of txs) await db.transactions.put(await normalizeTx(t));
    }
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Instituição</Label><Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Itaú, Caixa…" /></div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as AccountKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {kind === "investment" && (
            <div className="col-span-2 space-y-1.5">
              <Label>Conta de Vínculo <span className="text-expense">*</span></Label>
              <Select value={linkedAccount} onValueChange={setLinkedAccount}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta corrente" /></SelectTrigger>
                <SelectContent>
                  {data?.accounts.filter((account) => account.kind === "checking" && account.id !== editing?.id).map((account) => (
                    <SelectItem key={account.id} value={account.id}>{account.name} · {account.institution_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="col-span-2 space-y-1.5"><Label>Saldo inicial</Label><Input className="num" inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CardForm({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing?: Card | null }) {
  const profile = useProfile();
  const [f, setF] = useState({ name: "", bank: "", limit: "", closing: "5", due: "12" });
  useEffect(() => {
    if (!open) return;
    setF(
      editing
        ? { name: editing.name, bank: editing.institution_name, limit: String(editing.limit).replace(".", ","), closing: String(editing.closing_day), due: String(editing.due_day) }
        : { name: "", bank: "", limit: "", closing: "5", due: "12" },
    );
  }, [open, editing]);
  async function save() {
    if (!f.name.trim()) return toast.error("Informe o nome.");
    const cards = await db.cards.where("profile").equals(editing?.profile ?? profile).toArray();
    const card: Card = {
      id: editing?.id ?? uid(),
      profile: editing?.profile ?? profile,
      name: f.name.trim(),
      institution_name: f.bank.trim(),
      limit: parseMoney(f.limit),
      closing_day: Math.min(28, Math.max(1, Number(f.closing) || 1)),
      due_day: Math.min(28, Math.max(1, Number(f.due) || 10)),
      created_at: editing?.created_at ?? new Date().toISOString(),
      sort_order: editing?.sort_order ?? Math.max(-1, ...cards.map((item, index) => item.sort_order ?? index)) + 1,
    };
    await db.cards.put(card);
    if (editing) {
      // Recalcula faturas das compras em aberto quando muda fechamento/vencimento
      const txs = await db.transactions.where("card_id").equals(card.id).toArray();
      for (const t of txs) if (t.status !== "paid") await db.transactions.put(await normalizeTx(t));
    }
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Editar cartão" : "Novo cartão"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Instituição</Label><Input value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Limite</Label><Input className="num" inputMode="decimal" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Dia de fechamento</Label><Input type="number" value={f.closing} onChange={(e) => setF({ ...f, closing: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Dia de vencimento</Label><Input type="number" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
