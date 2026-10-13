# FinAI PWA — Plano de Implementação

## Objetivo
App financeiro PF/PJ, sem dados de exemplo, que funciona no celular e computador. Os dados ficam no próprio aparelho (privacidade) e há um assistente de IA que analisa esses dados.

## Fases de entrega

**Fase 1 — Base e primeiro acesso**
- Visual escuro elegante (com opção clara), cores: verde receita/pago, vermelho despesa/vencido, amarelo vence em 3 dias, roxo/azul IA.
- Menu inferior no celular (com atalho central para a IA) e menu lateral recolhível no computador.
- Onboarding: moeda, primeira conta/cartão, PIN e ativação opcional de biometria (digital/Face ID do aparelho).
- Tela de bloqueio com biometria ou PIN.
- App começa 100% vazio.

**Fase 2 — Lançamentos e regras financeiras**
- Contas (corrente, benefício, empréstimo, investimento) e cartões (limite, fechamento, vencimento).
- Lançamentos: receita, despesa, transferência; parcelado; recorrente (semanal/mensal/anual); agendado.
- Regras de competência:
  - Compra em N parcelas gera N lançamentos, um por mês; nunca abate o total no mês atual.
  - Lançamentos futuros não alteram o Saldo Atual, só a projeção do mês.
  - Recorrências projetadas automaticamente; editar/excluir só esta ocorrência ou a série.
- Editar/excluir/trocar cartão recalcula limite e faturas na hora, sem resíduo.
- Botão "Baixar/Pagar" com data; ajuste manual de saldos e faturas.
- Categorias e subcategorias (receita e despesa) com criar/editar/excluir; filtros no extrato.

**Fase 3 — Painel**
- Seletor de período (mês atual, anterior, futuros, personalizado).
- Cards: Saldo Real Hoje, Saldo Projetado do Mês, Faturas Abertas, Gasto por Competência.
- Gráficos por categoria e evolução mensal.
- Alertas: vence hoje, em 3 dias, vencido (com aviso sonoro discreto opcional).
- Cards de insights da IA.

**Fase 4 — Importação e conciliação**
- Upload OFX, CSV e PDF; leitura das transações (PDF com apoio da IA para extrair texto de extratos).
- Comparação com lançamentos existentes por data, valor e descrição.
- Destaque: não encontrado, valor diferente, duplicado, conciliado.
- Ações: ajustar item a item ou importar selecionados.

**Fase 5 — Assistente FinAI**
- Aba de chat com respostas em tempo real.
- A IA recebe um resumo dos dados do usuário (saldos, faturas, gastos por categoria, recorrências, projeções) e responde com números reais.
- Ferramentas da IA para consultas precisas (ex.: gasto por categoria no período, simular economia, priorizar faturas por juros/vencimento).

**Fase 6 — Configurações e lojas**
- Dados e Privacidade: "Zerar / Resetar Aplicativo" com confirmação forte (digitar "ZERAR") que apaga tudo e volta ao onboarding.
- Exportar/backup dos dados (JSON).
- Instalável (ícones, tela de abertura, manifesto) e funcionamento offline no app publicado, pronto para empacotar para Google Play/App Store.

## Observações
- Sem Open Finance; sem contas na nuvem — tudo no aparelho. A IA é o único recurso que usa internet (envia apenas o resumo necessário para a pergunta).
- Offline e instalação só funcionam no app publicado, não na pré-visualização.

## Detalhes técnicos
- Armazenamento: IndexedDB (Dexie) com tabelas accounts, cards, transactions, categories, subcategories, settings, chat; estado via hooks reativos (useLiveQuery).
- Entidade Transaction conforme PRD + `account_id`, `card_id`, `series_id`, `invoice_month`, `paid_at`.
- Saldos e faturas sempre derivados dos lançamentos (nunca armazenados), garantindo estorno correto ao editar; ajustes manuais viram lançamentos de "ajuste".
- Rotas TanStack: `/` (painel), `/onboarding`, `/lock`, `/lancamentos`, `/contas`, `/cartoes/$id`, `/categorias`, `/importar`, `/assistente`, `/configuracoes`.
- IA: server route com AI SDK + Lovable AI Gateway, `streamText` com ferramentas cujos dados vêm do cliente no corpo da requisição; UI de chat com AI Elements. Insights gerados sob demanda e guardados por dia.
- Parsers: OFX (parser próprio SGML/XML), CSV (papaparse com mapeamento de colunas), PDF (pdfjs-dist no navegador para texto + IA estruturando as linhas).
- Biometria: WebAuthn (`navigator.credentials.create/get`, plataforma); PIN com hash SHA-256 + salt.
- PWA: vite-plugin-pwa (generateSW), registro protegido fora da pré-visualização, NetworkFirst para navegação.
- Shadcn UI + Tailwind v4 com tokens semânticos (income, expense, warning, ai).
