using global::FuncScript;
using FuncScript.Core;
using FuncScript.Error;
using FuncScript.Model;
using System;
using System.Collections.Generic;
using System.Linq;

namespace FuncScript.Package
{
    public static class PackageTestRunner
    {
        public static PackageTestResult TestPackage(IFsPackageResolver resolver, KeyValueCollection provider = null)
        {
            EnsureResolver(resolver);
            var testPairs = CollectPackageTestPairs(resolver, Array.Empty<string>(), new List<PackageTestPair>());
            if (testPairs.Count == 0)
            {
                return new PackageTestResult(Array.Empty<PackageTestEntry>(), new PackageTestSummary());
            }

            var evaluationProvider = PackageLoader.CreatePackageProvider(resolver, provider);
            var tests = new List<PackageTestEntry>();
            var summary = new PackageTestSummary();

            foreach (var pair in testPairs)
            {
                var scriptPath = pair.FolderPath.Concat(new[] { pair.ScriptName }).ToArray();
                var testPath = pair.FolderPath.Concat(new[] { pair.TestName }).ToArray();
                var expressionSource = PackageLoader.BuildExpression(resolver, scriptPath);
                var testExpressionSource = PackageLoader.BuildExpression(resolver, testPath);
                var runResult = FuncScriptTestRunner.Run(expressionSource, testExpressionSource, evaluationProvider);

                summary.Scripts += 1;
                summary.Suites += runResult.Summary.Suites;
                summary.Cases += runResult.Summary.Cases;
                summary.Passed += runResult.Summary.Passed;
                summary.Failed += runResult.Summary.Failed;

                tests.Add(new PackageTestEntry(FormatPath(scriptPath), FormatPath(testPath), runResult));
            }

            return new PackageTestResult(tests, summary);
        }

        private static List<PackageTestPair> CollectPackageTestPairs(
            IFsPackageResolver resolver,
            IReadOnlyList<string> path,
            List<PackageTestPair> accumulator)
        {
            var normalizedPath = path?.ToArray() ?? Array.Empty<string>();
            var childEntries = resolver.ListChildren(normalizedPath) ?? Array.Empty<PackageNodeDescriptor>();
            if (!childEntries.Any())
            {
                return accumulator;
            }

            var nameMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var entry in childEntries)
            {
                var name = entry.Name;
                if (string.IsNullOrWhiteSpace(name))
                {
                    throw new InvalidOperationException($"Package resolver returned invalid child entry under '{FormatPath(path)}'");
                }

                var lower = name.ToLowerInvariant();
                if (nameMap.ContainsKey(lower))
                {
                    throw new InvalidOperationException($"Duplicate entry '{name}' under '{FormatPath(path)}'");
                }

                nameMap[lower] = name;
            }

            foreach (var kvp in nameMap)
            {
                if (!kvp.Key.EndsWith(".test", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var baseLower = kvp.Key.Substring(0, kvp.Key.Length - 5);
                if (string.IsNullOrEmpty(baseLower) || !nameMap.ContainsKey(baseLower))
                {
                    continue;
                }

                accumulator.Add(new PackageTestPair(
                    normalizedPath.Select(segment => segment).ToArray(),
                    nameMap[baseLower],
                    kvp.Value));
            }

            foreach (var actualName in nameMap.Values)
            {
                var childPath = normalizedPath.Concat(new[] { actualName }).ToArray();
                var grandChildren = resolver.ListChildren(childPath) ?? Array.Empty<PackageNodeDescriptor>();
                if (!grandChildren.Any())
                {
                    continue;
                }

                var expression = resolver.GetExpression(childPath);
                if (expression != null)
                {
                    throw new InvalidOperationException($"Package resolver node '{FormatPath(childPath)}' cannot have both children and an expression");
                }

                CollectPackageTestPairs(resolver, childPath, accumulator);
            }

            return accumulator;
        }

        private static string FormatPath(IReadOnlyList<string> path)
        {
            if (path == null || path.Count == 0)
            {
                return "<root>";
            }

            return string.Join('/', path);
        }

        private static void EnsureResolver(IFsPackageResolver resolver)
        {
            if (resolver == null)
            {
                throw new ArgumentNullException(nameof(resolver));
            }
        }

        private sealed record PackageTestPair(string[] FolderPath, string ScriptName, string TestName);

        public sealed record PackageTestResult(IReadOnlyList<PackageTestEntry> Tests, PackageTestSummary Summary);

        public sealed record PackageTestSummary
        {
            public int Scripts { get; set; }
            public int Suites { get; set; }
            public int Cases { get; set; }
            public int Passed { get; set; }
            public int Failed { get; set; }

            public PackageTestSummary() { }
        }

        public sealed record PackageTestEntry(string Path, string TestPath, TestRunResult Result);

        public sealed record TestRunResult(IReadOnlyList<TestSuiteResult> Suites, TestRunSummary Summary);

        public sealed record TestRunSummary(int Suites, int Cases, int Passed, int Failed);

        public sealed record TestSuiteResult(string Id, string Name, SuiteSummary Summary, IReadOnlyList<PackageTestCaseResult> Cases);

        public sealed record SuiteSummary(int Total, int Passed, int Failed);

        public sealed record PackageTestCaseResult
        {
            public int Index { get; init; }
            public object Input { get; init; }
            public object ExpressionResult { get; set; }
            public object AssertionResult { get; set; }
            public bool Passed { get; set; }
            public PackageTestCaseError Error { get; set; }
        }

        public sealed record PackageTestCaseError(string Type, string Message, string Stack, object Details = null);

        private sealed class FuncScriptTestRunner
        {
            public static TestRunResult Run(string expression, string testExpression, KeyValueCollection provider)
            {
                var baseProvider = provider ?? new DefaultFsDataProvider();
                var expressionBlock = Parse(expression, baseProvider, "expression under test");
                var testBlock = Parse(testExpression, baseProvider, "test expression");

                var suitesValue = testBlock.Evaluate(baseProvider, new ExpressionBlock.DepthCounter());
                var suitesList = EnsureList(suitesValue, "Test expression must return a list of testSuit objects.");
                var suites = ExtractSuites(suitesList);

                var suiteResults = new List<TestSuiteResult>();
                var totalCases = 0;
                var totalPassed = 0;
                var totalFailed = 0;

                foreach (var suite in suites)
                {
                    var caseResults = new List<PackageTestCaseResult>();
                    var suitePassed = 0;
                    var suiteFailed = 0;

                    foreach (var caseDefinition in suite.Cases)
                    {
                        var result = RunCase(expressionBlock, baseProvider, suite, caseDefinition);
                        caseResults.Add(result);
                        if (result.Passed)
                        {
                            suitePassed += 1;
                            totalPassed += 1;
                        }
                        else
                        {
                            suiteFailed += 1;
                            totalFailed += 1;
                        }
                    }

                    totalCases += suite.Cases.Count;
                    suiteResults.Add(new TestSuiteResult(
                        suite.Id,
                        suite.Name,
                        new SuiteSummary(suite.Cases.Count, suitePassed, suiteFailed),
                        caseResults));
                }

                return new TestRunResult(
                    suiteResults,
                    new TestRunSummary(suiteResults.Count, totalCases, totalPassed, totalFailed));
            }

            private static ExpressionBlock Parse(string source, KeyValueCollection provider, string label)
            {
                var errors = new List<FuncScriptParser.SyntaxErrorData>();
                var block = FuncScriptParser.Parse(provider, source ?? string.Empty, errors);
                if (block == null)
                {
                    throw new SyntaxError(source ?? string.Empty, errors);
                }

                return block;
            }

            private static FsList EnsureList(object value, string message)
            {
                if (value is FsList list)
                {
                    return list;
                }

                throw new InvalidOperationException(message);
            }

            private static KeyValueCollection EnsureKeyValue(object value, string message)
            {
                if (value is KeyValueCollection collection)
                {
                    return collection;
                }

                throw new InvalidOperationException(message);
            }

            private static IFsFunction EnsureFunction(object value, string message)
            {
                if (value is IFsFunction function)
                {
                    return function;
                }

                throw new InvalidOperationException(message);
            }

            private static string CaseLabel(SuiteDefinition suite, CaseDefinition caseDefinition)
            {
                var suiteName = !string.IsNullOrWhiteSpace(suite.Name) ? suite.Name : suite.Id;
                return $"Case #{caseDefinition.Index} in suite \"{suiteName}\"";
            }

            private static List<SuiteDefinition> ExtractSuites(FsList rawSuites)
            {
                var suites = new List<SuiteDefinition>();
                var index = 0;

                foreach (var entry in rawSuites)
                {
                    index += 1;
                    var suiteCollection = EnsureKeyValue(entry, $"Test suite at index {index} must be an object.");
                    var suiteId = $"suite_{index}";
                    var nameValue = suiteCollection.Get("name");
                    var displayName = suiteId;
                    if (nameValue != null)
                    {
                        displayName = nameValue.ToString();
                        if (string.IsNullOrWhiteSpace(displayName))
                        {
                            displayName = suiteId;
                        }
                    }

                    var casesValue = suiteCollection.Get("cases");
                    if (casesValue == null)
                    {
                        throw new InvalidOperationException($"Test suite \"{displayName}\" must include a cases list.");
                    }

                    var caseList = EnsureList(casesValue, $"Suite \"{displayName}\" cases must be a list.");
                    var cases = new List<CaseDefinition>();
                    var caseIndex = 0;
                    foreach (var caseEntry in caseList)
                    {
                        caseIndex += 1;
                        var caseCollection = EnsureKeyValue(caseEntry, $"Case #{caseIndex} in suite \"{displayName}\" must be an object.");
                        cases.Add(new CaseDefinition(caseIndex, caseCollection));
                    }

                    var testValue = suiteCollection.Get("test");
                    var testsValue = suiteCollection.Get("tests");
                    IFsFunction singleTest = null;
                    List<TestFunctionEntry> multipleTests = null;

                    if (testValue != null)
                    {
                        singleTest = EnsureFunction(testValue, $"Suite \"{displayName}\" test must be a function.");
                    }
                    else if (testsValue != null)
                    {
                        multipleTests = ExtractTestList(testsValue, displayName);
                    }
                    else
                    {
                        throw new InvalidOperationException($"Test suite \"{displayName}\" is missing a test definition.");
                    }

                    suites.Add(new SuiteDefinition(suiteId, displayName, cases, singleTest, multipleTests));
                }

                return suites;
            }

            private static List<TestFunctionEntry> ExtractTestList(object testsValue, string suiteName)
            {
                var testList = EnsureList(testsValue, $"Suite \"{suiteName}\" tests must be a list.");
                var entries = new List<TestFunctionEntry>();
                var index = 0;
                foreach (var entry in testList)
                {
                    index += 1;
                    var function = EnsureFunction(entry, $"Test #{index} in suite \"{suiteName}\" must be a function.");
                    entries.Add(new TestFunctionEntry(function, index));
                }
                if (entries.Count == 0)
                {
                    throw new InvalidOperationException($"Suite \"{suiteName}\" tests list cannot be empty.");
                }
                return entries;
            }

            private static PackageTestCaseResult RunCase(
                ExpressionBlock expressionBlock,
                KeyValueCollection baseProvider,
                SuiteDefinition suite,
                CaseDefinition caseData)
            {
                var caseResult = new PackageTestCaseResult
                {
                    Index = caseData.Index,
                    Input = ConvertValue(caseData.Collection, new HashSet<KeyValueCollection>(), new HashSet<FsList>())
                };

                var ambientValue = caseData.Collection.Get("ambient");
                var providerCollection = caseData.Collection;
                if (ambientValue != null)
                {
                    providerCollection = EnsureKeyValue(ambientValue, $"{CaseLabel(suite, caseData)} ambient must be an object.");
                }

                var caseProvider = new KvcProvider(providerCollection, baseProvider);

                object expressionValue;
                try
                {
                    expressionValue = expressionBlock.Evaluate(caseProvider, new ExpressionBlock.DepthCounter());
                    if (expressionValue is IFsFunction function)
                    {
                        var inputValue = caseData.Collection.Get("input");
                        if (inputValue == null)
                        {
                            throw new InvalidOperationException($"{CaseLabel(suite, caseData)} must define an input list when testing a function expression.");
                        }

                        var inputList = EnsureList(inputValue, $"{CaseLabel(suite, caseData)} input must be a list.");
                        var args = inputList.ToArray();
                        expressionValue = InvokeFunction(function, caseProvider, args);
                    }

                    caseResult.ExpressionResult = ConvertValue(expressionValue, new HashSet<KeyValueCollection>(), new HashSet<FsList>());
                }
                catch (Exception ex)
                {
                    caseResult.Passed = false;
                    caseResult.Error = FormatCaseError("evaluation", ex);
                    return caseResult;
                }

                var argsForTest = new object[] { expressionValue, caseData.Collection };
                TestExecutionOutcome outcome;
                if (suite.SingleTest != null)
                {
                    outcome = RunSingleTest(suite.SingleTest, caseProvider, argsForTest);
                }
                else
                {
                    outcome = RunMultipleTests(suite.MultipleTests, caseProvider, argsForTest);
                }

                caseResult.AssertionResult = outcome.Details ?? outcome.PlainResult;
                if (outcome.Error != null)
                {
                    caseResult.Error = outcome.Error;
                    caseResult.Passed = false;
                    return caseResult;
                }

                caseResult.Passed = outcome.Passed;
                if (!outcome.Passed && outcome.Failure != null)
                {
                    caseResult.Error = outcome.Failure;
                }

                return caseResult;
            }

            private static TestExecutionOutcome RunSingleTest(IFsFunction testFn, KeyValueCollection provider, object[] args)
            {
                try
                {
                    var result = InvokeFunction(testFn, provider, args);
                    if (result is FsList fsList)
                    {
                        var details = new List<PackageTestDetail>();
                        var aggregateFailure = (PackageTestCaseError)null;
                        var passed = true;
                        var index = 0;
                        foreach (var entry in fsList)
                        {
                            index += 1;
                            var detailResult = entry;
                            var (childPassed, childFailure) = InterpretAssertionOutcome(detailResult);
                            var converted = ConvertValue(detailResult, new HashSet<KeyValueCollection>(), new HashSet<FsList>());
                            var detail = new PackageTestDetail
                            {
                                Index = index,
                                Passed = childPassed,
                                Result = converted,
                                Error = childFailure
                            };

                            if (!childPassed)
                            {
                                passed = false;
                                if (childFailure != null)
                                {
                                    aggregateFailure ??= childFailure;
                                }
                            }

                            details.Add(detail);
                        }

                        return new TestExecutionOutcome
                        {
                            Passed = passed,
                            Failure = aggregateFailure,
                            PlainResult = ConvertValue(fsList, new HashSet<KeyValueCollection>(), new HashSet<FsList>()),
                            Details = details
                        };
                    }

                    var (passedSingle, failure) = InterpretAssertionOutcome(result);
                    return new TestExecutionOutcome
                    {
                        Passed = passedSingle,
                        Failure = failure,
                        PlainResult = ConvertValue(result, new HashSet<KeyValueCollection>(), new HashSet<FsList>())
                    };
                }
                catch (Exception ex)
                {
                    return new TestExecutionOutcome
                    {
                        Passed = false,
                        Error = FormatCaseError("assertion", ex)
                    };
                }
            }

            private static TestExecutionOutcome RunMultipleTests(
                IReadOnlyList<TestFunctionEntry> testEntries,
                KeyValueCollection provider,
                object[] args)
            {
                var details = new List<PackageTestDetail>();
                foreach (var testEntry in testEntries)
                {
                    object result;
                    try
                    {
                        result = InvokeFunction(testEntry.Function, provider, args);
                    }
                    catch (Exception ex)
                    {
                        var errInfo = FormatCaseError("assertion", ex);
                        details.Add(new PackageTestDetail
                        {
                            Index = testEntry.Index,
                            Passed = false,
                            Result = null,
                            Error = errInfo
                        });
                        return new TestExecutionOutcome
                        {
                            Passed = false,
                            Error = errInfo,
                            Details = details
                        };
                    }

                    var converted = ConvertValue(result, new HashSet<KeyValueCollection>(), new HashSet<FsList>());
                    var (passed, failure) = InterpretAssertionOutcome(result);
                    var detail = new PackageTestDetail
                    {
                        Index = testEntry.Index,
                        Passed = passed,
                        Result = converted
                    };
                    if (!passed && failure != null)
                    {
                        detail.Error = failure;
                        details.Add(detail);
                        return new TestExecutionOutcome
                        {
                            Passed = false,
                            Failure = failure,
                            Details = details
                        };
                    }

                    details.Add(detail);
                }

                return new TestExecutionOutcome
                {
                    Passed = true,
                    Details = details
                };
            }

            private static (bool Passed, PackageTestCaseError Failure) InterpretAssertionOutcome(object value)
            {
                if (value is FsError fsError)
                {
                    return (false, new PackageTestCaseError(
                        "assertion",
                        fsError.ErrorMessage ?? string.Empty,
                        null,
                        ConvertErrorData(fsError.ErrorData, new HashSet<KeyValueCollection>(), new HashSet<FsList>())));
                }

                if (value is bool boolean)
                {
                    if (!boolean)
                    {
                        return (false, new PackageTestCaseError(
                            "assertion",
                            "Assertion returned false.",
                            null));
                    }
                }

                return (true, null);
            }

            private static object InvokeFunction(IFsFunction function, KeyValueCollection provider, object[] args)
            {
                var parameters = new ArrayFsList(args ?? Array.Empty<object>());
                return function.Evaluate(parameters);
            }

            private static PackageTestCaseError FormatCaseError(string type, Exception error)
            {
                if (error == null)
                {
                    return new PackageTestCaseError(type, string.Empty, null);
                }
                return new PackageTestCaseError(type, error.Message ?? string.Empty, error.StackTrace);
            }

            private static object ConvertValue(object value, HashSet<KeyValueCollection> seenKvcs, HashSet<FsList> seenLists)
            {
                if (value == null)
                {
                    return null;
                }

                if (value is FsError fsError)
                {
                    return new Dictionary<string, object>
                    {
                        ["errorType"] = fsError.ErrorType,
                        ["errorMessage"] = fsError.ErrorMessage,
                        ["errorData"] = ConvertErrorData(fsError.ErrorData, seenKvcs, seenLists)
                    };
                }

                if (value is FsList list)
                {
                    if (seenLists.Contains(list))
                    {
                        return "[Circular]";
                    }

                    seenLists.Add(list);
                    var result = new List<object>();
                    foreach (var item in list)
                    {
                        result.Add(ConvertValue(item, seenKvcs, seenLists));
                    }

                    seenLists.Remove(list);
                    return result;
                }

                if (value is KeyValueCollection collection)
                {
                    if (seenKvcs.Contains(collection))
                    {
                        return "[Circular]";
                    }

                    seenKvcs.Add(collection);
                    var result = new Dictionary<string, object>();
                    foreach (var kv in collection.GetAll())
                    {
                        result[kv.Key] = ConvertValue(kv.Value, seenKvcs, seenLists);
                    }

                    seenKvcs.Remove(collection);
                    return result;
                }

                if (value is IFsFunction)
                {
                    return "[Function]";
                }

                if (value is object[] arr)
                {
                    var result = new List<object>();
                    foreach (var item in arr)
                    {
                        result.Add(ConvertValue(item, seenKvcs, seenLists));
                    }

                    return result;
                }

                return value;
            }

            private static object ConvertErrorData(object data, HashSet<KeyValueCollection> seenKvcs, HashSet<FsList> seenLists)
            {
                if (data == null)
                {
                    return null;
                }

                if (data is object[] arr && arr.Length == 2 && arr[0] is int)
                {
                    try
                    {
                        return ConvertValue(arr, seenKvcs, seenLists);
                    }
                    catch
                    {
                        return new Dictionary<string, object> { ["error"] = "Failed to convert error data." };
                    }
                }

                return ConvertValue(data, seenKvcs, seenLists);
            }

            private sealed record SuiteDefinition(
                string Id,
                string Name,
                IReadOnlyList<CaseDefinition> Cases,
                IFsFunction SingleTest,
                IReadOnlyList<TestFunctionEntry> MultipleTests);

            private sealed record CaseDefinition(int Index, KeyValueCollection Collection);

            private sealed record TestFunctionEntry(IFsFunction Function, int Index);

            private sealed class TestExecutionOutcome
            {
                public bool Passed { get; set; }
                public PackageTestCaseError Failure { get; set; }
                public PackageTestCaseError Error { get; set; }
                public object PlainResult { get; set; }
                public object Details { get; set; }
            }

            private sealed class PackageTestDetail
            {
                public int Index { get; set; }
                public bool Passed { get; set; }
                public object Result { get; set; }
                public PackageTestCaseError Error { get; set; }
            }
        }
    }
}
