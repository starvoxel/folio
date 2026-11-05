// ------------------------------
// CoreAssemblyTests.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

namespace Folio.Core.UnitTests;

/// <summary>
/// Unit tests for <see cref="CoreAssembly"/>.
/// </summary>
public class CoreAssemblyTests
{
    [Fact]
    public void Name_DefaultState_ReturnsFolioCore()
    {
        Assert.Equal("Folio.Core", CoreAssembly.Name);
    }
}
