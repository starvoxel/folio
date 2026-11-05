// ------------------------------
// App.axaml.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;

using Folio.Desktop.ViewModels;
using Folio.Desktop.Views;

namespace Folio.Desktop;

/// <summary>
/// The Avalonia application: loads styles and creates the main window.
/// </summary>
public partial class App : Application
{
    /// <summary>
    /// Loads the application's AXAML.
    /// </summary>
    public override void Initialize()
    {
        AvaloniaXamlLoader.Load(this);
    }

    /// <summary>
    /// Creates the main window once the framework is ready.
    /// </summary>
    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            desktop.MainWindow = new MainWindow
            {
                DataContext = new MainWindowViewModel(),
            };
        }

        base.OnFrameworkInitializationCompleted();
    }
}
