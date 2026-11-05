// ------------------------------
// CoreDependencyTests.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

using System.Reflection;

namespace Folio.Core.Tests.Architecture;

/// <summary>
/// Guards AD-14: Folio.Core holds the domain and never depends on the UI.
/// </summary>
public class CoreDependencyTests
{
    private static readonly string[] ForbiddenPrefixes = ["Avalonia", "FluentAvalonia", "Folio.Desktop", "CommunityToolkit"];

    [Fact]
    public void CoreAssembly_ReferencedAssemblies_ExcludeUiFrameworks()
    {
        Assembly core = typeof(CoreAssembly).Assembly;

        List<string> offending = core.GetReferencedAssemblies()
            .Select(reference => reference.Name ?? string.Empty)
            .Where(name => ForbiddenPrefixes.Any(prefix => name.StartsWith(prefix, StringComparison.Ordinal)))
            .ToList();

        Assert.Empty(offending);
    }

    [Fact]
    public void Name_CoreAssembly_ReturnsFolioCore()
    {
        Assert.Equal("Folio.Core", CoreAssembly.Name);
    }
}
