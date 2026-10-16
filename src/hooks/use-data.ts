import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useProfile } from "@/hooks/use-profile";

export function useData() {
  const profile = useProfile();
  return useLiveQuery(async () => {
    const [accounts, cards, loanContracts, categories, subcategories, transactions, settings] = await Promise.all([
      db.accounts.where("profile").equals(profile).toArray(),
      db.cards.where("profile").equals(profile).toArray(),
      db.loanContracts.where("profile").equals(profile).toArray(),
      db.categories.where("profile").equals(profile).toArray(),
      db.subcategories.where("profile").equals(profile).toArray(),
      db.transactions.where("profile").equals(profile).toArray(),
      db.settings.get("app"),
    ]);
    return { accounts, cards, loanContracts, categories, subcategories, transactions, settings };
  }, [profile]);
}
export type AppData = NonNullable<ReturnType<typeof useData>>;
