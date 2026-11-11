using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace Slice;

public sealed class ReportingPage
{
    private readonly MainWindow _w;
    private readonly Store _s;
    public Control View { get; }
    private readonly DonutControl _donut = new();
    private readonly BarChartControl _bars = new();
    private readonly StackPanel _legend = new() { Spacing = 2 };
    private readonly StackPanel _barLegend = new() { Spacing = 2 };
    private readonly TextBlock _donutTitle = new() { FontSize = 20, FontWeight = FontWeight.SemiBold };
    private List<Slice1> _slices = new();
    private List<MonthBar> _monthBars = new();

    public ReportingPage(MainWindow w)
    {
        _w = w; _s = w.Store;
        Avalonia.Automation.AutomationProperties.SetName(_donut, "Spending by main category (donut chart)");
        Avalonia.Automation.AutomationProperties.SetName(_bars, "Money in versus money out by month (bar chart)");
        _donut.SliceClicked += key => _w.OpenTransactions(new Filter { CategoryId = key, Month = _w.Month, Direction = "out" });
        _bars.BarClicked += (m, d) => _w.OpenTransactions(new Filter { Month = m, Direction = d });
        var title = new TextBlock { Text = "Reporting", FontSize = 28, FontWeight = FontWeight.SemiBold };
        var donutCard = Card(new StackPanel { Spacing = 12, Children = { _donutTitle, new StackPanel { Orientation = Orientation.Horizontal, Spacing = 24, Children = { _donut, new ScrollViewer { Content = _legend, MaxHeight = 280, MinWidth = 320 } } } } });
        var barTitle = new TextBlock { Text = "Money in vs money out, 2026", FontSize = 20, FontWeight = FontWeight.SemiBold };
        var key = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 16, Children = { new TextBlock { Text = "■ Money in", Foreground = new SolidColorBrush(Palette.Colors[1]) }, new TextBlock { Text = "■ Money out", Foreground = new SolidColorBrush(Palette.Colors[0]) } } };
        var barCard = Card(new StackPanel { Spacing = 12, Children = { barTitle, key, _bars, _barLegend } });
        View = new ScrollViewer { Content = new StackPanel { Margin = new Thickness(24, 0, 24, 24), Spacing = 16, Children = { title, donutCard, barCard } } };
        BuildBarLegend();
    }

    private static Border Card(Control c)
    {
        var b = new Border { Padding = new Thickness(16), CornerRadius = new CornerRadius(8), BorderThickness = new Thickness(1), Child = c };
        b.Bind(Border.BackgroundProperty, b.GetResourceObservable("CardBackgroundFillColorDefaultBrush"));
        b.Bind(Border.BorderBrushProperty, b.GetResourceObservable("CardStrokeColorDefaultBrush"));
        return b;
    }

    private static Button Row(string name, Control content, Action click)
    {
        var b = new Button { Content = content, HorizontalAlignment = HorizontalAlignment.Stretch, HorizontalContentAlignment = HorizontalAlignment.Stretch, Padding = new Thickness(8, 4), Background = Brushes.Transparent };
        Avalonia.Automation.AutomationProperties.SetName(b, name);
        b.Click += (_, _) => click();
        return b;
    }

    public void Refresh()
    {
        var m = _w.Month;
        var spend = _s.Rows.Where(r => r.Month == m && r.AmountCents < 0 && !Store.IsTransfer(r)).GroupBy(r => r.MainCategoryId)
            .Select(g => (id: g.Key, cents: -g.Sum(r => r.AmountCents))).OrderByDescending(x => x.cents).ToList();
        var order = _s.Categories.Where(c => c.ParentId is null).Select(c => c.Id).ToList();
        _slices = spend.Select(x => new Slice1(x.id, _s.MainName(x.id), x.cents, Palette.Colors[order.IndexOf(x.id) % Palette.Colors.Length])).ToList();
        _donut.SetSlices(_slices);
        _donutTitle.Text = $"Spending by category, {m}";
        var total = _slices.Sum(x => x.Cents);
        _legend.Children.Clear();
        foreach (var s in _slices)
        {
            var g = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto,60"), ColumnSpacing = 8 };
            var sw = new Border { Width = 12, Height = 12, CornerRadius = new CornerRadius(2), Background = new SolidColorBrush(s.Color), VerticalAlignment = VerticalAlignment.Center };
            var amt = new TextBlock { Text = Store.FormatCents(s.Cents), HorizontalAlignment = HorizontalAlignment.Right };
            var pct = new TextBlock { Text = (total == 0 ? 0 : s.Cents * 1000 / total / 10.0).ToString("0.0") + "%", HorizontalAlignment = HorizontalAlignment.Right, Opacity = 0.7 };
            g.Children.Add(sw); var n = new TextBlock { Text = s.Label }; Grid.SetColumn(n, 1); g.Children.Add(n); Grid.SetColumn(amt, 2); g.Children.Add(amt); Grid.SetColumn(pct, 3); g.Children.Add(pct);
            var key = s.Key;
            _legend.Children.Add(Row($"{s.Label}, {Store.FormatCents(s.Cents)}", g, () => _w.OpenTransactions(new Filter { CategoryId = key, Month = _w.Month, Direction = "out" })));
        }
        _monthBars = _s.Months.Select(mm => new MonthBar(mm,
            _s.Rows.Where(r => r.Month == mm && r.AmountCents > 0 && !Store.IsTransfer(r)).Sum(r => r.AmountCents),
            -_s.Rows.Where(r => r.Month == mm && r.AmountCents < 0 && !Store.IsTransfer(r)).Sum(r => r.AmountCents))).ToList();
        _bars.SetBars(_monthBars);
        BuildBarLegend();
    }

    private void BuildBarLegend()
    {
        _barLegend.Children.Clear();
        foreach (var b in _monthBars)
        {
            var g = new Grid { ColumnDefinitions = new ColumnDefinitions("80,*,*"), ColumnSpacing = 8 };
            g.Children.Add(new TextBlock { Text = b.Month, VerticalAlignment = VerticalAlignment.Center });
            var mm = b.Month;
            var inB = Row($"{mm} money in, {Store.FormatCents(b.InCents)}", new TextBlock { Text = "In  " + Store.FormatCents(b.InCents), HorizontalAlignment = HorizontalAlignment.Right }, () => _w.OpenTransactions(new Filter { Month = mm, Direction = "in" }));
            var outB = Row($"{mm} money out, {Store.FormatCents(b.OutCents)}", new TextBlock { Text = "Out  " + Store.FormatCents(b.OutCents), HorizontalAlignment = HorizontalAlignment.Right }, () => _w.OpenTransactions(new Filter { Month = mm, Direction = "out" }));
            Grid.SetColumn(inB, 1); Grid.SetColumn(outB, 2); g.Children.Add(inB); g.Children.Add(outB);
            _barLegend.Children.Add(g);
        }
    }

    public void ClickDonut(string key) => _w.OpenTransactions(new Filter { CategoryId = key, Month = _w.Month, Direction = "out" });
    public void ClickBar(string month, string dir) => _w.OpenTransactions(new Filter { Month = month, Direction = dir });

    public object State() => new
    {
        month = _w.Month,
        donut = _slices.Select(s => new { s.Key, s.Label, cents = s.Cents }),
        bars = _monthBars.Select(b => new { b.Month, inCents = b.InCents, outCents = b.OutCents }),
        legendRows = _legend.Children.Count + _barLegend.Children.Count * 2,
        chartImplementation = "custom-drawn (Avalonia DrawingContext), no chart library",
    };
}
