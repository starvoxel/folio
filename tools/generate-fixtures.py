#!/usr/bin/env python3
"""Deterministic fixture generator for the stack selection spike.

Writes fixtures/categories.json, fixtures/accounts.json and fixtures/transactions.json.
Standard library only. The same seed always produces byte-identical files.

Usage: python3 tools/generate-fixtures.py [--seed 20261111] [--rows 10000] [--out fixtures]
"""
import argparse
import hashlib
import json
import random
from datetime import date, timedelta
from pathlib import Path

# (id, name, parent_id or None)
CATEGORIES = [
    ("income", "Income", None),
    ("income-pay", "Paycheque", "income"),
    ("income-other", "Other income", "income"),
    ("housing", "Housing", None),
    ("housing-rent", "Rent and mortgage", "housing"),
    ("housing-utilities", "Utilities", "housing"),
    ("groceries", "Groceries", None),
    ("groceries-store", "Supermarket", "groceries"),
    ("groceries-market", "Markets and bakeries", "groceries"),
    ("dining", "Dining out", None),
    ("dining-restaurant", "Restaurants", "dining"),
    ("dining-coffee", "Coffee", "dining"),
    ("transport", "Transport", None),
    ("transport-fuel", "Fuel", "transport"),
    ("transport-transit", "Transit", "transport"),
    ("health", "Health", None),
    ("health-pharmacy", "Pharmacy", "health"),
    ("shopping", "Shopping", None),
    ("shopping-online", "Online", "shopping"),
    ("shopping-home", "Home and garden", "shopping"),
    ("entertainment", "Entertainment", None),
    ("entertainment-subs", "Subscriptions", "entertainment"),
    ("travel", "Travel", None),
    ("travel-flights", "Flights and hotels", "travel"),
    ("savings", "Savings", None),
    ("savings-transfer", "Savings transfers", "savings"),
    ("uncategorized", "Uncategorized", None),
]

ACCOUNTS = [
    ("acc-chequing", "Everyday Chequing", "Chequing", "RBC"),
    ("acc-savings", "Emergency Savings", "Savings", "EQ Bank"),
    ("acc-visa", "Rewards Visa", "Credit card", "TD"),
    ("acc-mc", "Travel Mastercard", "Credit card", "Tangerine"),
    ("acc-invest", "Brokerage", "Investment", "Questrade"),
    ("acc-line", "Line of Credit", "Debt", "CTFS"),
]

# category id -> (merchants with mixed scripts, (min_cents, max_cents), account ids)
MERCHANTS = {
    "income-pay": (["Payroll Acme Ltd", "PAIE Société Boréale", "給与 株式会社さくら", "Зарплата ООО Север"], (180000, 420000), ["acc-chequing"]),
    "income-other": (["Interac e-Transfer received", "Remboursement impôt", "Dividende 配当金", "Refund 退款"], (2000, 60000), ["acc-chequing", "acc-savings"]),
    "housing-rent": (["Rent – Maple Property Mgmt", "Loyer Gestion Érable", "家賃 管理会社"], (140000, 260000), ["acc-chequing"]),
    "housing-utilities": (["Hydro One", "Hydro-Québec", "Enbridge Gas", "Rogers Internet", "Bell Mobilité", "东京电力 TEPCO"], (4000, 32000), ["acc-chequing", "acc-visa"]),
    "groceries-store": (["Loblaws #1042", "Metro Plus Marché", "Costco Wholesale", "Sobeys", "Фруктовый рынок Москва"], (1500, 29000), ["acc-visa", "acc-mc", "acc-chequing"]),
    "groceries-market": (["Boulangerie Le Pain Doré", "St. Lawrence Market", "八百屋 田中", "مخبز الأمل Al Amal Bakery"], (600, 9000), ["acc-visa", "acc-chequing"]),
    "dining-restaurant": (["Pizzeria Café Napoli", "寿司 すしざんまい", "Le Bistro Étoilé", "Tim's Burger Hut", "מסעדת הים Seaside", "Noodle House 麵屋"], (1800, 14500), ["acc-visa", "acc-mc"]),
    "dining-coffee": (["Starbucks", "Café Olimpico", "Tim Hortons", "珈琲館", "Кофейня Бодрое утро"], (350, 1400), ["acc-visa", "acc-mc", "acc-chequing"]),
    "transport-fuel": (["Petro-Canada", "Shell Station", "Esso", "Ultramar"], (3500, 9500), ["acc-visa", "acc-mc"]),
    "transport-transit": (["TTC Presto reload", "STM Opus recharge", "Metro 東京メトロ", "GO Transit"], (1000, 15000), ["acc-chequing", "acc-visa"]),
    "health-pharmacy": (["Shoppers Drug Mart", "Pharmaprix", "ツルハドラッグ", "Rexall"], (800, 18000), ["acc-visa", "acc-mc"]),
    "shopping-online": (["Amazon.ca Marketplace", "AliExpress 全球速卖通", "Etsy Shop – Crafts", "Wildberries Интернет-магазин", "Zalando"], (1200, 38000), ["acc-visa", "acc-mc"]),
    "shopping-home": (["Canadian Tire", "IKEA Etobicoke", "Home Depot", "Rona Quincaillerie", "ニトリ"], (1500, 42000), ["acc-visa", "acc-mc"]),
    "entertainment-subs": (["Netflix", "Spotify", "Disney+", "Crunchyroll アニメ", "YouTube Premium", "iCloud+ Storage"], (500, 2500), ["acc-visa", "acc-mc"]),
    "travel-flights": (["Air Canada", "WestJet", "Hotel Lutetia Paris", "JAL 日本航空", "Aeroflot Аэрофлот", "Airbnb Rental"], (9000, 160000), ["acc-mc", "acc-visa"]),
    "savings-transfer": (["Transfer to Emergency Savings", "Virement épargne", "Savings goal 貯金"], (10000, 80000), ["acc-chequing", "acc-savings"]),
    "uncategorized": (["POS PURCHASE 4417", "DEBIT MEMO 88213", "UNKNOWN MERCHANT ???", "PAYMENT – THANK YOU 支払い"], (300, 25000), ["acc-chequing", "acc-visa", "acc-mc", "acc-line"]),
}

# weight of each category in the transaction mix
WEIGHTS = {
    "income-pay": 2, "income-other": 3, "housing-rent": 1, "housing-utilities": 5,
    "groceries-store": 18, "groceries-market": 6, "dining-restaurant": 10, "dining-coffee": 14,
    "transport-fuel": 5, "transport-transit": 5, "health-pharmacy": 3, "shopping-online": 8,
    "shopping-home": 4, "entertainment-subs": 4, "travel-flights": 1, "savings-transfer": 2,
    "uncategorized": 5,
}

NOTES = ["Split with partner", "Gift", "Check receipt", "Warranty", "Reimbursable", "Birthday 🎂", "Tax deductible", "通知済み", "À vérifier"]
INCOME_CATEGORIES = {"income-pay", "income-other"}
START = date(2026, 1, 1)
DAYS = 365


def build(seed: int, rows: int):
    rng = random.Random(seed)
    cats = [c for c in WEIGHTS]
    weights = [WEIGHTS[c] for c in cats]
    txs = []
    for _ in range(rows):
        cat = rng.choices(cats, weights=weights, k=1)[0]
        merchants, (lo, hi), accounts = MERCHANTS[cat]
        # skew amounts toward the low end so totals look like a household
        cents = lo + int((hi - lo) * (rng.random() ** 2.2))
        amount = cents if cat in INCOME_CATEGORIES else -cents
        d = START + timedelta(days=rng.randrange(DAYS))
        merchant = rng.choice(merchants)
        suffix = f" #{rng.randrange(1000, 9999)}" if rng.random() < 0.25 else ""
        note = rng.choice(NOTES) if rng.random() < 0.08 else None
        txs.append({
            "date": d.isoformat(),
            "description": merchant + suffix,
            "amount_cents": amount,
            "account_id": rng.choice(accounts),
            "category_id": cat,
            "note": note,
        })
    txs.sort(key=lambda t: (t["date"], t["description"], t["amount_cents"], t["account_id"]))
    for i, t in enumerate(txs, start=1):
        t["id"] = f"tx-{i:05d}"
    # put id first for readability
    return [{"id": t["id"], **{k: v for k, v in t.items() if k != "id"}} for t in txs]


def dump(path: Path, data) -> str:
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=20261111)
    ap.add_argument("--rows", type=int, default=10000)
    ap.add_argument("--out", default="fixtures")
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    categories = [{"id": i, "name": n, "parent_id": p} for i, n, p in CATEGORIES]
    accounts = [{"id": i, "name": n, "type": t, "provider": p} for i, n, t, p in ACCOUNTS]
    sums = {
        "categories.json": dump(out / "categories.json", categories),
        "accounts.json": dump(out / "accounts.json", accounts),
        "transactions.json": dump(out / "transactions.json", build(args.seed, args.rows)),
    }
    (out / "SHA256SUMS").write_text(
        "".join(f"{h}  {n}\n" for n, h in sorted(sums.items())), encoding="utf-8", newline="\n"
    )
    for n, h in sorted(sums.items()):
        print(f"{h}  {n}")


if __name__ == "__main__":
    main()
