import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useData } from "@/hooks/use-data";
import { PageHeader } from "@/components/finai/PageHeader";
import { db } from "@/lib/db";
import { buildTransactions } from "@/lib/finance";
import { parseCSV, parseOFX, parsePDF, reconcile, type ReconRow } from "@/lib/importers";
import { dateBR, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/importar")({
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
  const [target, setTarget] = useState("");
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [cat, setCat] = useState("");
  if (!data) return null;

  async function onFile(file: File) {
    if (!target) return toast.error("Escolha primeiro a conta ou cartão.");
    setLoading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const parsed = ext === "ofx" ? parseOFX(await file.text()) : ext === "csv" ? parseCSV(await file.text()) : ext === "pdf" ? await parsePDF(file) : [];
      if (!parsed.length) throw new Error("Nenhuma transação encontrada no arquivo.");
      const [kind, id] = target.split(":");
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
    let created = 0;
    let adjusted = 0;
    for (const r of rows) {
      if (!sel.has(r.key)) continue;
      if (r.status === "diff_amount" && r.match) {
        await db.transactions.update(r.match.id, { amount: r.amount });
        adjusted++;
      } else if (r.status === "missing" || r.status === "duplicate") {
        const fallback = data!.categories.find((c) => c.kind === r.type);
        const txs = await buildTransactions({
          description: r.description,
          amount: r.amount,
          date: r.date,
          due_date: r.date,
          type: r.type,
          source: kind === "card" ? { kind: "card", id } : { kind: "account", id },
          category_id: r.type === "expense" && cat ? cat : (fallback?.id ?? ""),
          installments: 1,
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

  const counts = rows.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <PageHeader title="Importar e conciliar" subtitle="OFX, CSV ou PDF de extratos e faturas. Tudo é processado com privacidade." />
      <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Conta ou cartão do arquivo</Label>
          <Select value={target} onValueChange={(v) => { setTarget(v); setRows([]); }}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {data.accounts.map((a) => <SelectItem key={a.id} value={`acc:${a.id}`}>{a.name}</SelectItem>)}
              {data.cards.map((c) => <SelectItem key={c.id} value={`card:${c.id}`}>Cartão {c.name}</SelectItem>)}
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateBR(r.date)}
                    {r.match && ` · no app: ${r.match.description} (${money(r.match.amount)})`}
                  </p>
                </div>
                <span className={cn("num text-sm font-semibold", r.type === "income" ? "text-income" : "text-expense")}>{money(r.amount)}</span>
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
