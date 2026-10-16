import Dexie, { type Table } from "dexie";

export type AccountKind = "checking" | "benefit_card" | "loan" | "investment";
export type TxType = "income" | "expense" | "transfer";
export type TxStatus = "pending" | "paid" | "overdue";
export type Period = "weekly" | "monthly" | "yearly";
export type Profile = "PF" | "PJ";

export interface Account {
  id: string;
  profile?: Profile;
  name: string;
  kind: AccountKind;
  institution_name: string;
  initial_balance: number;
  linked_account_id?: string;
  created_at: string;
  sort_order?: number;
}

export interface Card {
  id: string;
  profile?: Profile;
  name: string;
  institution_name: string;
  limit: number;
  closing_day: number;
  due_day: number;
  created_at: string;
  sort_order?: number;
}

export interface LoanContract {
  id: string;
  profile?: Profile;
  name: string;
  institution_name: string;
  kind: string;
  original_amount: number;
  outstanding_balance: number;
  installment_amount: number;
  total_installments?: number;
  installments_remaining: number;
  next_due_date?: string;
  interest_rate?: number;
  notes?: string;
  created_at: string;
}

export interface Category {
  id: string;
  profile?: Profile;
  name: string;
  kind: "income" | "expense";
  color: string;
  behavior?: "fixed" | "variable";
  sort_order?: number;
}

export interface Subcategory {
  id: string;
  profile?: Profile;
  category_id: string;
  name: string;
  behavior?: "fixed" | "variable";
  sort_order?: number;
}

export interface Transaction {
  id: string;
  profile?: Profile;
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
  investment_operation?: "aporte" | "resgate";
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
  id: string;
  messages: unknown[];
}

export interface InsightRecord {
  id: string; // YYYY-MM-DD
  items: { title: string; body: string; tone: "positive" | "warning" | "alert" | "tip" }[];
}

class FinDB extends Dexie {
  accounts!: Table<Account, string>;
  cards!: Table<Card, string>;
  loanContracts!: Table<LoanContract, string>;
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
    this.version(2).stores({
      accounts: "id",
      cards: "id",
      loanContracts: "id, institution_name, kind, created_at",
      categories: "id, kind",
      subcategories: "id, category_id",
      transactions: "id, date, due_date, account_id, card_id, series_id, invoice_month, category_id, status",
      settings: "id",
      chat: "id",
      insights: "id",
    });
    this.version(3).stores({
      accounts: "id, profile",
      cards: "id, profile",
      loanContracts: "id, profile, institution_name, kind, created_at",
      categories: "id, profile, kind",
      subcategories: "id, profile, category_id",
      transactions: "id, profile, date, due_date, account_id, card_id, series_id, invoice_month, category_id, status",
      settings: "id",
      chat: "id",
      insights: "id",
    }).upgrade(async (tx) => {
      await Promise.all([
        tx.table("accounts").toCollection().modify((item) => { item.profile ??= "PF"; }),
        tx.table("cards").toCollection().modify((item) => { item.profile ??= "PF"; }),
        tx.table("loanContracts").toCollection().modify((item) => { item.profile ??= "PF"; }),
        tx.table("categories").toCollection().modify((item) => { item.profile ??= "PF"; }),
        tx.table("subcategories").toCollection().modify((item) => { item.profile ??= "PF"; }),
        tx.table("transactions").toCollection().modify((item) => { item.profile ??= "PF"; }),
      ]);
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

export async function seedCategories(profile: Profile = "PF") {
  await db.transaction("rw", db.categories, db.subcategories, async () => {
  const count = await db.categories.where("profile").equals(profile).count();
  if (count > 0) return;
  for (const c of DEFAULT_CATEGORIES) {
    const id = uid();
    await db.categories.add({ id, profile, name: c.name, kind: c.kind, color: c.color });
    await db.subcategories.bulkAdd(c.subs.map((name) => ({ id: uid(), profile, category_id: id, name })));
  }
  });
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
