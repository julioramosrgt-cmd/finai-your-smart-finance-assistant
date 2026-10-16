import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/hooks/use-data";
import { PageHeader } from "@/components/finai/PageHeader";
import { db, uid } from "@/lib/db";
import { buildTransactions, normalizeTx } from "@/lib/finance";
import { parseCSV, parseLoanPDF, parseOFX, parsePDF, reconcile, type ExtractedLoanDetails, type ReconRow } from "@/lib/importers";
import { dateBR, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/importar")({
  validateSearch: (search: Record<string, unknown>) => ({
    target: typeof search.target === "string" ? search.target : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Importar e conciliar — FinAI" },
      { name: "description", content: "Importe extratos OFX, CSV e PDF e concilie com seus lançamentos." },
      { property: "og:title", content: "Importar e conciliar — FinAI" },
      { property: "og:description", content: "Conciliação inteligente de extratos e faturas." },
    ],
  }),
  component: Importar,
});

const LABEL: Record<ReconRow["status"], { text: string; cls: string }> = {
  matched: { text: "Conciliado", cls: "bg-income/15 text-income" },
  diff_amount: { text: "Valor diferente", cls: "bg-warning/20 text-warning" },
  missing: { text: "Não encontrado", cls: "bg-expense/15 text-expense" },
  duplicate: { text: "Duplicado no arquivo", cls: "bg-ai/15 text-ai" },
};

function Importar() {
  const data = useData();
  const profile = useProfile();
  const { target: initialTarget } = Route.useSearch();
  const [target, setTarget] = useState(initialTarget ?? "");
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [cat, setCat] = useState("");
  const [loanDraft, setLoanDraft] = useState<ExtractedLoanDetails | null>(null);
  if (!data) return null;

  async function onFile(file: File) {
    if (!target) return toast.error("Escolha primeiro a conta, cartão ou contrato.");
    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const [kind, id] = target.split(":");
      if (kind === "loan") {
        if (ext !== "pdf") throw new Error("Contratos e demonstrativos de dívida aceitam arquivos PDF.");
        const extracted = await parseLoanPDF(file);
        if (!Object.values(extracted).some((value) => value !== null)) throw new Error("Não foram identificados dados do contrato. Confira se o PDF possui texto selecionável.");
        setLoanDraft(extracted);
        setRows([]);
        toast.success("Dados extraídos. Revise antes de atualizar o contrato.");
        return;
      }
      setLoanDraft(null);
      const parsed = ext === "ofx" ? parseOFX(await file.text()) : ext === "csv" ? parseCSV(await file.text()) : ext === "pdf" ? await parsePDF(file) : [];
      if (!parsed.length) throw new Error("Nenhuma transação encontrada no arquivo.");
      const existing = data!.transactions.filter((t) => (kind === "card" ? t.card_id === id : t.account_id === id));
      const r = reconcile(parsed, existing);
      setRows(r);
      setSel(new Set(r.filter((x) => x.status === "missing" || x.status === "diff_amount").map((x) => x.key)));
      toast.success(`${parsed.length} transações lidas.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    const [kind, id] = target.split(":");
    if (kind === "loan") {
      if (!loanDraft) return;
      const contract = data!.loanContracts.find((item) => item.id === id);
      if (id !== "new" && !contract) return toast.error("Contrato não encontrado no perfil atual.");
      const numberOrUndefined = (value: number | null, previous: number | undefined) => value === null ? previous : value;
      const remaining = loanDraft.installments_remaining ?? (loanDraft.total_installments !== null && loanDraft.installments_paid !== null ? loanDraft.total_installments - loanDraft.installments_paid : null);
      if ((remaining !== null && remaining < 0) || [loanDraft.original_amount, loanDraft.outstanding_balance, loanDraft.installment_amount, loanDraft.interest_rate].some((value) => value !== null && value < 0)) {
        return toast.error("Revise os valores: parcelas e montantes não podem ser negativos.");
      }
      if (id === "new") {
        if (!loanDraft.name?.trim() || loanDraft.outstanding_balance === null || remaining === null) {
          return toast.error("Para cadastrar pelo PDF, informe nome, saldo devedor e parcelas restantes.");
        }
        await db.loanContracts.add({
          id: uid(), profile, name: loanDraft.name.trim(), institution_name: loanDraft.institution_name?.trim() ?? "",
          kind: loanDraft.kind?.trim() || "Outro", original_amount: loanDraft.original_amount ?? 0,
          outstanding_balance: loanDraft.outstanding_balance, installment_amount: loanDraft.installment_amount ?? 0,
          total_installments: loanDraft.total_installments ?? undefined, installments_remaining: remaining,
          next_due_date: loanDraft.next_due_date ?? undefined, interest_rate: loanDraft.interest_rate ?? undefined,
          created_at: new Date().toISOString(),
        });
        toast.success("Contrato cadastrado após sua confirmação.");
        setLoanDraft(null);
        return;
      }
      await db.loanContracts.update(id, {
        name: loanDraft.name?.trim() || contract!.name,
        institution_name: loanDraft.institution_name?.trim() || contract!.institution_name,
        kind: loanDraft.kind?.trim() || contract!.kind,
        original_amount: numberOrUndefined(loanDraft.original_amount, contract!.original_amount),
        outstanding_balance: numberOrUndefined(loanDraft.outstanding_balance, contract!.outstanding_balance),
        installment_amount: numberOrUndefined(loanDraft.installment_amount, contract!.installment_amount),
        total_installments: numberOrUndefined(loanDraft.total_installments, contract!.total_installments),
        installments_remaining: numberOrUndefined(remaining, contract!.installments_remaining),
        next_due_date: loanDraft.next_due_date || contract!.next_due_date,
        interest_rate: numberOrUndefined(loanDraft.interest_rate, contract!.interest_rate),
      });
      toast.success("Contrato atualizado após sua confirmação.");
      setLoanDraft(null);
      return;
    }
    let created = 0;
    let adjusted = 0;
    for (const r of rows) {
      if (!sel.has(r.key)) continue;
      if (!r.description.trim() || !r.date || !Number.isFinite(r.amount) || r.amount <= 0) {
        return toast.error("Revise descrição, data e valor dos lançamentos selecionados.");
      }
      if (kind === "card" && ((r.current_installment != null || r.total_installments != null) && (!Number.isInteger(r.current_installment) || !Number.isInteger(r.total_installments) || r.current_installment! < 1 || r.total_installments! < r.current_installment!))) {
        return toast.error("Informe parcela atual e total válidos para compras parceladas.");
      }
      if (r.status === "diff_amount" && r.match) {
        const updated = await normalizeTx({ ...r.match, amount: r.amount, description: r.description, date: r.date });
        await db.transactions.put(updated);
        adjusted++;
      } else if (r.status === "missing" || r.status === "duplicate") {
        const fallback = data!.categories.find((c) => c.kind === r.type);
        const installmentDetailsAvailable = kind === "card" && r.current_installment != null && r.total_installments != null;
        const txs = await buildTransactions({
          description: r.description,
          amount: installmentDetailsAvailable ? r.amount * r.total_installments! : r.amount,
          date: r.date,
          due_date: r.date,
          type: r.type,
          source: kind === "card" ? { kind: "card", id } : { kind: "account", id },
          category_id: r.type === "expense" && cat ? cat : (fallback?.id ?? ""),
          installments: installmentDetailsAvailable ? r.total_installments! : 1,
          firstInstallment: r.current_installment ?? 1,
          paid: true,
          paid_at: r.date,
        });
        await db.transactions.bulkAdd(txs.map((transaction) => ({ ...transaction, profile })));
        created++;
      }
    }
    toast.success(`${created} importados, ${adjusted} ajustados.`);
    setRows([]);
  }

  function updateLoanDraft(field: keyof ExtractedLoanDetails, raw: string, type: string) {
    const value = type === "text" || type === "date" ? raw || null : raw === "" ? null : Number(raw);
    setLoanDraft((current) => current ? { ...current, [field]: value } as ExtractedLoanDetails : current);
  }

  const counts = rows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <PageHeader title="Importar e conciliar" subtitle="OFX, CSV ou PDF de extratos e faturas. Tudo é processado com privacidade." />
      <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Conta, cartão ou contrato do arquivo</Label>
          <Select value={target} onValueChange={(v) => { setTarget(v); setRows([]); setLoanDraft(null); }}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {data.accounts.map((a) => <SelectItem key={a.id} value={`acc:${a.id}`}>{a.name}</SelectItem>)}
              {data.cards.map((c) => <SelectItem key={c.id} value={`card:${c.id}`}>Cartão {c.name}</SelectItem>)}
              {data.loanContracts.map((loan) => <SelectItem key={loan.id} value={`loan:${loan.id}`)}>Dívida: {loan.name}</SelectItem>)}
              <SelectItem value="loan:new">Cadastrar contrato a partir de PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Categoria padrão para despesas novas</Label>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger><SelectValue placeholder="Automática" /></SelectTrigger>
            <SelectContent>{data.categories.filter((c) => c.kind === "expense").map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-3 text-sm", !target && "opacity-50")}>
          {loading ? <Loader2 className="animate-spin" /> : <FileUp className="text-primary" />}
          {loading ? "Lendo arquivo…" : "Escolher arquivo"}
          <input type="file" accept=".ofx,.csv,.pdf" className="hidden" disabled={!target || loading} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
        </label>
      </div>

      {loanDraft && target.startsWith("loan:") && (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <div><h2 className="font-semibold">Revisar dados extraídos</h2><p className="text-sm text-muted-foreground">Compare com o documento. Campos não encontrados permanecem inalterados; nada será salvo até confirmar.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ["name", "Nome do contrato", "text"], ["institution_name", "Instituição", "text"], ["kind", "Modalidade", "text"],
              ["original_amount", "Valor contratado", "number"], ["outstanding_balance", "Saldo devedor", "number"], ["installment_amount", "Valor da parcela", "number"],
              ["total_installments", "Total de parcelas", "number"], ["installments_remaining", "Parcelas restantes", "number"], ["installments_paid", "Parcelas pagas (informativo)", "number"],
              ["next_due_date", "Próximo vencimento", "date"], ["interest_rate", "Taxa de juros (%)", "number"],
            ] as const).map(([field, label, type]) => (
              <label key={field} className="space-y-1.5 text-sm"><span>{label}</span><Input type={type} step={type === "number" ? "any" : undefined} value={loanDraft[field] ?? ""} onChange={(event) => updateLoanDraft(field, event.target.value, type)} /></label>
            ))}
          </div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setLoanDraft(null)}>Descartar</Button><Button onClick={() => void apply()}>Confirmar atualização</Button></div>
        </section>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {Object.entries(LABEL).map(([k, v]) => <Badge key={k} className={cn("border-0", v.cls)}>{v.text}: {counts[k] ?? 0}</Badge>)}
          </div>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-3 px-3 py-2.5">
                <Checkbox
                  disabled={r.status === "matched"}
                  checked={sel.has(r.key)}
                  onCheckedChange={(c) => { const s = new Set(sel); if (c) s.add(r.key); else s.delete(r.key); setSel(s); }}
                />
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <Input aria-label="Descrição extraída" disabled={r.status === "matched"} value={r.description} onChange={(event) => setRows(rows.map((row) => row.key === r.key ? { ...row, description: event.target.value } : row))} />
                  <Input aria-label="Data extraída" type="date" disabled={r.status === "matched"} value={r.date} onChange={(event) => setRows(rows.map((row) => row.key === r.key ? { ...row, date: event.target.value } : row))} />
                  {r.match && <p className="truncate text-xs text-muted-foreground sm:col-span-2">No app: {r.match.description} ({money(r.match.amount)}) · {dateBR(r.match.date)}</p>}
                  {target.startsWith("card:") && <div className="flex gap-2 sm:col-span-2"><label className="flex items-center gap-1 text-xs text-muted-foreground">Parcela atual <Input aria-label="Parcela atual" className="w-20" type="number" min="1" disabled={r.status === "matched"} value={r.current_installment ?? ""} onChange={(event) => setRows(rows.map((row) => row.key === r.key ? { ...row, current_installment: event.target.value ? Number(event.target.value) : undefined } : row))} /></label><label className="flex items-center gap-1 text-xs text-muted-foreground">Total de parcelas <Input aria-label="Total de parcelas" className="w-20" type="number" min="1" disabled={r.status === "matched"} value={r.total_installments ?? ""} onChange={(event) => setRows(rows.map((row) => row.key === r.key ? { ...row, total_installments: event.target.value ? Number(event.target.value) : undefined } : row))} /></label></div>}
                </div>
                <Input aria-label="Valor extraído" className={cn("num w-28 text-right font-semibold", r.type === "income" ? "text-income" : "text-expense")} type="number" min="0" step="0.01" disabled={r.status === "matched"} value={r.amount} onChange={(event) => setRows(rows.map((row) => row.key === r.key ? { ...row, amount: Number(event.target.value) } : row))} />
                <Badge className={cn("hidden border-0 sm:inline-flex", LABEL[r.status].cls)}>{LABEL[r.status].text}</Badge>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRows([])}>Descartar</Button>
            <Button onClick={apply} disabled={!sel.size}>Importar/ajustar {sel.size} selecionados</Button>
          </div>
        </>
      )}
    </div>
  );
}
