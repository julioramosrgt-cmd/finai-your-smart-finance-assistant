import Dexie, { type Table } from "dexie";

export type AccountKind = "checking" | "benefit_card" | "loan" | "investment";
export type TxType = "income" | "expense" | "transfer";
export type TxStatus = "pending" | "paid" | "overdue";
export type Period = "weekly" | "monthly" | "yearly";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  institution_name: string;
  initial_balance: number;
  created_at: string;
  sort_order?: number;
}

export interface Card {
  id: string;
  name: string;
  institution_name: string;
  limit: number;
  closing_day: number;
  due_day: number;
  created_at: string;
  sort_order?: number;
}

export interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  color: string;
  behavior?: "fixed" | "variable";
  sort_order?: number;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  behavior?: "fixed" | "variable";
  sort_order?: number;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string; // competência (YYYY-MM-DD)
  due_date: string; // vencimento
  type: TxType;
  account_type: "checking" | "credit_card" | "benefit_card" | "loan" | "investment";
  institution_name: string;
  category_id: string;
  subcategory_id?: string;
  is_installment: boolean;
  current_installment?: number;
  total_installments?: number;
  is_recurring: boolean;
  recurrence_period?: Period;
  status: TxStatus;
  // extensões
  account_id?: string;
  card_id?: string;
  to_account_id?: string;
  to_card_id?: string; // pagamento de fatura
  series_id?: string;
  invoice_month?: string; // YYYY-MM (mês de vencimento da fatura)
  paid_at?: string;
  is_adjustment?: boolean;
  created_at: string;
}

export interface Settings {
  id: "app";
  onboarded: boolean;
  currency: string;
  pin_hash?: string;
  pin_salt?: string;
  webauthn_id?: string;
  theme: "dark" | "light";
  sound: boolean;
  hideValues?: boolean;
  autoLockMinutes?: number;
}

export interface ChatRecord {
  id: "main";
  messages: unknown[];
}

export interface InsightRecord {
  id: string; // YYYY-MM-DD
  items: { title: string; body: string; tone: "positive" | "warning" | "alert" | "tip" }[];
}

class FinDB extends Dexie {
  accounts!: Table<Account, string>;
  cards!: Table<Card, string>;
  categories!: Table<Category, string>;
  subcategories!: Table<Subcategory, string>;
  transactions!: Table<Transaction, string>;
  settings!: Table<Settings, string>;
  chat!: Table<ChatRecord, string>;
  insights!: Table<InsightRecord, string>;

  constructor() {
    super("finai");
    this.version(1).stores({
      accounts: "id",
      cards: "id",
      categories: "id, kind",
      subcategories: "id, category_id",
      transactions: "id, date, due_date, account_id, card_id, series_id, invoice_month, category_id, status",
      settings: "id",
      chat: "id",
      insights: "id",
    });
  }
}

export const db = new FinDB();

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const DEFAULT_CATEGORIES: { name: string; kind: "income" | "expense"; color: string; subs: string[] }[] = [
  { name: "Moradia", kind: "expense", color: "chart-5", subs: ["Aluguel", "Condomínio", "Energia", "Água", "Internet"] },
  { name: "Mercado", kind: "expense", color: "chart-1", subs: ["Supermercado", "Feira", "Padaria"] },
  { name: "Transporte", kind: "expense", color: "chart-3", subs: ["Combustível", "App de transporte", "Estacionamento"] },
  { name: "Alimentação", kind: "expense", color: "chart-4", subs: ["Restaurante", "Delivery"] },
  { name: "Saúde", kind: "expense", color: "chart-2", subs: ["Farmácia", "Plano de saúde", "Consultas"] },
  { name: "Lazer", kind: "expense", color: "chart-2", subs: ["Streaming", "Viagens", "Eventos"] },
  { name: "Educação", kind: "expense", color: "chart-5", subs: ["Cursos", "Livros"] },
  { name: "Empresa (PJ)", kind: "expense", color: "chart-3", subs: ["Impostos", "Fornecedores", "Software"] },
  { name: "Outros", kind: "expense", color: "chart-4", subs: [] },
  { name: "Salário", kind: "income", color: "chart-1", subs: ["Mensal", "13º", "Férias"] },
  { name: "Faturamento PJ", kind: "income", color: "chart-5", subs: ["Serviços", "Produtos"] },
  { name: "Investimentos", kind: "income", color: "chart-2", subs: ["Rendimentos", "Dividendos"] },
  { name: "Outras receitas", kind: "income", color: "chart-3", subs: [] },
];

export async function seedCategories() {
  const count = await db.categories.count();
  if (count > 0) return;
  for (const c of DEFAULT_CATEGORIES) {
    const id = uid();
    await db.categories.add({ id, name: c.name, kind: c.kind, color: c.color });
    await db.subcategories.bulkAdd(c.subs.map((name) => ({ id: uid(), category_id: id, name })));
  }
}

export async function factoryReset() {
  await db.delete();
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    /* ignore */
  }
  window.location.href = "/";
}
