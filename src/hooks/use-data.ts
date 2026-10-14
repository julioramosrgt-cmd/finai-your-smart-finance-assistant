import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export function useData() {
  return useLiveQuery(async () => {
    const [accounts, cards, categories, subcategories, transactions, settings] = await Promise.all([
      db.accounts.toArray(),
      db.cards.toArray(),
      db.categories.toArray(),
      db.subcategories.toArray(),
      db.transactions.toArray(),
      db.settings.get("app"),
    ]);
    return { accounts, cards, categories, subcategories, transactions, settings };
  }, []);
}
export type AppData = NonNullable<ReturnType<typeof useData>>;
