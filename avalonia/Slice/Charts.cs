using System.Globalization;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;

namespace Slice;

public static class Palette
{
    // Fluent-ish categorical colours (same in light and dark; labels use theme brushes).
    public static readonly Color[] Colors =
    {
        Color.Parse("#0078D4"), Color.Parse("#107C10"), Color.Parse("#D83B01"), Color.Parse("#8764B8"),
        Color.Parse("#00B7C3"), Color.Parse("#C239B3"), Color.Parse("#986F0B"), Color.Parse("#767676"),
        Color.Parse("#E81123"), Color.Parse("#2D7D9A"),
    };
}

public sealed record Slice1(string Key, string Label, long Cents, Color Color);

/// <summary>Custom-drawn donut chart. No chart library.</summary>
public sealed class DonutControl : Control
{
    public IReadOnlyList<Slice1> Slices { get; private set; } = Array.Empty<Slice1>();
    public event Action<string>? SliceClicked;
    public DonutControl() { Width = 260; Height = 260; Cursor = new Cursor(StandardCursorType.Hand); }
    public void SetSlices(IReadOnlyList<Slice1> s) { Slices = s; InvalidateVisual(); }

    private (Point c, double ro, double ri) Geo() { var r = Math.Min(Bounds.Width, Bounds.Height) / 2 - 4; return (new Point(Bounds.Width / 2, Bounds.Height / 2), r, r * 0.6); }

    public override void Render(DrawingContext ctx)
    {
        var (c, ro, ri) = Geo();
        var total = Slices.Sum(s => (double)s.Cents);
        if (total <= 0)
        {
            var empty = new FormattedText("No spending", CultureInfo.CurrentUICulture, FlowDirection.LeftToRight, Typeface.Default, 14, ChartBrushes.Secondary(this));
            ctx.DrawText(empty, new Point(c.X - empty.Width / 2, c.Y - empty.Height / 2));
            return;
        }
        var start = -Math.PI / 2;
        foreach (var s in Slices)
        {
            var sweep = s.Cents / total * Math.PI * 2;
            if (Slices.Count == 1) sweep = Math.PI * 2 - 0.0001;
            var gap = Slices.Count > 1 ? 0.01 : 0;
            ctx.DrawGeometry(new SolidColorBrush(s.Color), null, Ring(c, ro, ri, start + gap, start + sweep - gap));
            start += sweep;
        }
        var t = new FormattedText(Store.FormatCents((long)total), CultureInfo.CurrentUICulture, FlowDirection.LeftToRight,
            new Typeface(FontFamily.Default, FontStyle.Normal, FontWeight.SemiBold), 18, ChartBrushes.Primary(this));
        ctx.DrawText(t, new Point(c.X - t.Width / 2, c.Y - t.Height / 2 - 8));
        var l = new FormattedText("spent", CultureInfo.CurrentUICulture, FlowDirection.LeftToRight, Typeface.Default, 12, ChartBrushes.Secondary(this));
        ctx.DrawText(l, new Point(c.X - l.Width / 2, c.Y + 8));
    }

    private static StreamGeometry Ring(Point c, double ro, double ri, double a0, double a1)
    {
        static Point P(Point c, double r, double a) => new(c.X + r * Math.Cos(a), c.Y + r * Math.Sin(a));
        var g = new StreamGeometry();
        using var x = g.Open();
        var large = a1 - a0 > Math.PI;
        x.BeginFigure(P(c, ro, a0), true);
        x.ArcTo(P(c, ro, a1), new Size(ro, ro), 0, large, SweepDirection.Clockwise);
        x.LineTo(P(c, ri, a1));
        x.ArcTo(P(c, ri, a0), new Size(ri, ri), 0, large, SweepDirection.CounterClockwise);
        x.EndFigure(true);
        return g;
    }

    public string? HitTest(Point p)
    {
        var (c, ro, ri) = Geo();
        var dx = p.X - c.X; var dy = p.Y - c.Y; var d = Math.Sqrt(dx * dx + dy * dy);
        if (d < ri || d > ro) return null;
        var a = Math.Atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2;
        var total = Slices.Sum(s => (double)s.Cents); var acc = 0.0;
        foreach (var s in Slices) { acc += s.Cents / total * Math.PI * 2; if (a <= acc) return s.Key; }
        return null;
    }

    protected override void OnPointerPressed(PointerPressedEventArgs e)
    {
        base.OnPointerPressed(e);
        var k = HitTest(e.GetPosition(this)); if (k is not null) SliceClicked?.Invoke(k);
    }
}

public sealed record MonthBar(string Month, long InCents, long OutCents);

/// <summary>Custom-drawn grouped bar chart (money in vs money out per month).</summary>
public sealed class BarChartControl : Control
{
    public IReadOnlyList<MonthBar> Bars { get; private set; } = Array.Empty<MonthBar>();
    public event Action<string, string>? BarClicked; // month, "in"|"out"
    public BarChartControl() { Height = 260; MinWidth = 520; Cursor = new Cursor(StandardCursorType.Hand); }
    public void SetBars(IReadOnlyList<MonthBar> b) { Bars = b; InvalidateVisual(); }
    private const double Left = 56, Bottom = 24, Top = 8;

    private IEnumerable<(Rect r, string month, string dir)> Rects()
    {
        if (Bars.Count == 0) yield break;
        var max = Math.Max(1, Bars.Max(b => Math.Max(b.InCents, b.OutCents)));
        var w = Bounds.Width - Left; var h = Bounds.Height - Bottom - Top; var gw = w / Bars.Count; var bw = Math.Min(22, gw * 0.35);
        for (var i = 0; i < Bars.Count; i++)
        {
            var x = Left + gw * i + gw / 2;
            var hi = h * Bars[i].InCents / max; var ho = h * Bars[i].OutCents / max;
            yield return (new Rect(x - bw - 1, Top + h - hi, bw, hi), Bars[i].Month, "in");
            yield return (new Rect(x + 1, Top + h - ho, bw, ho), Bars[i].Month, "out");
        }
    }

    public override void Render(DrawingContext ctx)
    {
        if (Bars.Count == 0) return;
        var sec = ChartBrushes.Secondary(this);
        var max = Math.Max(1, Bars.Max(b => Math.Max(b.InCents, b.OutCents)));
        var h = Bounds.Height - Bottom - Top;
        var grid = new Pen(ChartBrushes.Divider(this), 1);
        for (var i = 0; i <= 4; i++)
        {
            var y = Top + h - h * i / 4;
            ctx.DrawLine(grid, new Point(Left, y), new Point(Bounds.Width, y));
            var t = new FormattedText("$" + (max * i / 4 / 100 / 1000).ToString(CultureInfo.InvariantCulture) + "k", CultureInfo.CurrentUICulture, FlowDirection.LeftToRight, Typeface.Default, 11, sec);
            ctx.DrawText(t, new Point(Left - t.Width - 6, y - t.Height / 2));
        }
        var inB = new SolidColorBrush(Palette.Colors[1]); var outB = new SolidColorBrush(Palette.Colors[0]);
        foreach (var (r, m, d) in Rects()) ctx.DrawRectangle(d == "in" ? inB : outB, null, r, 2, 2);
        var gw = (Bounds.Width - Left) / Bars.Count;
        for (var i = 0; i < Bars.Count; i++)
        {
            var label = new FormattedText(Bars[i].Month[5..], CultureInfo.CurrentUICulture, FlowDirection.LeftToRight, Typeface.Default, 11, sec);
            ctx.DrawText(label, new Point(Left + gw * i + gw / 2 - label.Width / 2, Bounds.Height - Bottom + 6));
        }
    }

    protected override void OnPointerPressed(PointerPressedEventArgs e)
    {
        base.OnPointerPressed(e);
        var p = e.GetPosition(this);
        foreach (var (r, m, d) in Rects()) if (r.Inflate(2).Contains(p)) { BarClicked?.Invoke(m, d); return; }
    }
}

public static class ChartBrushes
{
    private static IBrush Get(Control c, string key, IBrush fallback) =>
        c.TryFindResource(key, c.ActualThemeVariant, out var v) && v is IBrush b ? b : fallback;
    public static IBrush Primary(Control c) => Get(c, "TextFillColorPrimaryBrush", Brushes.Black);
    public static IBrush Secondary(Control c) => Get(c, "TextFillColorSecondaryBrush", Brushes.Gray);
    public static IBrush Divider(Control c) => Get(c, "DividerStrokeColorDefaultBrush", Brushes.LightGray);
}
