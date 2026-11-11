namespace Slice;

public sealed class Filter
{
    public string Search { get; set; } = "";
    public string? AccountId { get; set; }
    public string? CategoryId { get; set; }   // main or sub id
    public string? Month { get; set; }        // yyyy-MM
    public string? Direction { get; set; }    // "in" | "out" (transfers excluded)
    public bool IsEmpty => Search == "" && AccountId is null && CategoryId is null && Month is null && Direction is null;

    public bool Matches(TxRow r, Store s)
    {
        if (AccountId is not null && r.AccountId != AccountId) return false;
        if (CategoryId is not null && r.CategoryId != CategoryId && r.MainCategoryId != CategoryId) return false;
        if (Month is not null && r.Month != Month) return false;
        if (Direction == "in" && (r.AmountCents <= 0 || Store.IsTransfer(r))) return false;
        if (Direction == "out" && (r.AmountCents >= 0 || Store.IsTransfer(r))) return false;
        if (Search != "" && r.Description.IndexOf(Search, StringComparison.CurrentCultureIgnoreCase) < 0
            && (r.Note is null || r.Note.IndexOf(Search, StringComparison.CurrentCultureIgnoreCase) < 0)) return false;
        return true;
    }
}
