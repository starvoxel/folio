using System.ComponentModel;
using System.Diagnostics;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Data;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Styling;
using Avalonia.Threading;
using FluentAvalonia.UI.Controls;

namespace Slice;

public sealed class MainWindow : Window
{
    public static readonly string[] Pages = { "Overview", "Transactions", "Reporting", "Net worth", "Accounts", "Rules & categories", "Settings" };

    public Store Store { get; }
    public Options Opt { get; }
    public string CurrentPage { get; private set; } = "";
    public string Month { get; private set; }
    public bool FirstFrameDone;

    private readonly FANavigationView _nav = new();
    private readonly ContentControl _host = new();
    private readonly ComboBox _monthBox = new();
    private readonly Dictionary<string, Control> _pages = new();
    private readonly Dictionary<string, FANavigationViewItem> _items = new();
    private bool _navigating;

    public TransactionsPage Transactions { get; }
    public ReportingPage Reporting { get; }
    public SettingsPage Settings { get; }

    public MainWindow(Store store, Options opt)
    {
        Store = store; Opt = opt;
        Title = "Folio";
        Width = opt.Width; Height = opt.Height;
        WindowStartupLocation = WindowStartupLocation.CenterScreen;
        Month = store.Months.First();
        if (opt.Theme is { } t) Application.Current!.RequestedThemeVariant = ParseTheme(t);

        Transactions = new TransactionsPage(this);
        Reporting = new ReportingPage(this);
        Settings = new SettingsPage(this);

        foreach (var p in Pages.Take(6)) AddItem(_nav.MenuItems, p);
        AddItem(_nav.FooterMenuItems, "Settings");
        _nav.IsSettingsVisible = false;
        _nav.PaneDisplayMode = FANavigationViewPaneDisplayMode.Left;
        _nav.PaneTitle = "Folio";
        _nav.OpenPaneLength = 240;
        _nav.IsPaneToggleButtonVisible = false;
        _nav.SelectionChanged += (_, e) =>
        {
            if (e.SelectedItem is FANavigationViewItem i && i.Tag is string name) Show(name);
        };

        var root = new DockPanel();
        var bar = BuildTopBar();
        DockPanel.SetDock(bar, Dock.Top);
        root.Children.Add(bar);
        root.Children.Add(_host);
        _nav.Content = root;
        Content = _nav;
        Opened += (_, _) =>
        {
            Activate();
            Navigate("Overview");
            // Usable window = opened, data loaded, first frame requested after layout.
            RequestAnimationFrame(_ => RequestAnimationFrame(_ =>
            {
                FirstFrameDone = true;
                Program.StartupMs = (DateTime.UtcNow - Process.GetCurrentProcess().StartTime.ToUniversalTime()).TotalMilliseconds;
            }));
        };
        // Escape closes the open dialog even if the library does not handle it (see Settings).
    }

    private static ThemeVariant ParseTheme(string s) => s.ToLowerInvariant() switch { "dark" => ThemeVariant.Dark, "light" => ThemeVariant.Light, _ => ThemeVariant.Default };

    private void AddItem(IList<object> list, string name)
    {
        var it = new FANavigationViewItem { Content = name, Tag = name };
        AutomationProperties_SetName(it, name);
        _items[name] = it; list.Add(it);
    }
    private static void AutomationProperties_SetName(Control c, string n) => Avalonia.Automation.AutomationProperties.SetName(c, n);

    private Control BuildTopBar()
    {
        var file = new TextBlock { Text = "Household 2026.folio", FontWeight = FontWeight.SemiBold, VerticalAlignment = VerticalAlignment.Center };
        var saved = new TextBlock { Text = "● Unsaved changes: none", Opacity = 0.7, VerticalAlignment = VerticalAlignment.Center };
        Avalonia.Automation.AutomationProperties.SetName(saved, "Unsaved indicator");
        Button B(string t) { var b = new Button { Content = t, IsEnabled = false }; Avalonia.Automation.AutomationProperties.SetName(b, t); return b; }
        _monthBox.ItemsSource = Store.Months.ToList();
        _monthBox.SelectedItem = Month; _monthBox.MinWidth = 120;
        Avalonia.Automation.AutomationProperties.SetName(_monthBox, "Month");
        _monthBox.SelectionChanged += (_, _) => { if (_monthBox.SelectedItem is string m && m != Month) { Month = m; Reporting.Refresh(); } };
        var menu = B("☰ Menu"); menu.IsEnabled = false;
        var left = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12, Children = { file, saved } };
        var right = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Children = { B("Undo"), B("Redo"), B("Import CSV"), _monthBox, menu } };
        var g = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto"), Margin = new Thickness(24, 12, 24, 8) };
        g.Children.Add(left); Grid.SetColumn(right, 1); g.Children.Add(right);
        return g;
    }

    public void SetMonth(string m) { _monthBox.SelectedItem = m; }

    public void Navigate(string page)
    {
        if (!_items.TryGetValue(page, out var it)) throw new ArgumentException("unknown page " + page);
        _nav.SelectedItem = it;
        if (CurrentPage != page) Show(page);
    }

    private void Show(string page)
    {
        if (_navigating || CurrentPage == page) return;
        _navigating = true;
        try
        {
            CurrentPage = page;
            if (!_pages.TryGetValue(page, out var c))
            {
                c = page switch
                {
                    "Transactions" => Transactions.View,
                    "Reporting" => Reporting.View,
                    "Settings" => Settings.View,
                    _ => Placeholder(page),
                };
                _pages[page] = c;
            }
            _host.Content = c;
            if (page == "Reporting") Reporting.Refresh();
        }
        finally { _navigating = false; }
    }

    private static Control Placeholder(string title) => new StackPanel
    {
        Margin = new Thickness(24),
        Children = { new TextBlock { Text = title, FontSize = 28, FontWeight = FontWeight.SemiBold }, new TextBlock { Text = "Placeholder page for the stack spike.", Opacity = 0.7, Margin = new Thickness(0, 8, 0, 0) } },
    };

    public void OpenTransactions(Filter f)
    {
        Transactions.ApplyFilter(f);
        Navigate("Transactions");
    }

    public Task NextFrames(int n = 2)
    {
        var tcs = new TaskCompletionSource();
        void Step(TimeSpan _) { if (--n <= 0) tcs.TrySetResult(); else this.RequestAnimationFrame(Step); }
        this.RequestAnimationFrame(Step);
        return tcs.Task;
    }

    public object State() => new
    {
        page = CurrentPage,
        month = Month,
        theme = (Application.Current!.ActualThemeVariant).Key.ToString(),
        window = new { width = (int)Bounds.Width, height = (int)Bounds.Height },
        nav = Pages,
        dialog = Settings.DialogState(),
        focused = Describe(TopLevel.GetTopLevel(this)?.FocusManager?.GetFocusedElement()),
        content = CurrentPage switch
        {
            "Transactions" => Transactions.State(),
            "Reporting" => Reporting.State(),
            "Settings" => Settings.State(),
            _ => (object)new { title = CurrentPage, placeholder = true },
        },
    };

    public static string? Describe(object? o)
    {
        if (o is null) return null;
        var n = o is Control c ? Avalonia.Automation.AutomationProperties.GetName(c) : null;
        return o.GetType().Name + (string.IsNullOrEmpty(n) ? "" : $" \"{n}\"");
    }

    /// <summary>
    /// Synthetic key: raised as a routed KeyDown/KeyUp on the focused element (Tab goes through the keyboard navigation handler).
    /// This is NOT an OS-level key; real OS keys are sent with xdotool in the Linux CI job.
    /// </summary>
    public bool SendKey(string key, bool shift = false)
    {
        var k = Enum.Parse<Key>(key, true);
        if (Opt.Headless)
        {
            // Headless platform has a proper input pipeline: key events go through the same path as real input.
            Avalonia.Headless.HeadlessWindowExtensions.KeyPress(this, k, shift ? RawInputModifiers.Shift : RawInputModifiers.None, PhysicalKey.None, null);
            Avalonia.Headless.HeadlessWindowExtensions.KeyRelease(this, k, shift ? RawInputModifiers.Shift : RawInputModifiers.None, PhysicalKey.None, null);
            return true;
        }
        var focused = (TopLevel.GetTopLevel(this)?.FocusManager?.GetFocusedElement() as InputElement) ?? this;
        var mods = shift ? KeyModifiers.Shift : KeyModifiers.None;
        if (k == Key.Tab)
        {
            var fm = TopLevel.GetTopLevel(this)!.FocusManager!;
            return fm.TryMoveFocus(shift ? NavigationDirection.Previous : NavigationDirection.Next);
        }
        var down = new KeyEventArgs { RoutedEvent = InputElement.KeyDownEvent, Key = k, KeyModifiers = mods, Source = focused };
        focused.RaiseEvent(down);
        focused.RaiseEvent(new KeyEventArgs { RoutedEvent = InputElement.KeyUpEvent, Key = k, KeyModifiers = mods, Source = focused });
        return true;
    }
}
