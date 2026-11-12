using System.ComponentModel;
using System.Diagnostics;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Templates;
using Avalonia.Data;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Threading;

namespace Slice;

public sealed class TransactionsPage
{
    private readonly MainWindow _w;
    private readonly Store _s;
    public Control View { get; }
    public DataGrid Grid { get; } = new();
    private readonly TextBox _search = new() { Watermark = "Search description or note", MinWidth = 260 };
    private readonly ComboBox _acct = new() { MinWidth = 180 };
    private readonly ComboBox _cat = new() { MinWidth = 200 };
    private readonly TextBlock _count = new() { VerticalAlignment = VerticalAlignment.Center, Opacity = 0.7 };
    private readonly TextBlock _chip = new() { VerticalAlignment = VerticalAlignment.Center };
    private readonly Button _clear = new() { Content = "Clear filters" };
    private readonly TextBlock _dTitle = new() { FontSize = 20, FontWeight = FontWeight.SemiBold, TextWrapping = TextWrapping.Wrap };
    private readonly TextBlock _dBody = new() { TextWrapping = TextWrapping.Wrap };
    private readonly Filter _f = new();
    private List<TxRow> _shown = new();
    private string _sortCol = "Date"; private ListSortDirection _sortDir = ListSortDirection.Ascending;
    private bool _suppress;
    public TxRow? Selected => Grid.SelectedItem as TxRow;
    public List<TxRow> Shown => _shown;

    public TransactionsPage(MainWindow w)
    {
        _w = w; _s = w.Store;
        Grid.AutoGenerateColumns = false; Grid.IsReadOnly = true; Grid.SelectionMode = DataGridSelectionMode.Single;
        Grid.CanUserSortColumns = true; Grid.CanUserReorderColumns = false; Grid.GridLinesVisibility = DataGridGridLinesVisibility.Horizontal;
        Grid.HorizontalAlignment = HorizontalAlignment.Stretch; Grid.VerticalAlignment = VerticalAlignment.Stretch;
        Avalonia.Automation.AutomationProperties.SetName(Grid, "Transactions table");
        Grid.Columns.Add(new DataGridTextColumn { Header = "Date", Binding = new Binding("Date"), Width = new DataGridLength(110), Tag = "Date" });
        Grid.Columns.Add(new DataGridTextColumn { Header = "Description", Binding = new Binding("Description"), Width = new DataGridLength(1, DataGridLengthUnitType.Star), MinWidth = 220, Tag = "Description" });
        Grid.Columns.Add(new DataGridTextColumn { Header = "Account", Binding = new Binding("Account"), Width = new DataGridLength(160), Tag = "Account" });
        Grid.Columns.Add(new DataGridTextColumn { Header = "Category", Binding = new Binding("Category"), Width = new DataGridLength(140), Tag = "Category" });
        Grid.Columns.Add(new DataGridTemplateColumn
        {
            Header = "Amount", Width = new DataGridLength(130), Tag = "Amount", SortMemberPath = "AmountCents",
            CellTemplate = new FuncDataTemplate<TxRow>((r, _) => new TextBlock { Text = r?.AmountText, HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(8, 0) }),
        });
        Grid.Sorting += (_, e) =>
        {
            e.Handled = true; // we sort ourselves so the cost is measurable and the data stays integer cents
            var name = (string)e.Column.Tag!;
            var dir = _sortCol == name && _sortDir == ListSortDirection.Ascending ? ListSortDirection.Descending : ListSortDirection.Ascending;
            Sort(name, dir);
        };
        if (w.Opt.A11yFix)
        {
            // Rows have no text of their own in the accessibility tree; give each realized row a readable name and its position.
            Grid.LoadingRow += (_, e) =>
            {
                if (e.Row.DataContext is TxRow r)
                {
                    Avalonia.Automation.AutomationProperties.SetName(e.Row, RowName(r, e.Row.IsSelected));
                    Avalonia.Automation.AutomationProperties.SetPositionInSet(e.Row, e.Row.Index + 1);
                    Avalonia.Automation.AutomationProperties.SetSizeOfSet(e.Row, _shown.Count);
                }
            };
        }
        Grid.SelectionChanged += (_, _) =>
        {
            if (w.Opt.A11yFix)
                foreach (var row in Avalonia.VisualTree.VisualExtensions.GetVisualDescendants(Grid).OfType<DataGridRow>())
                    if (row.DataContext is TxRow rr) Avalonia.Automation.AutomationProperties.SetName(row, RowName(rr, row.IsSelected));
            if (!_suppress) UpdateDetails();
        };

        _acct.ItemsSource = new[] { "All accounts" }.Concat(_s.Accounts.Select(a => a.Name)).ToList(); _acct.SelectedIndex = 0;
        var cats = new List<string> { "All categories" };
        foreach (var main in _s.Categories.Where(c => c.ParentId is null)) { cats.Add(main.Name); cats.AddRange(_s.Categories.Where(c => c.ParentId == main.Id).Select(c => "    " + c.Name)); }
        _cat.ItemsSource = cats; _cat.SelectedIndex = 0;
        Avalonia.Automation.AutomationProperties.SetName(_search, "Search"); Avalonia.Automation.AutomationProperties.SetName(_acct, "Account filter"); Avalonia.Automation.AutomationProperties.SetName(_cat, "Category filter");
        _search.TextChanged += (_, _) => { if (!_suppress) { _f.Search = _search.Text ?? ""; Refresh(); } };
        _acct.SelectionChanged += (_, _) => { if (!_suppress) { _f.AccountId = _acct.SelectedIndex <= 0 ? null : _s.Accounts[_acct.SelectedIndex - 1].Id; Refresh(); } };
        _cat.SelectionChanged += (_, _) => { if (!_suppress) { _f.CategoryId = CatIdAt(_cat.SelectedIndex); Refresh(); } };
        _clear.Click += (_, _) => ApplyFilter(new Filter());

        var bar = new WrapPanel { Margin = new Thickness(0, 0, 0, 8), Children = { _search, _acct, _cat, _clear, _count } };
        foreach (var c in bar.Children) c.Margin = new Thickness(0, 0, 8, 8);
        var left = new DockPanel { Margin = new Thickness(24, 0, 12, 16) };
        DockPanel.SetDock(bar, Dock.Top); DockPanel.SetDock(_chip, Dock.Top);
        left.Children.Add(bar); left.Children.Add(_chip); left.Children.Add(Grid);
        var details = new Border
        {
            Width = 320, Padding = new Thickness(16), Margin = new Thickness(0, 0, 24, 16), CornerRadius = new CornerRadius(8), BorderThickness = new Thickness(1),
            Child = new StackPanel { Spacing = 8, Children = { new TextBlock { Text = "Details", Opacity = 0.7 }, _dTitle, _dBody } },
        };
        details.Bind(Border.BackgroundProperty, details.GetResourceObservable("CardBackgroundFillColorDefaultBrush"));
        details.Bind(Border.BorderBrushProperty, details.GetResourceObservable("CardStrokeColorDefaultBrush"));
        Avalonia.Automation.AutomationProperties.SetName(details, "Details panel");
        var g = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        g.Children.Add(left); Avalonia.Controls.Grid.SetColumn(details, 1); g.Children.Add(details);
        View = g;
        Refresh();
        UpdateDetails();
    }

    // The DataGrid row peer has no selected state of its own, so the state is part of the accessible name.
    private static string RowName(TxRow r, bool selected) => $"{r.Date}, {r.Description}, {r.Account}, {r.Category}, {r.AmountText}" + (selected ? ", selected" : "");

    private string? CatIdAt(int i)
    {
        if (i <= 0) return null;
        var order = new List<string>();
        foreach (var main in _s.Categories.Where(c => c.ParentId is null)) { order.Add(main.Id); order.AddRange(_s.Categories.Where(c => c.ParentId == main.Id).Select(c => c.Id)); }
        return order[i - 1];
    }
    private int IndexOfCat(string? id)
    {
        if (id is null) return 0;
        var order = new List<string>();
        foreach (var main in _s.Categories.Where(c => c.ParentId is null)) { order.Add(main.Id); order.AddRange(_s.Categories.Where(c => c.ParentId == main.Id).Select(c => c.Id)); }
        return order.IndexOf(id) + 1;
    }

    public void ApplyFilter(Filter f)
    {
        _suppress = true;
        _f.Search = f.Search; _f.AccountId = f.AccountId; _f.CategoryId = f.CategoryId; _f.Month = f.Month; _f.Direction = f.Direction;
        _search.Text = f.Search;
        _acct.SelectedIndex = f.AccountId is null ? 0 : _s.Accounts.FindIndex(a => a.Id == f.AccountId) + 1;
        _cat.SelectedIndex = IndexOfCat(f.CategoryId);
        _suppress = false;
        Refresh();
    }

    private IEnumerable<TxRow> Sorted(IEnumerable<TxRow> rows, string col, ListSortDirection dir)
    {
        Func<TxRow, object> key = col switch
        {
            "Description" => r => r.Description.ToLowerInvariant(),
            "Account" => r => r.Account,
            "Category" => r => r.Category,
            "Amount" => r => r.AmountCents,
            _ => r => r.Date,
        };
        var o = dir == ListSortDirection.Ascending ? rows.OrderBy(key, Comparer<object>.Create(Cmp)) : rows.OrderByDescending(key, Comparer<object>.Create(Cmp));
        return o.ThenBy(r => r.Id, StringComparer.Ordinal);
    }
    private static int Cmp(object a, object b) => a is long x ? x.CompareTo((long)b) : string.CompareOrdinal((string)a, (string)b);

    public void Refresh()
    {
        var keep = Selected?.Id;
        _shown = Sorted(_s.Rows.Where(r => _f.Matches(r, _s)), _sortCol, _sortDir).ToList();
        _suppress = true;
        Grid.ItemsSource = _shown;
        if (keep is not null) { var r = _shown.FirstOrDefault(x => x.Id == keep); if (r is not null) Grid.SelectedItem = r; }
        _suppress = false;
        _count.Text = $"{_shown.Count:N0} of {_s.Rows.Count:N0} rows";
        _chip.Text = _f.Month is null && _f.Direction is null ? "" : $"Filtered by: {string.Join(", ", new[] { _f.Month, _f.Direction == "in" ? "money in" : _f.Direction == "out" ? "money out" : null }.Where(x => x is not null))}";
        _chip.Margin = new Thickness(0, 0, 0, _chip.Text == "" ? 0 : 8);
        UpdateSortGlyph();
        UpdateDetails();
    }

    private void UpdateSortGlyph()
    {
        foreach (var c in Grid.Columns) c.Header = (string)c.Tag! + ((string)c.Tag! == _sortCol ? (_sortDir == ListSortDirection.Ascending ? " ▲" : " ▼") : "");
    }

    public void Sort(string col, ListSortDirection dir) { _sortCol = col; _sortDir = dir; Refresh(); }

    public async Task<object> TimeSortAsync(string col, ListSortDirection dir)
    {
        var sw = Stopwatch.StartNew();
        Sort(col, dir);
        var compute = sw.Elapsed.TotalMilliseconds;
        await _w.NextFrames(3);
        return new { column = col, direction = dir.ToString(), computeAndAssignMs = Math.Round(compute, 1), toRenderedFrameMs = Math.Round(sw.Elapsed.TotalMilliseconds, 1), rows = _shown.Count };
    }

    public void Select(string id) { var r = _shown.FirstOrDefault(x => x.Id == id); Grid.SelectedItem = r; if (r is not null) Grid.ScrollIntoView(r, Grid.Columns[0]); }

    private void UpdateDetails()
    {
        if (Selected is { } r)
        {
            _dTitle.Text = r.Description;
            _dBody.Text = $"{r.Date}   {r.AmountText}\nAccount: {r.Account}\nCategory: {r.Category} ({_s.MainName(r.MainCategoryId)})\nNote: {(string.IsNullOrEmpty(r.Note) ? "(none)" : r.Note)}";
        }
        else { _dTitle.Text = "No row selected"; _dBody.Text = "Select a transaction to see its note, account and category."; }
    }

    /// <summary>Scrolls the whole grid one pass, a few rows per frame, recording frame-to-frame time.</summary>
    public async Task<object> ScrollPassAsync(int step = 8)
    {
        var frames = new List<double>();
        var tcs = new TaskCompletionSource();
        var idx = 0; TimeSpan? last = null;
        var rows = _shown;
        void Tick(TimeSpan t)
        {
            if (last is { } l) frames.Add((t - l).TotalMilliseconds);
            last = t;
            if (idx >= rows.Count) { tcs.TrySetResult(); return; }
            Grid.ScrollIntoView(rows[Math.Min(idx, rows.Count - 1)], Grid.Columns[1]);
            idx += step;
            _w.RequestAnimationFrame(Tick);
        }
        var before = Metrics.Snapshot();
        var sw = Stopwatch.StartNew();
        _w.RequestAnimationFrame(Tick);
        await tcs.Task;
        var after = Metrics.Snapshot();
        frames.Sort();
        return new
        {
            rows = rows.Count, frames = frames.Count, seconds = Math.Round(sw.Elapsed.TotalSeconds, 1),
            worstFrameMs = Math.Round(frames.Count > 0 ? frames[^1] : 0, 1), p99FrameMs = Math.Round(frames.Count > 0 ? frames[(int)(frames.Count * 0.99)] : 0, 1),
            medianFrameMs = Math.Round(frames.Count > 0 ? frames[frames.Count / 2] : 0, 1), over100ms = frames.Count(f => f > 100),
            before, after,
        };
    }

    public object State() => new
    {
        total = _s.Rows.Count, shown = _shown.Count,
        filter = new { search = _f.Search, accountId = _f.AccountId, categoryId = _f.CategoryId, month = _f.Month, direction = _f.Direction },
        sort = new { column = _sortCol, direction = _sortDir.ToString() },
        selected = Selected is null ? null : new { id = Selected.Id, description = Selected.Description, date = Selected.Date, amountCents = Selected.AmountCents, amount = Selected.AmountText, account = Selected.Account, category = Selected.Category, mainCategory = _s.MainName(Selected.MainCategoryId), note = Selected.Note },
        detailsPanel = new { title = _dTitle.Text, body = _dBody.Text },
        firstRows = _shown.Take(5).Select(r => new { r.Id, r.Date, r.Description, r.Account, r.Category, amountCents = r.AmountCents, amount = r.AmountText }),
        columns = Grid.Columns.Select(c => (string)c.Tag!),
    };
}
