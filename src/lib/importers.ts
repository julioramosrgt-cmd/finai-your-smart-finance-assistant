import Papa from "papaparse";
import type { Transaction } from "./db";
import { dayDiff } from "./finance";
import { parseMoney } from "./format";

export interface ImportedRow {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
}

const toISODate = (s: string) => {
  s = s.trim();
  let m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return "";
};

export function parseOFX(text: string): ImportedRow[] {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (b: string, t: string) => b.match(new RegExp(`<${t}>([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";
  return blocks
    .map((b) => {
      const amt = Number(tag(b, "TRNAMT").replace(",", "."));
      return {
        date: toISODate(tag(b, "DTPOSTED")),
        description: tag(b, "MEMO") || tag(b, "NAME") || "Sem descrição",
        amount: Math.abs(amt),
        type: (amt >= 0 ? "income" : "expense") as ImportedRow["type"],
      };
    })
    .filter((r) => r.date && r.amount);
}

export function parseCSV(text: string): ImportedRow[] {
  const res = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true, delimiter: "" });
  const rows = res.data;
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""));
  const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  let di = find("data", "date");
  let desc = find("descri", "histor", "memo", "lancamento", "title", "estabelecimento");
  let vi = find("valor", "amount", "value", "montante");
  const hasHeader = di >= 0 || vi >= 0;
  if (!hasHeader) {
    di = 0;
    desc = 1;
    vi = rows[0].length - 1;
  }
  return rows
    .slice(hasHeader ? 1 : 0)
    .map((r) => {
      const v = parseMoney(r[vi] ?? "");
      return {
        date: toISODate(r[di] ?? ""),
        description: (r[desc] ?? "").trim() || "Sem descrição",
        amount: Math.abs(v),
        type: (v >= 0 ? "income" : "expense") as ImportedRow["type"],
      };
    })
    .filter((r) => r.date && r.amount);
}

export async function pdfToText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return out;
}

export async function parsePDF(file: File): Promise<ImportedRow[]> {
  const text = await pdfToText(file);
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Falha ao ler o PDF");
  return json.transactions;
}

export type MatchStatus = "matched" | "diff_amount" | "missing" | "duplicate";
export interface ReconRow extends ImportedRow {
  key: string;
  status: MatchStatus;
  match?: Transaction;
}

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\(\d+\/\d+\)/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );
const similarity = (a: string, b: string) => {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  A.forEach((w) => B.has(w) && n++);
  return n / Math.min(A.size, B.size);
};

/** Motor de conciliação: compara arquivo x lançamentos da conta/cartão. */
export function reconcile(rows: ImportedRow[], existing: Transaction[]): ReconRow[] {
  const used = new Set<string>();
  const seen = new Map<string, number>();
  return rows.map((r, i) => {
    const sig = `${r.date}|${r.amount}|${r.description.toLowerCase()}`;
    const dupCount = seen.get(sig) ?? 0;
    seen.set(sig, dupCount + 1);
    const key = `${i}-${sig}`;
    const candidates = existing.filter((t) => !used.has(t.id) && t.type === r.type && Math.abs(dayDiff(t.date, r.date)) <= 3);
    const exact = candidates.find((t) => Math.abs(t.amount - r.amount) < 0.01);
    if (exact) {
      used.add(exact.id);
      return { ...r, key, status: "matched", match: exact };
    }
    const similar = candidates.find((t) => similarity(t.description, r.description) >= 0.5);
    if (similar) {
      used.add(similar.id);
      return { ...r, key, status: "diff_amount", match: similar };
    }
    if (dupCount > 0) return { ...r, key, status: "duplicate" };
    return { ...r, key, status: "missing" };
  });
}
