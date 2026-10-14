import { createFileRoute } from "@tanstack/react-router";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod/v4";

const schema = z.object({
  insights: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      tone: z.enum(["positive", "warning", "alert", "tip"]),
    }),
  ),
});

export const Route = createFileRoute("/api/insights")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { makeProvider, MODEL, reasoningOptions, errorResponse } = await import("@/lib/ai.server");
        try {
          const { snapshot } = (await request.json()) as { snapshot: Record<string, unknown> };
          const provider = makeProvider(request);
          const result = streamText({
            model: provider.responses(MODEL),
            instructions:
              "Você é o FinAI. Gere de 2 a 4 insights curtos (título até 6 palavras, texto até 2 frases) em português do Brasil, proativos e baseados SOMENTE nos dados reais: hábitos de consumo, alertas de vencimento, uso de limite, projeção do mês, oportunidades de economia. Se houver poucos dados, sugira os próximos passos de cadastro.",
            prompt: JSON.stringify(snapshot),
            output: Output.object({ schema }),
            providerOptions: reasoningOptions,
            abortSignal: request.signal,
          });
          let items: z.infer<typeof schema>["insights"] = [];
          try {
            items = (await result.output).insights;
          } catch (e) {
            if (NoObjectGeneratedError.isInstance(e) && e.text) {
              try {
                items = JSON.parse(e.text).insights ?? [];
              } catch {
                items = [];
              }
            } else throw e;
          }
          return Response.json({ insights: items.slice(0, 4) });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
