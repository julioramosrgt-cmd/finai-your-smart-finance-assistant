import { createOpenAI } from "@ai-sdk/openai";

const RUN = "X-Lovable-AIG-Run-ID";
export const MODEL = "openai/gpt-6-astra";

export function makeProvider(request: Request) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  let runId = request.headers.get(RUN)?.trim() || undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(RUN)) headers.set(RUN, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(RUN)?.trim() || undefined;
      return res;
    },
  });
  return provider;
}

export const reasoningOptions = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
} as const;

export function errorResponse(e: unknown) {
  const err = e as { statusCode?: number; status?: number; message?: string; responseBody?: string };
  const status = err.statusCode ?? err.status ?? 500;
  let message = err.message ?? "Falha na IA";
  if (status === 402) message = "Créditos de IA esgotados. Adicione créditos para continuar usando o assistente.";
  if (status === 429) message = "Muitas solicitações. Aguarde alguns instantes e tente novamente.";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
