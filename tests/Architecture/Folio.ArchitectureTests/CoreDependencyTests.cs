// ------------------------------
// CoreDependencyTests.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

using System.Reflection;

namespace Folio.ArchitectureTests;

/// <summary>
/// Guards AD-14: Folio.Core holds the domain and never depends on the UI.
/// </summary>
public class CoreDependencyTests
{
    private static readonly string[] ForbiddenPrefixes = ["Avalonia", "FluentAvalonia", "Folio.Desktop", "CommunityToolkit"];

    [Fact]
    public void ReferencedAssemblies_CoreAssembly_ExcludeUIFrameworks()
    {
        Assembly core = typeof(Folio.Core.CoreAssembly).Assembly;

        List<string> offending = core.GetReferencedAssemblies()
            .Select(reference => reference.Name ?? string.Empty)
            .Where(name => ForbiddenPrefixes.Any(prefix => name.StartsWith(prefix, StringComparison.Ordinal)))
            .ToList();

        Assert.Empty(offending);
    }
}
