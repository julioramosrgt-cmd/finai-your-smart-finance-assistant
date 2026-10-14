import { createFileRoute } from "@tanstack/react-router";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod/v4";

const schema = z.object({
  transactions: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD"),
      description: z.string(),
      amount: z.number().describe("valor positivo"),
      type: z.enum(["income", "expense"]),
    }),
  ),
});

export const Route = createFileRoute("/api/extract")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { makeProvider, MODEL, reasoningOptions, errorResponse } = await import("@/lib/ai.server");
        try {
          const { text } = (await request.json()) as { text: string };
          const provider = makeProvider(request);
          const result = streamText({
            model: provider.responses(MODEL),
            instructions:
              "Extraia todas as transações deste extrato bancário ou fatura de cartão brasileiro. Ignore saldos, totais, limites e cabeçalhos. Converta datas para YYYY-MM-DD (deduza o ano pelo documento). amount sempre positivo; type=expense para débitos/compras, income para créditos/estornos.",
            prompt: text.slice(0, 60000),
            output: Output.object({ schema }),
            providerOptions: reasoningOptions,
            abortSignal: request.signal,
          });
          let rows: z.infer<typeof schema>["transactions"] = [];
          try {
            rows = (await result.output).transactions;
          } catch (e) {
            if (NoObjectGeneratedError.isInstance(e) && e.text) rows = JSON.parse(e.text).transactions ?? [];
            else throw e;
          }
          return Response.json({ transactions: rows });
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
