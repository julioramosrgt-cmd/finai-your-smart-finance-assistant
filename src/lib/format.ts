let currency = "BRL";
export const setCurrency = (c: string) => {
  currency = c;
};
export const money = (n: number, cur = currency) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(n || 0);
export const dateBR = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
export const parseMoney = (s: string) => {
  const clean = s.replace(/[^\d,.-]/g, "");
  if (clean.includes(",")) return Number(clean.replace(/\./g, "").replace(",", ".")) || 0;
  return Number(clean) || 0;
};
