// ------------------------------
// MainWindowTests.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

using Avalonia.Controls;
using Avalonia.Headless.XUnit;

using MEFR.Desktop.ViewModels;
using MEFR.Desktop.Views;

namespace MEFR.Desktop.Tests.Views;

/// <summary>
/// Smoke tests that the app, its theme and the main window load headlessly.
/// </summary>
public class MainWindowTests
{
    [AvaloniaFact]
    public void Show_WithViewModel_BindsTitle()
    {
        MainWindow window = new() { DataContext = new MainWindowViewModel() };

        window.Show();

        TextBlock? title = window.FindControl<TextBlock>("TitleText");
        Assert.NotNull(title);
        Assert.Equal("Month-End Review", title.Text);
        Assert.Equal("Month-End Review", window.Title);
    }

    [AvaloniaFact]
    public void Theme_Loaded_ProvidesWinUITokenBrush()
    {
        MainWindow window = new() { DataContext = new MainWindowViewModel() };
        window.Show();

        bool found = window.TryFindResource("TextFillColorPrimaryBrush", window.ActualThemeVariant, out object? brush);

        Assert.True(found);
        Assert.NotNull(brush);
    }
}
