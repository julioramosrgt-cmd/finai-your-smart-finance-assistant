# FinAI: Your Smart Finance Assistant

Por favor, utilize este PRD completo e definitivo como a especificação oficial do aplicativo FinAI PWA. Crie a interface visual moderna utilizando Shadcn UI e Tailwind CSS, garanta que o app inicie zerado para comercialização, implemente a integração do Agente de IA para responder e analisar os dados do usuário, e configure todas as regras de competência e conciliação conforme detalhado."

PRD Definitivo — FinAI PWA (Versão Comercial & Lovable Ready)

​1. Visão Geral do Produto

​O FinAI é um aplicativo PWA (Progressive Web App) de gestão financeira pessoal e empresarial (PF/PJ) de alta precisão, pensado para ser publicado e comercializado na Google Play Store e Apple App Store.

​O sistema opera 100% focado na privacidade do usuário, utilizando lançamentos manuais refinados, importação/conciliação inteligente de arquivos bancários (OFX, CSV e PDF) e um Agente de IA nativo ativo, sem nenhuma dependência de APIs de Open Finance.

​2. Estado de Instalação e Comercialização (Stores Ready)

​2.1. Estado Inicial Limpo (First-Time User Experience)

​Zero-Data State: O aplicativo deve vir 100% zerado por padrão. Não haverá lançamentos, cartões, contas ou saldos fictícios/mockados no primeiro acesso.

​Fluxo de Onboarding: Apresentação visual intuitiva para rápida configuração inicial (moeda, criação da primeira conta/cartão e escolha de senha/PIN biométrico).

​2.2. Restauração e Reset de Fábrica

​Botão de Limpeza em Configurações: Na aba Configurações > Dados e Privacidade, um botão "Zerar / Resetar Aplicativo".

​Mecanismo de Segurança: Exibição de modal com aviso de confirmação explícita de alto nível antes de purgar o banco de dados (LocalStorage / IndexedDB) e reiniciar o app ao estado de fábrica.

​2.3. Preparação para Lojas (Android / iOS)

​Suporte nativo a PWA com manifest.json, Service Workers para uso offline, ícones adaptativos e splash screens configurados para facilidade de empacotamento via Capacitor / Bubblewrap / PWABuilder.

​3. Agente de Inteligência Artificial Real (FinAI Assistant)

​3.1. Funcionalidade e Interatividade Nativa

​Leitura do Banco de Dados Local: A IA tem acesso direto às transações, cartões, contas, despesas fixas e projeções para responder com exatidão baseada nos dados reais do usuário.

​Chat Integrado de Consultoria: Aba dedicada ao chat com a IA para responder dúvidas como: "Quanto gastei com mercado este mês?", "Consigo economizar R$ 500 no próximo mês?", "Qual fatura priorizar para não pagar juros?".

​Cards de Insights no Dashboard: Widgets na tela inicial com recomendações diárias e proativas sobre hábitos de consumo e alertas de saúde financeira.

​4. Regras de Negócio e Arquitetura de Dados Fundamentais

​4.1. Regime de Competência e Fluxo de Caixa Futuro

​Parcelamentos (Cartão e Conta Corrente): Uma compra parcelada em N vezes nunca deve abater o valor total no mês atual. Cada parcela deve ser computada e projetada de forma isolada e sucessiva estritamente no seu respectivo mês futuro.

​Lançamentos Futuros / Agendados: Contas e despesas agendadas para meses ou dias futuros não alteram o "Saldo Atual em Caixa", afetando apenas a projeção do mês de vencimento.

​Despesas e Receitas Recorrentes (Gastos Fixos): Suporte a marcação de recorrência (Mensal, Anual, Semanal) com projeção automática nos meses subsequentes. Opção de editar/excluir uma ocorrência isolada ou toda a série.

​4.2. Estrutura da Entidade de Lançamento (Transaction)

interface Transaction {

  id: string;

  description: string;

  amount: number;

  date: string; // Data da competência

  due_date: string; // Data de vencimento

  type: 'income' | 'expense' | 'transfer';

  account_type: 'checking' | 'credit_card' | 'benefit_card' | 'loan' | 'investment';

  institution_name: string; // Ex: Nubank, Caixa, Itaú, Bradesco

  category_id: string;

  subcategory_id?: string;

  is_installment: boolean;

  current_installment?: number;

  total_installments?: number;

  is_recurring: boolean;

  recurrence_period?: 'weekly' | 'monthly' | 'yearly';

  status: 'pending' | 'paid' | 'overdue';

}

Requisitos Funcionais por Módulo

​5.1. Dashboard (Painel Geral)

​Filtros Globais de Período: Navegação por meses (Mês Atual, Anterior, Futuros, Personalizado). Todos os cards e gráficos se adaptam ao período selecionado.

​Saldos Separados: Diferenciação visual clara entre Saldo Real Hoje, Saldo Projetado do Mês, Faturas Abertas e Gasto por Competência.

​Central de Notificações e Alertas: Banner e aviso visual/sonoro discreto para contas e faturas que vencem hoje, nos próximos 3 dias ou vencidas.

​5.2. Gestão Nativa em Cartões e Contas

​Ações Nativas (Incluir / Alterar / Excluir): Possibilidade de criar, editar ou excluir qualquer lançamento diretamente na tela da fatura do cartão ou no extrato da conta corrente.

​Sincronização de Saldos e Limites: Ao alterar ou excluir uma despesa de cartão (ou alterar o cartão de destino), o sistema estorna imediatamente o limite do cartão original e recalcula a fatura do novo cartão sem deixar resíduos incorretos.

​Ajuste de Saldos Manual: Seção nas configurações para ajuste direto de eventuais divergências em saldos e faturas.

​Baixa Manual: Botão "Baixar/Pagar" rápido para contas a vencer ou vencidas, quitando o registro e abatendo do saldo da conta na data informada.

​5.3. Módulo de Categorias e Subcategorias (CRUD Completo)

​Gerenciamento Flexível: Aba de categorias permitindo criar, editar e excluir subcategorias vinculadas a cada categoria principal (tanto para despesas quanto para receitas).

​Filtros e Relatórios: Suporte a filtros de extratos e análises detalhadas utilizando as subcategorias.

​5.4. Importação e Conciliação Inteligente (OFX / CSV / PDF)

​Suporte Multi-Formato: Upload e processamento de extratos bancários e faturas em .OFX, .CSV e .PDF.

​Motor de Conciliação:

​Leitura e extração das transações do arquivo.

​Comparação com os lançamentos manuais já existentes no app.

​Identificação de Divergências: Destaque visual para itens não encontrados, valores diferentes ou duplicidades.

​Ação do Usuário: Opções para ajuste manual pontual ou migração/importação automática autorizada dos dados do PDF/arquivo para o sistema.

​5.5. Autenticação e Segurança Biométrica Real

​WebAuthn (API Nativa): Uso de navigator.credentials para habilitar biometria e Face ID reais suportados pelo hardware do celular/computador.

​Fallback Seguro: PIN/Senha de acesso local para dispositivos incompatíveis.

​6. Pilares de Design e UI/UX (Shadcn UI + Tailwind)

​Design System: Interface escura (Dark Mode First com suporte a Light Mode) elegante, baseada em Shadcn UI e Tailwind CSS.

​Navegação: Bottom Navigation Bar intuitiva no mobile (com atalho para o assistente de IA) e Sidebar lateral expansível no desktop.

​Sinalização Semântica de Cores:

​🟢 Verde: Receita, Saldo Positivo, Status Quitado.

​🔴 Vermelho: Despesa, Alerta de Vencido, Limite Estourado.

​🟡 Amarelo: Contas Próximas ao Vencimento (Próximos 3 dias).

​🟣 Roxo/Azul: Mensagens e Insights da Inteligência Artificial.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/aa71bb86-70de-48ff-a084-b553dfc06a66).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
