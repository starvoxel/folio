// ------------------------------
// TestAppBuilder.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

using Avalonia;
using Avalonia.Headless;

using Folio.Desktop.Tests;

[assembly: AvaloniaTestApplication(typeof(TestAppBuilder))]

namespace Folio.Desktop.Tests;

/// <summary>
/// Builds the real application on Avalonia's headless platform for UI tests.
/// </summary>
public static class TestAppBuilder
{
    /// <summary>
    /// Creates the headless application builder.
    /// </summary>
    /// <returns>The configured builder.</returns>
    public static AppBuilder BuildAvaloniaApp()
    {
        return AppBuilder.Configure<App>()
            .UseHeadless(new AvaloniaHeadlessPlatformOptions());
    }
}
