// ------------------------------
// TestNamingTests.cs
//
// Author: Starvoxel AI Agent - 2026-11-05
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

using System.Text.RegularExpressions;

namespace Folio.ValidationTests.Architecture;

/// <summary>
/// Guards the test naming convention. A test method is named <c>{Subject}_{Condition}_{ExpectedResult}</c>:
/// three PascalCase parts joined by underscores.
/// <list type="bullet">
/// <item><description>Subject: the member under test (<c>Parse</c>, <c>Show</c>), or for validation tests the artefact
/// being checked (<c>ReferencedAssemblies</c>, <c>SourceFiles</c>).</description></item>
/// <item><description>Condition: the input, state or scope, as a noun phrase (<c>EmptyInput</c>,
/// <c>ViewModelAsDataContext</c>, <c>CoreAssembly</c>); <c>DefaultState</c> when there is none.</description></item>
/// <item><description>ExpectedResult: what happens, as a present-tense verb phrase (<c>ReturnsEmptyResult</c>,
/// <c>ThrowsArgumentException</c>, <c>ExcludeUIFrameworks</c>).</description></item>
/// </list>
/// Test classes are named <c>{ClassUnderTest}Tests</c>, or <c>{Rule}Tests</c> for validation tests. This test checks
/// the three-part shape; review checks the wording.
/// </summary>
public partial class TestNamingTests
{
    [Fact]
    public void TestMethods_AllTestProjects_FollowThreePartName()
    {
        string testsRoot = Path.Combine(RepositoryRoot.Find(), "tests");
        List<string> problems = [];
        int testCount = 0;

        IEnumerable<string> sources = Directory
            .EnumerateFiles(testsRoot, "*.cs", SearchOption.AllDirectories)
            .Where(path => !IsBuildOutput(path));

        foreach (string path in sources)
        {
            string text = File.ReadAllText(path);
            foreach (Match match in TestMethodPattern().Matches(text))
            {
                testCount++;
                string name = match.Groups["name"].Value;
                if (!ThreePartNamePattern().IsMatch(name))
                {
                    problems.Add($"{Path.GetRelativePath(testsRoot, path)}: {name}");
                }
            }
        }

        Assert.True(testCount > 0, "No test methods found; the pattern may be out of date.");
        Assert.Empty(problems);
    }

    [GeneratedRegex(@"\[(?:Fact|Theory|AvaloniaFact|AvaloniaTheory)\b[^\]]*\]\s*(?:\[[^\]]*\]\s*)*public\s+(?:async\s+)?[\w<>]+\s+(?<name>\w+)\s*\(")]
    private static partial Regex TestMethodPattern();

    [GeneratedRegex(@"^[A-Z][A-Za-z0-9]*_[A-Z][A-Za-z0-9]*_[A-Z][A-Za-z0-9]*$")]
    private static partial Regex ThreePartNamePattern();

    private static bool IsBuildOutput(string path)
    {
        string separator = Path.DirectorySeparatorChar.ToString();
        return path.Contains($"{separator}bin{separator}", StringComparison.Ordinal)
            || path.Contains($"{separator}obj{separator}", StringComparison.Ordinal);
    }
}
