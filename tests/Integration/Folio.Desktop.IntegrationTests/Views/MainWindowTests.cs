// ------------------------------
// MainWindowTests.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

using Avalonia.Controls;
using Avalonia.Headless.XUnit;

using Folio.Desktop.ViewModels;
using Folio.Desktop.Views;

namespace Folio.Desktop.IntegrationTests.Views;

/// <summary>
/// Smoke tests that the app, its theme and the main window load headlessly.
/// </summary>
public class MainWindowTests
{
    [AvaloniaFact]
    public void Show_ViewModelAsDataContext_BindsTitleText()
    {
        MainWindow window = new() { DataContext = new MainWindowViewModel() };

        window.Show();

        TextBlock? title = window.FindControl<TextBlock>("TitleText");
        Assert.NotNull(title);
        Assert.Equal("Folio", title.Text);
        Assert.Equal("Folio", window.Title);
    }

    [AvaloniaFact]
    public void TryFindResource_WinUITokenKeyAfterShow_ReturnsBrush()
    {
        MainWindow window = new() { DataContext = new MainWindowViewModel() };
        window.Show();

        bool found = window.TryFindResource("TextFillColorPrimaryBrush", window.ActualThemeVariant, out object? brush);

        Assert.True(found);
        Assert.NotNull(brush);
    }
}
