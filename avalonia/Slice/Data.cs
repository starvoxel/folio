using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Slice;

public sealed class Account { [JsonPropertyName("id")] public string Id { get; set; } = ""; [JsonPropertyName("name")] public string Name { get; set; } = ""; }
public sealed class Category { [JsonPropertyName("id")] public string Id { get; set; } = ""; [JsonPropertyName("name")] public string Name { get; set; } = ""; [JsonPropertyName("parent_id")] public string? ParentId { get; set; } }
public sealed class RawTx
{
    [JsonPropertyName("id")] public string Id { get; set; } = "";
    [JsonPropertyName("date")] public string Date { get; set; } = "";
    [JsonPropertyName("description")] public string Description { get; set; } = "";
    [JsonPropertyName("amount_cents")] public long AmountCents { get; set; }
    [JsonPropertyName("account_id")] public string AccountId { get; set; } = "";
    [JsonPropertyName("category_id")] public string? CategoryId { get; set; }
    [JsonPropertyName("note")] public string? Note { get; set; }
}

/// <summary>Row shown in the grid. Amount stays integer cents; AmountText is the formatted string.</summary>
public sealed class TxRow
{
    public string Id { get; init; } = "";
    public string Date { get; init; } = "";
    public string Description { get; init; } = "";
    public string Account { get; init; } = "";
    public string AccountId { get; init; } = "";
    public string Category { get; init; } = "";
    public string CategoryId { get; init; } = "";
    public string MainCategoryId { get; init; } = "";
    public long AmountCents { get; init; }
    public string AmountText { get; init; } = "";
    public string? Note { get; init; }
    public string Month => Date[..7];
}

public sealed class Store
{
    public List<Account> Accounts { get; }
    public List<Category> Categories { get; }
    public Dictionary<string, Category> CategoryById { get; }
    public List<TxRow> Rows { get; }
    public string DataDir { get; }

    public Store(string dir)
    {
        DataDir = dir;
        var o = new JsonSerializerOptions();
        Accounts = JsonSerializer.Deserialize<List<Account>>(File.ReadAllText(Path.Combine(dir, "accounts.json")), o)!;
        Categories = JsonSerializer.Deserialize<List<Category>>(File.ReadAllText(Path.Combine(dir, "categories.json")), o)!;
        var raw = JsonSerializer.Deserialize<List<RawTx>>(File.ReadAllText(Path.Combine(dir, "transactions.json")), o)!;
        CategoryById = Categories.ToDictionary(c => c.Id);
        var acc = Accounts.ToDictionary(a => a.Id);
        Rows = raw.Select(r =>
        {
            var cat = r.CategoryId is null ? null : CategoryById.GetValueOrDefault(r.CategoryId);
            var main = cat is null ? "uncategorized" : (cat.ParentId ?? cat.Id);
            return new TxRow
            {
                Id = r.Id, Date = r.Date, Description = r.Description,
                Account = acc.TryGetValue(r.AccountId, out var a) ? a.Name : r.AccountId, AccountId = r.AccountId,
                Category = cat?.Name ?? "Uncategorized", CategoryId = cat?.Id ?? "uncategorized", MainCategoryId = main,
                AmountCents = r.AmountCents, AmountText = FormatCents(r.AmountCents), Note = r.Note,
            };
        }).ToList();
    }

    /// <summary>Integer cents to "-1,234.56". No floating point.</summary>
    public static string FormatCents(long cents)
    {
        var neg = cents < 0; var abs = Math.Abs(cents);
        var s = (abs / 100).ToString("N0", CultureInfo.InvariantCulture) + "." + (abs % 100).ToString("00", CultureInfo.InvariantCulture);
        return (neg ? "-" : "") + "$" + s;
    }

    public string MainName(string id) => CategoryById.TryGetValue(id, out var c) ? c.Name : id;
    public IEnumerable<string> Months => Rows.Select(r => r.Month).Distinct().OrderBy(x => x);
    /// <summary>Savings transfers are not spending or income for the charts.</summary>
    public static bool IsTransfer(TxRow r) => r.MainCategoryId == "savings";
}
