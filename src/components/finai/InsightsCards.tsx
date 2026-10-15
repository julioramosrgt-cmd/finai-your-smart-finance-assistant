import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bot, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { buildSnapshot, todayISO } from "@/lib/finance";
import { cn } from "@/lib/utils";

export function InsightsCards() {
  const today = todayISO();
  const rec = useLiveQuery(() => db.insights.get(today), [today]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot: await buildSnapshot() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await db.insights.put({ id: today, items: json.insights });
    } catch (e) {
      setError((e as Error).message || "Não foi possível gerar insights.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-ai/25 bg-ai/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ai-gradient text-ai-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <h2 className="font-semibold">Insights do dia</h2>
        <Button size="sm" variant="ghost" className="ml-auto gap-1.5 text-ai" onClick={generate} disabled={loading}>
          <RefreshCw className={cn(loading && "animate-spin")} /> {rec ? "Atualizar" : "Gerar"}
        </Button>
      </div>
      {error && <p className="text-sm text-expense">{error}</p>}
      {!rec && !loading && !error && (
        <p className="text-sm text-muted-foreground">Toque em "Gerar" para a IA analisar seus dados e trazer recomendações de hoje.</p>
      )}
      {loading && !rec && <p className="text-sm text-muted-foreground">Analisando seus dados…</p>}
      {rec && (
        <div className="grid gap-3 sm:grid-cols-2">
          {rec.items.map((it, i) => (
            <div
              key={i}
              className={cn(
                "rounded-xl border bg-card p-3",
                it.tone === "alert" && "border-expense/40",
                it.tone === "warning" && "border-warning/40",
                it.tone === "positive" && "border-income/40",
              )}
            >
              <p className="text-sm font-semibold">{it.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{it.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
