import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Bot, Trash2 } from "lucide-react";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Loader } from "@/components/ai-elements/loader";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { buildSnapshot } from "@/lib/finance";

export const Route = createFileRoute("/assistente")({
  head: () => ({
    meta: [
      { title: "Assistente FinAI" },
      { name: "description", content: "Converse com a IA sobre seus gastos, faturas, economia e projeções." },
      { property: "og:title", content: "Assistente FinAI" },
      { property: "og:description", content: "Consultoria financeira com IA baseada nos seus dados." },
    ],
  }),
  component: AssistentePage,
});

function AssistentePage() {
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    db.chat.get("main").then((r) => setInitial((r?.messages as UIMessage[]) ?? []));
  }, [key]);
  if (!initial) return null;
  return (
    <Chat
      key={key}
      initial={initial}
      onClear={async () => {
        await db.chat.delete("main");
        setInitial(null);
        setKey((k) => k + 1);
      }}
    />
  );
}

const SUGGESTIONS = ["Quanto gastei com mercado este mês?", "Consigo economizar R$ 500 no próximo mês?", "Qual fatura priorizar para não pagar juros?"];

function Chat({ initial, onClear }: { initial: UIMessage[]; onClear: () => void }) {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages }) => ({ body: { messages, snapshot: await buildSnapshot() } }),
      }),
    [],
  );
  const { messages, sendMessage, status, error, stop } = useChat({ id: "main", messages: initial, transport });

  useEffect(() => {
    if (status === "ready" && messages.length) void db.chat.put({ id: "main", messages });
  }, [status, messages]);

  const send = (text: string) => {
    if (!text.trim()) return;
    void sendMessage({ text });
    setInput("");
  };

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] flex-col md:h-[calc(100dvh-6.5rem)]">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ai-gradient text-ai-foreground"><Bot className="h-5 w-5" /></div>
        <div>
          <h1 className="text-lg font-bold">Assistente FinAI</h1>
          <p className="text-xs text-muted-foreground">Analisa seus dados reais deste aparelho</p>
        </div>
        {messages.length > 0 && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}><Trash2 /> Nova conversa</Button>
        )}
      </div>
      <Conversation className="flex-1 rounded-2xl border bg-card">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Bot className="h-8 w-8 text-ai" />}
              title="Pergunte sobre suas finanças"
              description="A IA usa suas contas, cartões, lançamentos e projeções para responder."
            >
              <div className="mt-4 flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="secondary" size="sm" className="h-auto whitespace-normal py-2" onClick={() => send(s)}>{s}</Button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent className={m.role === "user" ? "bg-ai text-ai-foreground" : undefined}>
                  {m.parts.map((p, i) => {
                    if (p.type === "text") return m.role === "assistant" ? <MessageResponse key={i}>{p.text}</MessageResponse> : <p key={i}>{p.text}</p>;
                    if (p.type.startsWith("tool-")) {
                      const tp = p as { type: `tool-${string}`; state: "input-streaming" | "input-available" | "output-available" | "output-error"; input?: unknown; output?: unknown; errorText?: string };
                      return (
                        <Tool key={i} defaultOpen={false}>
                          <ToolHeader type={tp.type} state={tp.state} />
                          <ToolContent>
                            <ToolInput input={tp.input} />
                            <ToolOutput output={tp.output ? <pre className="text-xs">{JSON.stringify(tp.output, null, 2)}</pre> : undefined} errorText={tp.errorText} />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && <Loader className="text-ai" />}
          {error && <p className="text-sm text-expense">{(() => { try { return JSON.parse(error.message).error; } catch { return error.message; } })()}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <PromptInput className="mt-3" onSubmit={(msg) => (status === "streaming" ? stop() : send(msg.text))}>
        <PromptInputTextarea autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte ao FinAI…" />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} disabled={!input.trim() && status !== "streaming"} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
