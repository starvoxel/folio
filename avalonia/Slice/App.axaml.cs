using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;

namespace Slice;

public sealed class App : Application
{
    public override void Initialize() => AvaloniaXamlLoader.Load(this);

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
