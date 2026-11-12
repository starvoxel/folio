using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;

namespace Slice;

public sealed class App : Application
{
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
        // The DataGrid theme is included from code so the same source builds against the stock package and ProDataGrid (which names its theme .v2).
#if PRODATAGRID
        const string theme = "avares://Avalonia.Controls.DataGrid/Themes/Fluent.v2.xaml";
#else
        const string theme = "avares://Avalonia.Controls.DataGrid/Themes/Fluent.xaml";
#endif
        Styles.Insert(1, new Avalonia.Markup.Xaml.Styling.StyleInclude(new Uri("avares://FolioSlice/")) { Source = new Uri(theme) });
    }

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime d)
        {
            var w = new MainWindow(Program.Store!, Program.Options);
            d.MainWindow = w;
            if (Program.Options.Automation) Program.Automation = new AutomationServer(w, Program.Options);
        }
        base.OnFrameworkInitializationCompleted();
    }
}
