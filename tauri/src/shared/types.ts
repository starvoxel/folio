export interface Account { id: string; name: string; type: string; provider: string }
export interface Category { id: string; name: string; parent_id: string | null }
export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount_cents: number; // integer cents, negative = spending
  account_id: string;
  category_id: string | null;
  note: string | null;
}
export interface Dataset { accounts: Account[]; categories: Category[]; transactions: Transaction[] }
export interface AppConfig { fileName: string; automation: boolean; platform: string }
