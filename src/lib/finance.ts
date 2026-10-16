import { db, uid, type Account, type Card, type Category, type Period, type Transaction } from "./db";

// ---------- datas ----------
export const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d || 1);
};
export const monthKey = (s: string) => s.slice(0, 7);
export const currentMonth = () => todayISO().slice(0, 7);
export function addMonthsISO(iso: string, n: number) {
  const d = parseISO(iso);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  t.setDate(Math.min(day, last));
  return toISO(t);
}
export const addDaysISO = (iso: string, n: number) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const shiftMonth = (ym: string, n: number) => addMonthsISO(`${ym}-01`, n).slice(0, 7);
export const monthEnd = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return toISO(new Date(y, m, 0));
};
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const dayDiff = (a: string, b: string) =>
  Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);

// ---------- cartões ----------
/** Calcula a fatura (mês de vencimento) e a data de vencimento para uma compra. */
export function invoiceFor(card: Pick<Card, "closing_day" | "due_day">, purchaseISO: string) {
  const d = parseISO(purchaseISO);
  let closeMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  if (d.getDate() > card.closing_day) closeMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const dueMonth =
    card.due_day > card.closing_day ? closeMonth : new Date(closeMonth.getFullYear(), closeMonth.getMonth() + 1, 1);
  const last = new Date(dueMonth.getFullYear(), dueMonth.getMonth() + 1, 0).getDate();
  const due = new Date(dueMonth.getFullYear(), dueMonth.getMonth(), Math.min(card.due_day, last));
  return { invoice_month: toISO(due).slice(0, 7), due_date: toISO(due) };
}

// ---------- status ----------
export function effectiveStatus(t: Transaction, today = todayISO()) {
  if (t.status === "paid") return "paid" as const;
  return t.due_date < today ? ("overdue" as const) : ("pending" as const);
}

// ---------- criação ----------
export interface TxInput {
  description: string;
  amount: number; // valor total (parcelado) ou da ocorrência
  date: string;
  due_date: string;
  type: Transaction["type"];
  source: { kind: "account"; id: string } | { kind: "card"; id: string };
  to_account_id?: string;
  category_id: string;
  subcategory_id?: string;
  installments: number;
  firstInstallment?: number;
  recurring?: Period;
  paid: boolean;
  paid_at?: string;
}

const HORIZON: Record<Period, number> = { weekly: 52, monthly: 24, yearly: 5 };

function stepDate(iso: string, period: Period, i: number) {
  if (period === "weekly") return addDaysISO(iso, 7 * i);
  if (period === "yearly") return addMonthsISO(iso, 12 * i);
  return addMonthsISO(iso, i);
}

export async function buildTransactions(input: TxInput): Promise<Transaction[]> {
  const now = new Date().toISOString();
  const today = todayISO();
  const card = input.source.kind === "card" ? await db.cards.get(input.source.id) : undefined;
  const account = input.source.kind === "account" ? await db.accounts.get(input.source.id) : undefined;
  const base = {
    description: input.description.trim(),
    type: input.type,
    account_type: (card ? "credit_card" : (account?.kind ?? "checking")) as Transaction["account_type"],
    institution_name: card?.institution_name ?? account?.institution_name ?? "",
    category_id: input.category_id,
    subcategory_id: input.subcategory_id || undefined,
    account_id: account?.id,
    card_id: card?.id,
    to_account_id: input.type === "transfer" ? input.to_account_id : undefined,
    created_at: now,
  };
  const series_id = input.installments > 1 || input.recurring ? uid() : undefined;
  const out: Transaction[] = [];

  const make = (i: number, amount: number, date: string, due: string, extra: Partial<Transaction>) => {
    let due_date = due;
    let invoice_month: string | undefined;
    if (card) {
      const inv = invoiceFor(card, date);
      due_date = inv.due_date;
      invoice_month = inv.invoice_month;
    }
    // Ocorrências futuras nunca nascem pagas; só a primeira pode ser baixada no ato.
    const paid = card ? false : input.paid && i === 0 && date <= today;
    out.push({
      ...base,
      id: uid(),
      amount: Math.round(amount * 100) / 100,
      date,
      due_date,
      invoice_month,
      series_id,
      status: paid ? "paid" : "pending",
      paid_at: paid ? (input.paid_at ?? today) : undefined,
      is_installment: false,
      is_recurring: false,
      ...extra,
    } as Transaction);
  };

  if (input.installments > 1) {
    const n = input.installments;
    const first = Math.min(n, Math.max(1, input.firstInstallment ?? 1));
    const each = Math.floor((input.amount / n) * 100) / 100;
    const last = Math.round((input.amount - each * (n - 1)) * 100) / 100;
    for (let index = first; index <= n; index++) {
      const offset = index - first;
      make(offset, index === n ? last : each, addMonthsISO(input.date, offset), addMonthsISO(input.due_date, offset), {
        is_installment: true,
        current_installment: index,
        total_installments: n,
        description: `${base.description} (${index}/${n})`,
      });
    }
  } else if (input.recurring) {
    const p = input.recurring;
    for (let i = 0; i < HORIZON[p]; i++) {
      make(i, input.amount, stepDate(input.date, p, i), stepDate(input.due_date, p, i), {
        is_recurring: true,
        recurrence_period: p,
      });
    }
  } else {
    make(0, input.amount, input.date, input.due_date, {});
  }
  return out;
}

/** Recalcula campos derivados quando um lançamento muda de origem/data (estorno automático de limite). */
export async function normalizeTx(t: Transaction): Promise<Transaction> {
  const next = { ...t };
  if (next.card_id) {
    const card = await db.cards.get(next.card_id);
    if (card) {
      const inv = invoiceFor(card, next.date);
      next.invoice_month = inv.invoice_month;
      next.due_date = inv.due_date;
      next.account_type = "credit_card";
      next.institution_name = card.institution_name;
    }
    next.account_id = undefined;
  } else if (next.account_id) {
    const acc = await db.accounts.get(next.account_id);
    if (acc) {
      next.account_type = acc.kind;
      next.institution_name = acc.institution_name;
    }
    next.invoice_month = undefined;
  }
  return next;
}

// ---------- saldos ----------
export function accountBalance(acc: Account, txs: Transaction[], until = todayISO(), includePending = false) {
  let b = acc.initial_balance;
  for (const t of txs) {
    const realized = t.status === "paid" && (t.paid_at ?? t.date) <= until;
    const projected = includePending && t.status !== "paid" && t.due_date <= until;
    if (!realized && !projected) continue;
    if (t.account_id === acc.id) {
      if (t.type === "income") b += t.amount;
      else b -= t.amount; // expense, transfer de saída, pagamento de fatura
    }
    if (t.type === "transfer" && t.to_account_id === acc.id) b += t.amount;
  }
  return Math.round(b * 100) / 100;
}

export function cardUsage(card: Card, txs: Transaction[]) {
  let used = 0;
  for (const t of txs) {
    if (t.card_id !== card.id || t.status === "paid") continue;
    used += t.type === "income" ? -t.amount : t.amount;
  }
  used = Math.round(used * 100) / 100;
  return { used, available: Math.round((card.limit - used) * 100) / 100, over: used > card.limit };
}

export function invoiceTotal(cardId: string, ym: string, txs: Transaction[], onlyOpen = true) {
  let s = 0;
  for (const t of txs) {
    if (t.card_id !== cardId || t.invoice_month !== ym) continue;
    if (onlyOpen && t.status === "paid") continue;
    s += t.type === "income" ? -t.amount : t.amount;
  }
  return Math.round(s * 100) / 100;
}

export async function payInvoice(card: Card, ym: string, accountId: string, paidAt: string) {
  const txs = await db.transactions.where("invoice_month").equals(ym).toArray();
  const open = txs.filter((t) => t.card_id === card.id && t.status !== "paid");
  const total = open.reduce((s, t) => s + (t.type === "income" ? -t.amount : t.amount), 0);
  const acc = await db.accounts.get(accountId);
  if (!acc || (acc.profile ?? "PF") !== (card.profile ?? "PF")) throw new Error("Conta e cartão precisam pertencer ao mesmo perfil financeiro.");
  await db.transaction("rw", db.transactions, async () => {
    for (const t of open) await db.transactions.update(t.id, { status: "paid", paid_at: paidAt });
    if (total > 0 && acc) {
      await db.transactions.add({
        id: uid(),
        profile: card.profile ?? "PF",
        description: `Pagamento fatura ${card.name} (${ym})`,
        amount: Math.round(total * 100) / 100,
        date: paidAt,
        due_date: paidAt,
        type: "transfer",
        account_type: acc.kind,
        institution_name: acc.institution_name,
        category_id: "",
        is_installment: false,
        is_recurring: false,
        status: "paid",
        paid_at: paidAt,
        account_id: acc.id,
        to_card_id: card.id,
        created_at: new Date().toISOString(),
      });
    }
  });
  return total;
}

// ---------- métricas do período ----------
export function periodMetrics(ym: string, accounts: Account[], cards: Card[], txs: Transaction[]) {
  const today = todayISO();
  const end = monthEnd(ym);
  const start = `${ym}-01`;
  const realToday = accounts.reduce((s, a) => s + accountBalance(a, txs, today), 0);

  // Projeção: saldo atual + tudo pendente (contas) com vencimento até o fim do mês + faturas abertas até lá.
  let projected = realToday;
  const horizon = end < today ? today : end;
  for (const t of txs) {
    if (t.status === "paid" || t.due_date > horizon) continue;
    if (t.card_id) projected -= t.type === "income" ? -t.amount : t.amount;
    else if (t.account_id && t.type === "income") projected += t.amount;
    else if (t.account_id && t.type === "expense") projected -= t.amount;
  }
  const openInvoices = cards.reduce((s, c) => s + invoiceTotal(c.id, ym, txs), 0);
  let expenseComp = 0;
  let incomeComp = 0;
  for (const t of txs) {
    if (t.date < start || t.date > end || t.type === "transfer") continue;
    if (t.type === "expense") expenseComp += t.amount;
    else incomeComp += t.amount;
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    realToday: r(realToday),
    projected: r(projected),
    openInvoices: r(openInvoices),
    expenseComp: r(expenseComp),
    incomeComp: r(incomeComp),
  };
}

export function categoryBreakdown(ym: string, txs: Transaction[], categories: Category[], kind: "income" | "expense" = "expense") {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== kind || monthKey(t.date) !== ym) continue;
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([id, value]) => {
      const c = categories.find((x) => x.id === id);
      return { id, name: c?.name ?? "Sem categoria", color: c?.color ?? "chart-4", value: Math.round(value * 100) / 100 };
    })
    .sort((a, b) => b.value - a.value);
}

export interface Alert {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  level: "overdue" | "today" | "soon";
  kind: "tx" | "invoice";
  ref: string;
}

export function buildAlerts(cards: Card[], txs: Transaction[]): Alert[] {
  const today = todayISO();
  const soon = addDaysISO(today, 3);
  const alerts: Alert[] = [];
  const level = (d: string): Alert["level"] | null =>
    d < today ? "overdue" : d === today ? "today" : d <= soon ? "soon" : null;
  for (const t of txs) {
    if (t.card_id || t.status === "paid" || t.type === "transfer") continue;
    const l = level(t.due_date);
    if (l) alerts.push({ id: t.id, title: t.description, amount: t.type === "income" ? t.amount : -t.amount, due_date: t.due_date, level: l, kind: "tx", ref: t.id });
  }
  const invoices = new Map<string, { card: Card; ym: string; due: string; total: number }>();
  for (const t of txs) {
    if (!t.card_id || t.status === "paid" || !t.invoice_month) continue;
    const card = cards.find((c) => c.id === t.card_id);
    if (!card) continue;
    const key = `${card.id}:${t.invoice_month}`;
    const cur = invoices.get(key) ?? { card, ym: t.invoice_month, due: t.due_date, total: 0 };
    cur.total += t.type === "income" ? -t.amount : t.amount;
    invoices.set(key, cur);
  }
  for (const [key, inv] of invoices) {
    const l = level(inv.due);
    if (l && inv.total > 0)
      alerts.push({ id: key, title: `Fatura ${inv.card.name}`, amount: -Math.round(inv.total * 100) / 100, due_date: inv.due, level: l, kind: "invoice", ref: inv.card.id });
  }
  const order = { overdue: 0, today: 1, soon: 2 };
  return alerts.sort((a, b) => order[a.level] - order[b.level] || a.due_date.localeCompare(b.due_date));
}

// ---------- snapshot para a IA ----------
export async function buildSnapshot(profile: import("@/lib/db").Profile = "PF") {
  const [accounts, cards, categories, subcategories, txs, settings] = await Promise.all([
    db.accounts.where("profile").equals(profile).toArray(),
    db.cards.where("profile").equals(profile).toArray(),
    db.categories.where("profile").equals(profile).toArray(),
    db.subcategories.where("profile").equals(profile).toArray(),
    db.transactions.where("profile").equals(profile).toArray(),
    db.settings.get("app"),
  ]);
  const profileAccounts = accounts;
  const profileCards = cards;
  const profileCategories = categories;
  const profileSubcategories = subcategories;
  const profileTxs = txs;
  const today = todayISO();
  const cm = currentMonth();
  const catName = (id?: string) => profileCategories.find((c) => c.id === id)?.name ?? "";
  const subName = (id?: string) => profileSubcategories.find((c) => c.id === id)?.name ?? "";
  const months = [-3, -2, -1, 0, 1, 2, 3].map((n) => shiftMonth(cm, n));
  return {
    hoje: today,
    moeda: settings?.currency ?? "BRL",
    contas: profileAccounts.map((a) => ({ nome: a.name, tipo: a.kind, banco: a.institution_name, saldo_atual: accountBalance(a, profileTxs) })),
    cartoes: profileCards.map((c) => {
      const u = cardUsage(c, profileTxs);
      return {
        nome: c.name,
        banco: c.institution_name,
        limite: c.limit,
        usado: u.used,
        disponivel: u.available,
        fechamento: c.closing_day,
        vencimento: c.due_day,
        faturas: months.map((m) => ({ mes: m, aberto: invoiceTotal(c.id, m, profileTxs) })).filter((f) => f.aberto !== 0),
      };
    }),
    meses: months.map((m) => ({ mes: m, ...periodMetrics(m, profileAccounts, profileCards, profileTxs), por_categoria: categoryBreakdown(m, profileTxs, profileCategories).map((c) => ({ categoria: c.name, valor: c.value })) })),
    lancamentos: profileTxs
      .filter((t) => t.date >= `${shiftMonth(cm, -6)}-01` && t.date <= monthEnd(shiftMonth(cm, 12)))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-900)
      .map((t) => ({
        d: t.date,
        venc: t.due_date,
        desc: t.description,
        valor: t.amount,
        tipo: t.type,
        cat: catName(t.category_id),
        sub: subName(t.subcategory_id),
        origem: profileCards.find((c) => c.id === t.card_id)?.name ?? profileAccounts.find((a) => a.id === t.account_id)?.name ?? "",
        status: effectiveStatus(t, today),
        rec: t.is_recurring ? t.recurrence_period : undefined,
        parc: t.is_installment ? `${t.current_installment}/${t.total_installments}` : undefined,
      })),
  };
}
export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;
