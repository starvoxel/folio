// ------------------------------
// CoreAssembly.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

namespace MEFR.Core;

/// <summary>
/// Marker type that identifies the MEFR.Core assembly for reflection and architecture tests.
/// </summary>
public static class CoreAssembly
{
    /// <summary>
    /// Gets the name of the Core assembly.
    /// </summary>
    public static string Name => typeof(CoreAssembly).Assembly.GetName().Name ?? "MEFR.Core";
}
