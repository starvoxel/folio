// ------------------------------
// FluentIsolationTests.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

namespace Folio.Desktop.Tests.Architecture;

/// <summary>
/// Guards AD-15: FluentAvalonia is used only under src/Folio.Desktop/UI/Fluent/, so the theme and its
/// controls can be replaced without touching screens.
/// </summary>
public class FluentIsolationTests
{
    private static readonly string[] FluentMarkers = ["FluentAvalonia", "using:FluentAvalonia"];

    [Fact]
    public void DesktopSources_OutsideUiFluent_DoNotReferenceFluentAvalonia()
    {
        string desktopRoot = Path.Combine(FindRepositoryRoot(), "src", "Folio.Desktop");
        string allowedRoot = Path.Combine(desktopRoot, "UI", "Fluent") + Path.DirectorySeparatorChar;

        List<string> offending = Directory
            .EnumerateFiles(desktopRoot, "*.*", SearchOption.AllDirectories)
            .Where(IsSourceFile)
            .Where(path => !path.StartsWith(allowedRoot, StringComparison.Ordinal))
            .Where(path => !IsBuildOutput(path, desktopRoot))
            .Where(ReferencesFluentAvalonia)
            .Select(path => Path.GetRelativePath(desktopRoot, path))
            .ToList();

        Assert.Empty(offending);
    }

    private static bool IsSourceFile(string path)
    {
        return path.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith(".axaml", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsBuildOutput(string path, string projectRoot)
    {
        string relative = Path.GetRelativePath(projectRoot, path);
        return relative.StartsWith("bin" + Path.DirectorySeparatorChar, StringComparison.Ordinal)
            || relative.StartsWith("obj" + Path.DirectorySeparatorChar, StringComparison.Ordinal);
    }

    private static bool ReferencesFluentAvalonia(string path)
    {
        string text = File.ReadAllText(path);
        return FluentMarkers.Any(marker => text.Contains(marker, StringComparison.Ordinal));
    }

    private static string FindRepositoryRoot()
    {
        DirectoryInfo? directory = new(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Folio.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Folio.slnx not found above the test output directory.");
    }
}
