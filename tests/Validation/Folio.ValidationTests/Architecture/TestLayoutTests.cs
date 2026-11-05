// ------------------------------
// TestLayoutTests.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

using System.Xml.Linq;

namespace Folio.ValidationTests.Architecture;

/// <summary>
/// Guards the test layout: every test project sits under tests/{Kind}/, is named *.{Kind}Tests, and is
/// listed in tests/{Kind}.slnx and in Folio.slnx, so each kind of test can be run on its own.
/// </summary>
public class TestLayoutTests
{
    private static readonly string[] Kinds = ["Unit", "Integration", "Validation"];

    [Fact]
    public void TestProjects_UnderTestsFolder_FollowKindLayout()
    {
        string root = RepositoryRoot.Find();
        string testsRoot = Path.Combine(root, "tests");
        HashSet<string> solutionProjects = ReadSolutionProjects(Path.Combine(root, "Folio.slnx"), root);
        List<string> problems = [];

        List<string> testProjects = Directory
            .EnumerateFiles(testsRoot, "*.csproj", SearchOption.AllDirectories)
            .Where(path => !IsBuildOutput(path))
            .ToList();

        foreach (string project in testProjects)
        {
            string relative = Path.GetRelativePath(testsRoot, project);
            string kind = relative.Split(Path.DirectorySeparatorChar)[0];
            string name = Path.GetFileNameWithoutExtension(project);

            if (!Kinds.Contains(kind))
            {
                problems.Add($"{relative}: not under tests/Unit, tests/Integration or tests/Validation");
                continue;
            }

            if (!name.EndsWith($"{kind}Tests", StringComparison.Ordinal))
            {
                problems.Add($"{relative}: name must end with {kind}Tests");
            }

            HashSet<string> kindProjects = ReadSolutionProjects(Path.Combine(testsRoot, $"{kind}.slnx"), testsRoot);
            if (!kindProjects.Contains(Path.GetFullPath(project)))
            {
                problems.Add($"{relative}: missing from tests/{kind}.slnx");
            }

            if (!solutionProjects.Contains(Path.GetFullPath(project)))
            {
                problems.Add($"{relative}: missing from Folio.slnx");
            }
        }

        Assert.NotEmpty(testProjects);
        Assert.Empty(problems);
    }

    private static HashSet<string> ReadSolutionProjects(string solutionPath, string solutionDirectory)
    {
        if (!File.Exists(solutionPath))
        {
            return [];
        }

        XDocument solution = XDocument.Load(solutionPath);
        return solution
            .Descendants("Project")
            .Select(element => (string?)element.Attribute("Path") ?? string.Empty)
            .Select(path => Path.GetFullPath(Path.Combine(solutionDirectory, path.Replace('\\', Path.DirectorySeparatorChar))))
            .ToHashSet(StringComparer.Ordinal);
    }

    private static bool IsBuildOutput(string path)
    {
        string separator = Path.DirectorySeparatorChar.ToString();
        return path.Contains($"{separator}bin{separator}", StringComparison.Ordinal)
            || path.Contains($"{separator}obj{separator}", StringComparison.Ordinal);
    }
}
