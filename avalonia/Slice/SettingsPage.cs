using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.VisualTree;
using FluentAvalonia.UI.Controls;

namespace Slice;

public sealed class SettingsPage
{
    private readonly MainWindow _w;
    public Control View { get; }
    private readonly ComboBox _theme = new() { MinWidth = 160 };
    private FAContentDialog? _dlg;
    private Task<FAContentDialogResult>? _dlgTask;
    public string LastDialogResult { get; private set; } = "";
    public Button OpenButton { get; } = new() { Content = "Reset month review…" };

    public SettingsPage(MainWindow w)
    {
        _w = w;
        _theme.ItemsSource = new[] { "Light", "Dark", "System" };
        _theme.SelectedIndex = w.Opt.Theme?.ToLowerInvariant() switch { "light" => 0, "dark" => 1, _ => 2 };
        Avalonia.Automation.AutomationProperties.SetName(_theme, "Theme");
        _theme.SelectionChanged += (_, _) => SetTheme((string)_theme.SelectedItem!);
        Avalonia.Automation.AutomationProperties.SetName(OpenButton, "Reset month review");
        OpenButton.Click += async (_, _) => await OpenDialogAsync();
        View = new StackPanel
        {
            Margin = new Thickness(24), Spacing = 12,
            Children =
            {
                new TextBlock { Text = "Settings", FontSize = 28, FontWeight = FontWeight.SemiBold },
                new TextBlock { Text = "Theme" }, _theme,
                new TextBlock { Text = "Confirmation dialog" }, OpenButton,
            },
        };
    }

    public void SetTheme(string name) =>
        Application.Current!.RequestedThemeVariant = name.ToLowerInvariant() switch { "dark" => Avalonia.Styling.ThemeVariant.Dark, "light" => Avalonia.Styling.ThemeVariant.Light, _ => Avalonia.Styling.ThemeVariant.Default };

    public bool DialogOpen => _dlg is not null;

    public async Task OpenDialogAsync()
    {
        if (_dlg is not null) return;
        _dlg = new FAContentDialog
        {
            Title = "Reset this month's review?",
            Content = new StackPanel { Spacing = 8, Children = { new TextBlock { Text = "This clears review marks for the selected month. Nothing else changes." }, new TextBox { Watermark = "Optional reason" } } },
            PrimaryButtonText = "Reset", CloseButtonText = "Cancel", DefaultButton = FAContentDialogButton.Close,
        };
        if (_w.Opt.A11yFix) Avalonia.Automation.AutomationProperties.SetName(_dlg, "Reset this month's review? dialog");
        // Escape must close the dialog; the library does not guarantee that, so handle it here if needed.
        _dlg.KeyDown += (_, e) => { if (e.Key == Key.Escape) { _dlg?.Hide(FAContentDialogResult.None); e.Handled = true; } };
        var d = _dlg;
        _dlgTask = d.ShowAsync();
        var r = await _dlgTask;
        LastDialogResult = r.ToString();
        _dlg = null;
    }

    public void CloseDialog() => _dlg?.Hide(FAContentDialogResult.None);

    public object DialogState()
    {
        var focus = TopLevel.GetTopLevel(_w)?.FocusManager?.GetFocusedElement() as Visual;
        var inside = _dlg is not null && focus is not null && (focus == _dlg || _dlg.IsVisualAncestorOf(focus) || _dlg.GetVisualDescendants().Contains(focus));
        return new { open = _dlg is not null, focusInsideDialog = inside, focused = MainWindow.Describe(focus), lastResult = LastDialogResult };
    }

    public object State() => new { theme = (string)_theme.SelectedItem!, dialog = DialogState() };
}
