// ------------------------------
// Program.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

using Avalonia;

namespace Folio.Desktop;

/// <summary>
/// Application entry point.
/// </summary>
public static class Program
{
    /// <summary>
    /// Starts the desktop application. Avalonia is not ready until <c>AppMain</c> is called, so nothing
    /// that touches the UI may run before <see cref="BuildAvaloniaApp"/>.
    /// </summary>
    /// <param name="args">Command-line arguments.</param>
    [STAThread]
    public static void Main(string[] args)
    {
        BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    /// <summary>
    /// Builds the Avalonia application. Also used by the visual designer and headless tests.
    /// </summary>
    /// <returns>The configured application builder.</returns>
    public static AppBuilder BuildAvaloniaApp()
    {
        return AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .LogToTrace();
    }
}
