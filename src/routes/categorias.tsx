import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from "@/hooks/use-data";
import { PageHeader } from "@/components/finai/PageHeader";
import { db, uid } from "@/lib/db";

export const Route = createFileRoute("/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias — FinAI" },
      { name: "description", content: "Crie, edite e exclua categorias e subcategorias de receitas e despesas." },
      { property: "og:title", content: "Categorias — FinAI" },
      { property: "og:description", content: "Organize suas categorias e subcategorias." },
    ],
  }),
  component: Categorias,
});

const COLORS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

function InlineEdit({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="flex flex-1 items-center gap-1">
      <Input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && v.trim() && onSave(v.trim())} className="h-8" />
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => v.trim() && onSave(v.trim())}><Check /></Button>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel}><X /></Button>
    </div>
  );
}

function Categorias() {
  const data = useData();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [newCat, setNewCat] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [newSub, setNewSub] = useState<Record<string, string>>({});
  if (!data) return null;
  const cats = data.categories.filter((c) => c.kind === kind);

  async function addCat() {
    if (!newCat.trim()) return;
    await db.categories.add({ id: uid(), name: newCat.trim(), kind, color: COLORS[cats.length % COLORS.length] });
    setNewCat("");
  }
  async function delCat(id: string) {
    const used = await db.transactions.where("category_id").equals(id).count();
    if (used) return toast.error(`Categoria usada em ${used} lançamentos.`);
    await db.subcategories.where("category_id").equals(id).delete();
    await db.categories.delete(id);
  }
  async function delSub(id: string) {
    const used = data!.transactions.filter((t) => t.subcategory_id === id).length;
    if (used) return toast.error(`Subcategoria usada em ${used} lançamentos.`);
    await db.subcategories.delete(id);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Categorias" subtitle="Organize receitas e despesas com subcategorias." />
      <Tabs value={kind} onValueChange={(v) => setKind(v as "expense" | "income")}>
        <TabsList><TabsTrigger value="expense">Despesas</TabsTrigger><TabsTrigger value="income">Receitas</TabsTrigger></TabsList>
      </Tabs>
      <div className="flex gap-2">
        <Input placeholder="Nova categoria" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCat()} />
        <Button onClick={addCat}><Plus /> Adicionar</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {cats.map((c) => (
          <div key={c.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: `var(--${c.color})` }} />
              {editing === c.id ? (
                <InlineEdit value={c.name} onCancel={() => setEditing(null)} onSave={async (v) => { await db.categories.update(c.id, { name: v }); setEditing(null); }} />
              ) : (
                <>
                  <p className="flex-1 font-semibold">{c.name}</p>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(c.id)}><Pencil /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-expense" onClick={() => delCat(c.id)}><Trash2 /></Button>
                </>
              )}
            </div>
            <ul className="mt-2 space-y-1">
              {data.subcategories.filter((s) => s.category_id === c.id).map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-accent">
                  {editing === s.id ? (
                    <InlineEdit value={s.name} onCancel={() => setEditing(null)} onSave={async (v) => { await db.subcategories.update(s.id, { name: v }); setEditing(null); }} />
                  ) : (
                    <>
                      <span className="flex-1 text-muted-foreground">{s.name}</span>
                      <button aria-label="Editar" onClick={() => setEditing(s.id)}><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      <button aria-label="Excluir" onClick={() => delSub(s.id)}><Trash2 className="h-3.5 w-3.5 text-expense" /></button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-1">
              <Input
                className="h-8 text-sm"
                placeholder="Nova subcategoria"
                value={newSub[c.id] ?? ""}
                onChange={(e) => setNewSub({ ...newSub, [c.id]: e.target.value })}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && newSub[c.id]?.trim()) {
                    await db.subcategories.add({ id: uid(), category_id: c.id, name: newSub[c.id].trim() });
                    setNewSub({ ...newSub, [c.id]: "" });
                  }
                }}
              />
              <Button size="sm" variant="secondary" className="h-8" onClick={async () => {
                if (!newSub[c.id]?.trim()) return;
                await db.subcategories.add({ id: uid(), category_id: c.id, name: newSub[c.id].trim() });
                setNewSub({ ...newSub, [c.id]: "" });
              }}><Plus /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
