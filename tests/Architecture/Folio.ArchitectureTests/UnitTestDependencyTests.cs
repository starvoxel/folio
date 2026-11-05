// ------------------------------
// UnitTestDependencyTests.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

using System.Xml.Linq;

namespace Folio.ArchitectureTests;

/// <summary>
/// Guards the unit-test boundary: unit tests run in one process with no UI platform, so a unit-test project may not
/// reference Avalonia, FluentAvalonia or the desktop project. The "no real file system or network" half of the rule
/// is checked in review.
/// </summary>
public class UnitTestDependencyTests
{
    private static readonly string[] ForbiddenPackagePrefixes = ["Avalonia", "FluentAvalonia"];
    private static readonly string[] ForbiddenProjects = ["Folio.Desktop.csproj"];

    [Fact]
    public void ProjectReferences_UnitTestProjects_ExcludeUIPlatform()
    {
        string unitRoot = Path.Combine(RepositoryRoot.Find(), "tests", "Unit");
        List<string> problems = [];

        List<string> projects = Directory
            .EnumerateFiles(unitRoot, "*.csproj", SearchOption.AllDirectories)
            .ToList();

        foreach (string project in projects)
        {
            XDocument document = XDocument.Load(project);
            string name = Path.GetFileName(project);

            IEnumerable<string> packages = document
                .Descendants("PackageReference")
                .Select(element => (string?)element.Attribute("Include") ?? string.Empty)
                .Where(include => ForbiddenPackagePrefixes.Any(prefix => include.StartsWith(prefix, StringComparison.Ordinal)));

            IEnumerable<string> projectReferences = document
                .Descendants("ProjectReference")
                .Select(element => (string?)element.Attribute("Include") ?? string.Empty)
                .Where(include => ForbiddenProjects.Any(forbidden => include.Replace('\\', '/').EndsWith(forbidden, StringComparison.Ordinal)));

            problems.AddRange(packages.Select(package => $"{name}: references package {package}"));
            problems.AddRange(projectReferences.Select(reference => $"{name}: references {reference}"));
        }

        Assert.NotEmpty(projects);
        Assert.Empty(problems);
    }
}
