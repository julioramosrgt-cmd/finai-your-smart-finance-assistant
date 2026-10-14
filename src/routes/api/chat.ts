import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod/v4";

type Lanc = {
  d: string;
  venc: string;
  desc: string;
  valor: number;
  tipo: string;
  cat: string;
  sub: string;
  origem: string;
  status: string;
  rec?: string;
  parc?: string;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { makeProvider, MODEL, reasoningOptions, errorResponse } = await import("@/lib/ai.server");
        try {
          const body = (await request.json()) as { messages: UIMessage[]; snapshot: Record<string, unknown> };
          const snapshot = body.snapshot ?? {};
          const lancs = (snapshot.lancamentos as Lanc[]) ?? [];
          const { lancamentos: _omit, ...resumo } = snapshot;
          const provider = makeProvider(request);

          const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

          const result = streamText({
            model: provider.responses(MODEL),
            instructions: `Você é o FinAI, consultor financeiro pessoal e empresarial (PF/PJ) do usuário. Responda sempre em português do Brasil, de forma objetiva, com valores formatados em ${String(snapshot.moeda ?? "BRL")}.
Use APENAS os dados reais abaixo e as ferramentas para calcular. Nunca invente números. Se não houver dados suficientes, diga isso e sugira o que cadastrar.
Regras do app: regime de competência (campo "d" é a competência, "venc" o vencimento). Parcelas são lançamentos separados por mês. Lançamentos futuros/pendentes não afetam o saldo atual, só a projeção. Faturas de cartão vencem no mês indicado.
Para priorizar faturas, considere vencimento mais próximo, valor e que cartão de crédito cobra os juros mais altos do mercado.
Resumo atual (JSON): ${JSON.stringify(resumo)}`,
            messages: await convertToModelMessages(body.messages),
            abortSignal: request.signal,
            providerOptions: reasoningOptions,
            stopWhen: stepCountIs(50),
            tools: {
              consultar_lancamentos: tool({
                description:
                  "Filtra os lançamentos do usuário e retorna total, quantidade e os maiores itens. Use para perguntas como 'quanto gastei com mercado este mês'.",
                inputSchema: z.object({
                  mes_inicio: z.string().nullable().describe("YYYY-MM inicial (competência) ou null"),
                  mes_fim: z.string().nullable().describe("YYYY-MM final (competência) ou null"),
                  tipo: z.enum(["income", "expense", "transfer"]).nullable(),
                  categoria: z.string().nullable().describe("Trecho do nome da categoria ou subcategoria"),
                  texto: z.string().nullable().describe("Trecho da descrição"),
                  origem: z.string().nullable().describe("Nome da conta ou cartão"),
                  status: z.enum(["pending", "paid", "overdue"]).nullable(),
                }),
                execute: async (f) => {
                  const rows = lancs.filter((l) => {
                    const m = l.d.slice(0, 7);
                    if (f.mes_inicio && m < f.mes_inicio) return false;
                    if (f.mes_fim && m > f.mes_fim) return false;
                    if (f.tipo && l.tipo !== f.tipo) return false;
                    if (f.status && l.status !== f.status) return false;
                    if (f.categoria && !norm(`${l.cat} ${l.sub}`).includes(norm(f.categoria))) return false;
                    if (f.texto && !norm(l.desc).includes(norm(f.texto))) return false;
                    if (f.origem && !norm(l.origem).includes(norm(f.origem))) return false;
                    return true;
                  });
                  const total = Math.round(rows.reduce((s, r) => s + r.valor, 0) * 100) / 100;
                  return {
                    quantidade: rows.length,
                    total,
                    maiores: [...rows].sort((a, b) => b.valor - a.valor).slice(0, 15),
                  };
                },
              }),
              simular_economia: tool({
                description: "Simula se é possível economizar um valor em um mês, comparando receitas e despesas previstas por competência.",
                inputSchema: z.object({ mes: z.string().describe("YYYY-MM"), meta: z.number() }),
                execute: async ({ mes, meta }) => {
                  const rows = lancs.filter((l) => l.d.startsWith(mes));
                  const receitas = rows.filter((r) => r.tipo === "income").reduce((s, r) => s + r.valor, 0);
                  const despesas = rows.filter((r) => r.tipo === "expense").reduce((s, r) => s + r.valor, 0);
                  const fixas = rows.filter((r) => r.tipo === "expense" && (r.rec || r.parc)).reduce((s, r) => s + r.valor, 0);
                  const sobra = receitas - despesas;
                  return {
                    receitas_previstas: receitas,
                    despesas_previstas: despesas,
                    despesas_fixas_ou_parceladas: fixas,
                    sobra_prevista: Math.round(sobra * 100) / 100,
                    atinge_meta: sobra >= meta,
                    falta: Math.max(0, Math.round((meta - sobra) * 100) / 100),
                  };
                },
              }),
            },
          });
          return result.toUIMessageStreamResponse({ sendReasoning: true, originalMessages: body.messages });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
