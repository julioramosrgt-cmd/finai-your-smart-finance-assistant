import { createFileRoute } from "@tanstack/react-router";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod/v4";

const transactionSchema = z.object({
  transactions: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD"),
      description: z.string(),
      amount: z.number().describe("valor positivo"),
      type: z.enum(["income", "expense"]),
      current_installment: z.number().int().positive().nullable().describe("parcela atual quando identificada, por exemplo 3 em 3/10"),
      total_installments: z.number().int().positive().nullable().describe("total de parcelas quando identificada, por exemplo 10 em 3/10"),
    }),
  ),
});

const loanSchema = z.object({
  loan: z.object({
    name: z.string().nullable(),
    institution_name: z.string().nullable(),
    kind: z.string().nullable(),
    original_amount: z.number().nonnegative().nullable(),
    outstanding_balance: z.number().nonnegative().nullable(),
    installment_amount: z.number().nonnegative().nullable(),
    total_installments: z.number().int().nonnegative().nullable(),
    installments_remaining: z.number().int().nonnegative().nullable(),
    installments_paid: z.number().int().nonnegative().nullable(),
    next_due_date: z.string().nullable().describe("YYYY-MM-DD or null"),
    interest_rate: z.number().nonnegative().nullable().describe("percent, not decimal fraction"),
  }),
});

export const Route = createFileRoute("/api/extract")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { makeProvider, MODEL, reasoningOptions, errorResponse } = await import("@/lib/ai.server");
        try {
          const body = (await request.json()) as { text?: string; documentType?: "transactions" | "loan" };
          const text = body.text?.trim();
          const documentType = body.documentType ?? "transactions";
          if (!text) return Response.json({ error: "O PDF não contém texto para analisar." }, { status: 400 });
          if (text.length > 60000) return Response.json({ error: "O texto extraído excede o limite de análise. Divida o documento e tente novamente." }, { status: 413 });
          if (documentType !== "transactions" && documentType !== "loan") return Response.json({ error: "Tipo de documento inválido." }, { status: 400 });
          const provider = makeProvider(request);
          const isLoan = documentType === "loan";
          const result = streamText({
            model: provider.responses(MODEL),
            instructions: isLoan
              ? "Extraia os dados do contrato ou demonstrativo de evolução de dívida brasileiro. Retorne null quando um campo não estiver explicitamente informado; não estime nem deduza saldos ou parcelas. installments_remaining é o número de parcelas não pagas e installments_paid o número já pago. Datas devem ser YYYY-MM-DD."
              : "Extraia todas as transações deste extrato bancário ou fatura de cartão brasileiro. Ignore saldos, totais, limites e cabeçalhos. Converta datas para YYYY-MM-DD (deduza o ano pelo documento). amount sempre positivo e deve ser o valor da parcela lançada neste documento; type=expense para débitos/compras, income para créditos/estornos. Em compras parceladas reconhecíveis, preencha current_installment e total_installments; use null se não tiver certeza.",
            prompt: text,
            output: Output.object({ schema: isLoan ? loanSchema : transactionSchema }),
            providerOptions: reasoningOptions,
            abortSignal: request.signal,
          });
          let extracted: { transactions: z.infer<typeof transactionSchema>["transactions"] } | z.infer<typeof loanSchema>;
          try {
            extracted = await result.output as typeof extracted;
          } catch (e) {
            if (NoObjectGeneratedError.isInstance(e) && e.text) extracted = JSON.parse(e.text);
            else throw e;
          }
          return Response.json(extracted);
        } catch (e) {
          return errorResponse(e);
        }
      },
    },
  },
});
