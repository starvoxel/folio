using System.ComponentModel;
using System.Runtime.CompilerServices;
using Avalonia;
using Avalonia.Automation;
using Avalonia.Automation.Peers;
using Avalonia.Automation.Provider;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Controls.Templates;
using Avalonia.Data;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.VisualTree;

namespace Slice;

/// <summary>The transactions table as the page sees it. Implemented by the stock DataGrid (C0, also C3 when built against ProDataGrid),
/// the DataGrid with custom automation peers (C1) and a ListBox-based table (C2).</summary>
public abstract class TableHost
{
    public abstract Control View { get; }
    public abstract TxRow? Selected { get; set; }
    public abstract void SetItems(List<TxRow> rows);
    public abstract void ScrollTo(TxRow r, int col);
    public abstract void SetSortGlyph(string col, ListSortDirection dir);
    public abstract IEnumerable<string> ColumnNames { get; }
    public abstract void ScrollToEnd();
    public event Action? SelectionChanged;
    public event Action<string>? SortRequested;
    protected void RaiseSelectionChanged() => SelectionChanged?.Invoke();
    protected void RaiseSort(string col) => SortRequested?.Invoke(col);
    protected static readonly string[] Names = { "Date", "Description", "Account", "Category", "Amount" };

    public static string RowName(TxRow r, bool selectedText) => $"{r.Date}, {r.Description}, {r.Account}, {r.Category}, {r.AmountText}" + (selectedText ? ", selected" : "");

    public static TableHost Create(MainWindow w, string kind) => kind switch
    {
        #if !PRODATAGRID
        "c1" => new DataGridTable(w, custom: true),
#endif
        "c2" => new ListTable(w),
        _ => new DataGridTable(w, custom: false),
    };
}

#if !PRODATAGRID
/// <summary>DataGrid subclass (C1). The grid creates its rows itself with new DataGridRow(), so rows cannot be subclassed;
/// the only app-code route to a custom row peer is to return our own wrapper peers from the grid peer's children.</summary>
public sealed class TableDataGrid : DataGrid
{
    protected override Type StyleKeyOverride => typeof(DataGrid);
    protected override AutomationPeer OnCreateAutomationPeer() => new TableGridPeer(this);
}

public sealed class TableGridPeer : DataGridAutomationPeerBase, ISelectionProvider
{
    private readonly ConditionalWeakTable<DataGridRow, TableRowPeer> _rows = new();
    public TableGridPeer(DataGrid owner) : base(owner)
    {
        owner.SelectionChanged += (_, _) => { RaisePropertyChangedEvent(SelectionPatternIdentifiers.SelectionProperty, null, null); foreach (var rp in Realized()) rp.NotifySelection(); };
        owner.LoadingRow += (_, _) => InvalidateChildren();
        owner.UnloadingRow += (_, _) => InvalidateChildren();
    }
    private DataGrid G => (DataGrid)Owner;
    private IEnumerable<TableRowPeer> Realized() => G.GetVisualDescendants().OfType<DataGridRow>().Where(r => r.IsVisible).Select(r => _rows.GetValue(r, x => new TableRowPeer(x, this)));
    protected override IReadOnlyList<AutomationPeer>? GetChildrenCore()
    {
        var list = new List<AutomationPeer>();
        var hdr = G.GetVisualDescendants().OfType<DataGridColumnHeadersPresenter>().FirstOrDefault();
        if (hdr is not null) list.Add(CreatePeerForElement(hdr));
        foreach (var rp in G.GetVisualDescendants().OfType<DataGridRow>().Where(r => r.IsVisible).OrderBy(r => r.Index).Select(r => _rows.GetValue(r, x => new TableRowPeer(x, this)))) list.Add(rp);
        return list;
    }
    public bool CanSelectMultiple => false;
    public bool IsSelectionRequired => false;
    public IReadOnlyList<AutomationPeer> GetSelection() => Realized().Where(r => r.IsSelected).Cast<AutomationPeer>().ToList();
}

/// <summary>Stand-in for the stock grid peer so the subclass can add provider interfaces.</summary>
public abstract class DataGridAutomationPeerBase : Avalonia.Controls.Automation.Peers.DataGridAutomationPeer
{
    protected DataGridAutomationPeerBase(DataGrid owner) : base(owner) { }
}

public sealed class TableRowPeer : ControlAutomationPeer, ISelectionItemProvider
{
    private readonly TableGridPeer _grid;
    private bool _last;
    public TableRowPeer(DataGridRow owner, TableGridPeer grid) : base(owner) { _grid = grid; }
    private DataGridRow Row => (DataGridRow)Owner;
    protected override AutomationControlType GetAutomationControlTypeCore() => OperatingSystem.IsMacOS() ? AutomationControlType.ListItem : AutomationControlType.DataItem;
    protected override string? GetNameCore() => Row.DataContext is TxRow r ? TableHost.RowName(r, false) : base.GetNameCore();
    protected override bool IsContentElementCore() => true;
    protected override bool IsControlElementCore() => true;
    public bool IsSelected => Row.IsSelected;
    public ISelectionProvider? SelectionContainer => _grid;
    public void Select() { if (Row.DataContext is not null && Row.Parent is not null && Row.FindAncestorOfType<DataGrid>() is { } g) g.SelectedItem = Row.DataContext; }
    public void AddToSelection() => Select();
    public void RemoveFromSelection() { if (Row.FindAncestorOfType<DataGrid>() is { } g && g.SelectedItem == Row.DataContext) g.SelectedItem = null; }
    public void NotifySelection()
    {
        var now = Row.IsSelected;
        if (now != _last) { RaisePropertyChangedEvent(SelectionItemPatternIdentifiers.IsSelectedProperty, _last, now); _last = now; }
    }
}

#endif

public sealed class DataGridTable : TableHost
{
    private readonly DataGrid _g;
    private readonly bool _fix;
    private List<TxRow> _rows = new();
    private bool _suppress;
    public DataGridTable(MainWindow w, bool custom)
    {
        _fix = w.Opt.A11yFix;
        #if !PRODATAGRID
        _g = custom ? new TableDataGrid() : new DataGrid();
#else
        _g = new DataGrid();
#endif
        _g.AutoGenerateColumns = false; _g.IsReadOnly = true; _g.SelectionMode = DataGridSelectionMode.Single;
        _g.CanUserSortColumns = true; _g.CanUserReorderColumns = false; _g.GridLinesVisibility = DataGridGridLinesVisibility.Horizontal;
        _g.HorizontalAlignment = HorizontalAlignment.Stretch; _g.VerticalAlignment = VerticalAlignment.Stretch;
        AutomationProperties.SetName(_g, "Transactions table");
        _g.Columns.Add(new DataGridTextColumn { Header = "Date", Binding = new Binding("Date"), Width = new DataGridLength(110), Tag = "Date" });
        _g.Columns.Add(new DataGridTextColumn { Header = "Description", Binding = new Binding("Description"), Width = new DataGridLength(1, DataGridLengthUnitType.Star), MinWidth = 220, Tag = "Description" });
        _g.Columns.Add(new DataGridTextColumn { Header = "Account", Binding = new Binding("Account"), Width = new DataGridLength(160), Tag = "Account" });
        _g.Columns.Add(new DataGridTextColumn { Header = "Category", Binding = new Binding("Category"), Width = new DataGridLength(140), Tag = "Category" });
        _g.Columns.Add(new DataGridTemplateColumn
        {
            Header = "Amount", Width = new DataGridLength(130), Tag = "Amount", SortMemberPath = "AmountCents",
            CellTemplate = new FuncDataTemplate<TxRow>((r, _) => new TextBlock { Text = r?.AmountText, HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(8, 0) }),
        });
        _g.Sorting += (_, e) => { e.Handled = true; RaiseSort((string)e.Column.Tag!); };
        if (_fix)
        {
            _g.LoadingRow += (_, e) =>
            {
                if (e.Row.DataContext is TxRow r)
                {
                    // C0 (stock peers): the row peer has no selected state, so it goes into the name. C1 names rows in its own peer.
                    if (!custom) AutomationProperties.SetName(e.Row, RowName(r, e.Row.IsSelected));
                    AutomationProperties.SetPositionInSet(e.Row, e.Row.Index + 1);
                    AutomationProperties.SetSizeOfSet(e.Row, _rows.Count);
                }
            };
        }
        _g.SelectionChanged += (_, _) =>
        {
            if (_fix && !custom)
                foreach (var row in _g.GetVisualDescendants().OfType<DataGridRow>())
                    if (row.DataContext is TxRow rr) AutomationProperties.SetName(row, RowName(rr, row.IsSelected));
            if (!_suppress) RaiseSelectionChanged();
        };
    }
    public override Control View => _g;
    public override TxRow? Selected { get => _g.SelectedItem as TxRow; set => _g.SelectedItem = value; }
    public override void SetItems(List<TxRow> rows)
    {
        _rows = rows;
        var keep = Selected?.Id;
        _suppress = true;
        _g.ItemsSource = rows;
        if (keep is not null) { var r = rows.FirstOrDefault(x => x.Id == keep); if (r is not null) _g.SelectedItem = r; }
        _suppress = false;
    }
    public override void ScrollTo(TxRow r, int col) => _g.ScrollIntoView(r, _g.Columns[col]);
    public override void ScrollToEnd() { if (_rows.Count > 0) _g.ScrollIntoView(_rows[^1], _g.Columns[1]); }
    public override void SetSortGlyph(string col, ListSortDirection dir)
    {
        foreach (var c in _g.Columns) c.Header = (string)c.Tag! + ((string)c.Tag! == col ? (dir == ListSortDirection.Ascending ? " ▲" : " ▼") : "");
    }
    public override IEnumerable<string> ColumnNames => _g.Columns.Select(c => (string)c.Tag!);
}

/// <summary>C2: a header row of buttons above a virtualized ListBox whose items are grid rows with the same column widths.
/// Left out: column resizing, reordering, per-column alignment settings, copy to clipboard, text measurement for column fit.</summary>
public sealed class ListTable : TableHost
{
    private const string Cols = "110,*,160,140,130";
    private readonly Grid _root = new() { RowDefinitions = new RowDefinitions("Auto,*") };
    private readonly ListBox _list = new();
    private readonly Button[] _heads;
    private List<TxRow> _rows = new();
    private bool _suppress;
    public ListTable(MainWindow w)
    {
        var header = new Grid { ColumnDefinitions = new ColumnDefinitions(Cols), Margin = new Thickness(0, 0, 17, 0) };
        AutomationProperties.SetName(header, "Column headers");
        _heads = new Button[Names.Length];
        for (var i = 0; i < Names.Length; i++)
        {
            var n = Names[i];
            var b = new Button { Content = n, HorizontalAlignment = HorizontalAlignment.Stretch, HorizontalContentAlignment = i == 4 ? HorizontalAlignment.Right : HorizontalAlignment.Left, Padding = new Thickness(8, 6), FontWeight = FontWeight.SemiBold };
            AutomationProperties.SetName(b, n + ", sort");
            b.Click += (_, _) => RaiseSort(n);
            Grid.SetColumn(b, i); header.Children.Add(b); _heads[i] = b;
        }
        _list.SelectionMode = SelectionMode.Single;
        AutomationProperties.SetName(_list, "Transactions table");
        _list.ItemTemplate = new FuncDataTemplate<TxRow>((r, _) =>
        {
            var g = new Grid { ColumnDefinitions = new ColumnDefinitions(Cols), Height = 28 };
            TextBlock T(string? s, int col, bool right = false)
            {
                var t = new TextBlock { Text = s, Margin = new Thickness(8, 0), VerticalAlignment = VerticalAlignment.Center, TextTrimming = TextTrimming.CharacterEllipsis, HorizontalAlignment = right ? HorizontalAlignment.Right : HorizontalAlignment.Left };
                Grid.SetColumn(t, col); g.Children.Add(t); return t;
            }
            T(r?.Date, 0); T(r?.Description, 1); T(r?.Account, 2); T(r?.Category, 3); T(r?.AmountText, 4, true);
            return g;
        });
        _list.ContainerPrepared += (_, e) =>
        {
            if (e.Container.DataContext is TxRow r)
            {
                AutomationProperties.SetName(e.Container, RowName(r, false));
                AutomationProperties.SetPositionInSet(e.Container, e.Index + 1);
                AutomationProperties.SetSizeOfSet(e.Container, _rows.Count);
            }
        };
        _list.SelectionChanged += (_, _) => { if (!_suppress) RaiseSelectionChanged(); };
        Grid.SetRow(_list, 1); _root.Children.Add(header); _root.Children.Add(_list);
    }
    public override Control View => _root;
    public override TxRow? Selected { get => _list.SelectedItem as TxRow; set => _list.SelectedItem = value; }
    public override void SetItems(List<TxRow> rows)
    {
        _rows = rows;
        var keep = Selected?.Id;
        _suppress = true;
        _list.ItemsSource = rows;
        if (keep is not null) { var r = rows.FirstOrDefault(x => x.Id == keep); if (r is not null) _list.SelectedItem = r; }
        _suppress = false;
    }
    public override void ScrollTo(TxRow r, int col) => _list.ScrollIntoView(r);
    public override void ScrollToEnd() { if (_rows.Count > 0) _list.ScrollIntoView(_rows[^1]); }
    public override void SetSortGlyph(string col, ListSortDirection dir)
    {
        for (var i = 0; i < Names.Length; i++) _heads[i].Content = Names[i] + (Names[i] == col ? (dir == ListSortDirection.Ascending ? " ▲" : " ▼") : "");
    }
    public override IEnumerable<string> ColumnNames => Names;
}
