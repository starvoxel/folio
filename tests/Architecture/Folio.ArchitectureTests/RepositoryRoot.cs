// ------------------------------
// RepositoryRoot.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

namespace Folio.ArchitectureTests;

/// <summary>
/// Locates the repository root from the test output directory.
/// </summary>
internal static class RepositoryRoot
{
    /// <summary>
    /// Finds the directory that contains <c>Folio.slnx</c>.
    /// </summary>
    /// <returns>The absolute path of the repository root.</returns>
    /// <exception cref="InvalidOperationException">Thrown when no ancestor directory contains Folio.slnx.</exception>
    public static string Find()
    {
        DirectoryInfo? directory = new(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "Folio.slnx")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Folio.slnx not found above the test output directory.");
    }
}
