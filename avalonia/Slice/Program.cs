using System.Diagnostics;
using Avalonia;
using Avalonia.Headless;

namespace Slice;

public sealed class Options
{
    public string DataDir { get; set; } = "";
    public bool Automation { get; set; }
    public bool Headless { get; set; }
    public string? Theme { get; set; }
    public string? DiscoveryFile { get; set; }
    public bool A11yFix { get; set; }    // a11y fixes (see FOLLOWUP-RESULTS.md A1)
    public bool PlainNav { get; set; }   // a11y experiment: no FANavigationView
    public int Width { get; set; } = 1440;
    public int Height { get; set; } = 900;
}

public static class Program
{
    public static Store? Store;
    public static Options Options = new();
    public static AutomationServer? Automation;
    public static long ProcessStartedMs;
    public static double StartupMs = -1;

    [STAThread]
    public static int Main(string[] args)
    {
        ProcessStartedMs = (long)(DateTime.UtcNow - Process.GetCurrentProcess().StartTime.ToUniversalTime()).TotalMilliseconds;
        var o = Options;
        o.DataDir = Environment.GetEnvironmentVariable("FOLIO_DATA") ?? "";
        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--data": o.DataDir = args[++i]; break;
                case "--automation": o.Automation = true; break;
                case "--a11y-fix": o.A11yFix = true; break;
                case "--plain-nav": o.PlainNav = true; break;
                case "--headless": o.Headless = true; break;
                case "--theme": o.Theme = args[++i]; break;
                case "--discovery": o.DiscoveryFile = args[++i]; break;
                case "--size": var p = args[++i].Split('x'); o.Width = int.Parse(p[0]); o.Height = int.Parse(p[1]); break;
            }
        }
        if (o.DataDir == "") { Console.Error.WriteLine("Data folder required: --data <dir> or FOLIO_DATA"); return 2; }
        Store = new Store(o.DataDir);
        var b = AppBuilder.Configure<App>();
        if (o.Headless) b = b.UseHeadless(new AvaloniaHeadlessPlatformOptions { UseHeadlessDrawing = false }).UseSkia();
        else b = b.UsePlatformDetect();
        return b.StartWithClassicDesktopLifetime(args);
    }
}
