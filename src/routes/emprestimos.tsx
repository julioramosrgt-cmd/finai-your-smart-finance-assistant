import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/finai/PageHeader";
import { useData } from "@/hooks/use-data";
import { db, uid, type LoanContract } from "@/lib/db";
import { money, parseMoney } from "@/lib/format";

export const Route = createFileRoute("/emprestimos")({
  head: () => ({ meta: [{ title: "Empréstimos e financiamentos — FinAI" }] }),
  component: Loans,
});

const CONTRACT_TYPES = ["Empréstimo pessoal", "Consignado", "Financiamento imobiliário", "Financiamento de veículo", "Crédito estudantil", "Outro"];

function Loans() {
  const data = useData();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LoanContract | null>(null);
  if (!data) return null;
  const contracts = [...data.loanContracts].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const totalDebt = contracts.reduce((total, contract) => total + contract.outstanding_balance, 0);
  const monthlyPayments = contracts.reduce((total, contract) => total + contract.installment_amount, 0);

  async function remove(contract: LoanContract) {
    if (!window.confirm(`Excluir o contrato “${contract.name}”?`)) return;
    await db.loanContracts.delete(contract.id);
    toast.success("Contrato excluído.");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empréstimos e financiamentos"
        subtitle="Acompanhe seus contratos, saldo devedor e parcelas restantes."
        actions={<Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Novo contrato</Button>}
      />
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Saldo devedor total</p>
          <p className="num mt-1 text-2xl font-semibold text-expense">{money(totalDebt)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{contracts.length} {contracts.length === 1 ? "contrato ativo" : "contratos cadastrados"}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Parcelas mensais somadas</p>
          <p className="num mt-1 text-2xl font-semibold">{money(monthlyPayments)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Valor das parcelas informadas nos contratos</p>
        </div>
      </section>
      {contracts.length === 0 ? (
        <EmptyState icon={<Banknote />} title="Nenhum contrato cadastrado" text="Cadastre empréstimos ou financiamentos para acompanhar o saldo devedor e as parcelas restantes." action={<Button variant="secondary" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Cadastrar contrato</Button>} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {contracts.map((contract) => (
            <article key={contract.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{contract.name}</h2>
                  <p className="text-sm text-muted-foreground">{contract.kind} · {contract.institution_name || "Instituição não informada"}</p>
                </div>
                <div className="flex shrink-0">
                  <Button aria-label={`Editar ${contract.name}`} size="icon" variant="ghost" onClick={() => { setEditing(contract); setFormOpen(true); }}><Pencil /></Button>
                  <Button aria-label={`Excluir ${contract.name}`} size="icon" variant="ghost" className="text-expense" onClick={() => remove(contract)}><Trash2 /></Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
                <Metric label="Saldo devedor" value={money(contract.outstanding_balance)} prominent />
                <Metric label="Parcelas restantes" value={contract.total_installments ? `${contract.installments_remaining} de ${contract.total_installments}` : String(contract.installments_remaining)} />
                <Metric label="Valor da parcela" value={money(contract.installment_amount)} />
                <Metric label="Valor contratado" value={money(contract.original_amount)} />
                {contract.next_due_date && <Metric label="Próximo vencimento" value={new Date(`${contract.next_due_date}T12:00:00`).toLocaleDateString("pt-BR")} />}
                {contract.interest_rate !== undefined && <Metric label="Juros informados" value={`${contract.interest_rate}% a.m.`} />}
              </div>
              {contract.notes && <p className="mt-4 border-t pt-3 text-sm text-muted-foreground">{contract.notes}</p>}
            </article>
          ))}
        </section>
      )}
      <LoanForm open={formOpen} onOpenChange={setFormOpen} editing={editing} />
    </div>
  );
}

function Metric({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className={`num mt-0.5 font-medium ${prominent ? "text-lg text-expense" : "text-sm"}`}>{value}</p></div>;
}

type LoanFormValues = {
  name: string;
  institution_name: string;
  kind: string;
  original_amount: string;
  outstanding_balance: string;
  installment_amount: string;
  total_installments: string;
  installments_remaining: string;
  next_due_date: string;
  interest_rate: string;
  notes: string;
};

const emptyForm: LoanFormValues = {
  name: "", institution_name: "", kind: CONTRACT_TYPES[0], original_amount: "", outstanding_balance: "", installment_amount: "",
  total_installments: "", installments_remaining: "", next_due_date: "", interest_rate: "", notes: "",
};

function LoanForm({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (open: boolean) => void; editing: LoanContract | null }) {
  const [form, setForm] = useState<LoanFormValues>(emptyForm);
  const set = (key: keyof LoanFormValues, value: string) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
        name: editing.name,
        institution_name: editing.institution_name,
        kind: editing.kind,
        original_amount: String(editing.original_amount).replace(".", ","),
        outstanding_balance: String(editing.outstanding_balance).replace(".", ","),
        installment_amount: String(editing.installment_amount).replace(".", ","),
        total_installments: editing.total_installments === undefined ? "" : String(editing.total_installments),
        installments_remaining: String(editing.installments_remaining),
        next_due_date: editing.next_due_date ?? "",
        interest_rate: editing.interest_rate === undefined ? "" : String(editing.interest_rate).replace(".", ","),
        notes: editing.notes ?? "",
    } : emptyForm);
  }, [open, editing]);

  async function save() {
    const remaining = Number(form.installments_remaining);
    const total = form.total_installments ? Number(form.total_installments) : undefined;
    if (!form.name.trim()) return toast.error("Informe o nome do contrato.");
    if (!form.outstanding_balance || parseMoney(form.outstanding_balance) < 0) return toast.error("Informe um saldo devedor válido.");
    if (!form.installments_remaining || !Number.isInteger(remaining) || remaining < 0) return toast.error("Informe a quantidade de parcelas restantes.");
    if (total !== undefined && (!Number.isInteger(total) || total < remaining)) return toast.error("O total de parcelas deve ser inteiro e maior ou igual às parcelas restantes.");
    const contract: LoanContract = {
      id: editing?.id ?? uid(),
      name: form.name.trim(),
      institution_name: form.institution_name.trim(),
      kind: form.kind,
      original_amount: parseMoney(form.original_amount),
      outstanding_balance: parseMoney(form.outstanding_balance),
      installment_amount: parseMoney(form.installment_amount),
      installments_remaining: remaining,
      total_installments: total,
      next_due_date: form.next_due_date || undefined,
      interest_rate: form.interest_rate ? parseMoney(form.interest_rate) : undefined,
      notes: form.notes.trim() || undefined,
      created_at: editing?.created_at ?? new Date().toISOString(),
    };
    await db.loanContracts.put(contract);
    toast.success(editing ? "Contrato atualizado." : "Contrato cadastrado.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editing ? "Editar contrato" : "Novo contrato"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label htmlFor="loan-name">Nome do contrato</Label><Input id="loan-name" autoFocus value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Ex.: Financiamento do imóvel" /></div>
          <div className="space-y-1.5"><Label htmlFor="loan-institution">Instituição</Label><Input id="loan-institution" value={form.institution_name} onChange={(event) => set("institution_name", event.target.value)} placeholder="Banco ou financeira" /></div>
          <div className="space-y-1.5"><Label>Modalidade</Label><Select value={form.kind} onValueChange={(value) => set("kind", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CONTRACT_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="loan-original">Valor contratado</Label><Input id="loan-original" inputMode="decimal" value={form.original_amount} onChange={(event) => set("original_amount", event.target.value)} placeholder="0,00" /></div>
          <div className="space-y-1.5"><Label htmlFor="loan-balance">Saldo devedor</Label><Input id="loan-balance" inputMode="decimal" value={form.outstanding_balance} onChange={(event) => set("outstanding_balance", event.target.value)} placeholder="0,00" /></div>
          <div className="space-y-1.5"><Label htmlFor="loan-installment">Valor da parcela</Label><Input id="loan-installment" inputMode="decimal" value={form.installment_amount} onChange={(event) => set("installment_amount", event.target.value)} placeholder="0,00" /></div>
          <div className="space-y-1.5"><Label htmlFor="loan-total">Total de parcelas</Label><Input id="loan-total" type="number" min="0" value={form.total_installments} onChange={(event) => set("total_installments", event.target.value)} placeholder="Opcional" /></div>
          <div className="space-y-1.5"><Label htmlFor="loan-remaining">Parcelas restantes</Label><Input id="loan-remaining" type="number" min="0" required value={form.installments_remaining} onChange={(event) => set("installments_remaining", event.target.value)} placeholder="0" /></div>
          <div className="space-y-1.5"><Label htmlFor="loan-due">Próximo vencimento</Label><Input id="loan-due" type="date" value={form.next_due_date} onChange={(event) => set("next_due_date", event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="loan-rate">Juros (% ao mês)</Label><Input id="loan-rate" inputMode="decimal" value={form.interest_rate} onChange={(event) => set("interest_rate", event.target.value)} placeholder="Opcional" /></div>
          <div className="col-span-2 space-y-1.5"><Label htmlFor="loan-notes">Observações</Label><Input id="loan-notes" value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Informações adicionais" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save}>Salvar contrato</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
