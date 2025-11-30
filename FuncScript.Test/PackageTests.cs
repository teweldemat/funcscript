using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using FuncScript;
using FuncScript.Binding.JavaScript;
using FuncScript.Package;
using FuncScript.Model;
using NUnit.Framework;

namespace FuncScript.Test
{
    [TestFixture]
    public class PackageTests
    {
        [Test]
        public void LoadPackage_ReturnsNestedValues()
        {
            var resolver = new TestPackageResolver(new
            {
                constants = new
                {
                    pi = "3.14",
                    tau = "pi * 2"
                },
                eval = "constants.tau"
            });

            var result = PackageLoader.LoadPackage(resolver);
            Assert.That(result, Is.TypeOf<double>());
            Assert.That((double)result, Is.EqualTo(6.28).Within(0.01));
        }
        [Test]
        public void LoadPackage_IgnoreUnreferencedExpression()
        {
            var resolver = new TestPackageResolver(new
            {
                toIgnore ="{)" ,
                eval = "5"
            });

            var result = PackageLoader.LoadPackage(resolver);
            Assert.That(result, Is.EqualTo(5));
        }

        [OneTimeSetUp]
        public void RegisterLanguageBindings()
        {
            Engine.LoadLanguageBindingsFromAssembly(typeof(JavaScriptLanguageBinding).Assembly);
        }

        [Test]
        public void LoadPackage_JavaScriptExpressionsSeePackageHelper()
        {
            var mathResolver = new TestPackageResolver(new
            {
                fortyTwo_js = new PackageExpressionDescriptor("return 41 + 1;", PackageLanguages.JavaScript),
                eval = "fortyTwo"
            });

            var imports = new Dictionary<string, IFsPackageResolver>(StringComparer.OrdinalIgnoreCase)
            {
                ["math"] = mathResolver
            };
            var resolver = new TestPackageResolver(new
            {
                total = @"package(""math"") + 8",
                eval = "total"
            }, imports);

            var result = PackageLoader.LoadPackage(resolver);
            Assert.That(result, Is.TypeOf<double>());
            Assert.That((double)result, Is.EqualTo(50).Within(0.01));
        }

        [Test]
        public void LoadPackage_RespectsHelperFoldersAndFunctions()
        {
            var resolver = new TestPackageResolver(new
            {
                helpers = new
                {
                    doubler = "(value)=>value * 2"
                },
                consumer = "helpers.doubler(21)",
                eval = "consumer"
            });

            var result = PackageLoader.LoadPackage(resolver);
            Assert.That(result, Is.TypeOf<int>());
            Assert.That((int)result, Is.EqualTo(42));
        }

        [Test]
        public void TestPackage_RunsMatchingScripts()
        {
            var resolver = new TestPackageResolver(new
            {
                total = "a + b",
                total_test = """
{
  suite: {
    name: "adds values";
    cases: [
      { a: 1, b: 2 },
      { a: -3, b: 5 }
    ];
    test: (res, data) => assert.equal(res, data.a + data.b);
  };

  eval [suite];
}
""",
                eval = "total",
                eval_test = """
{
  suite: {
    name: "exports total";
    cases: [
      { a: 2, b: 3 }
    ];
    test: (res) => assert.equal(res, 5);
  };

  eval [suite];
}
"""
            });

            var result = PackageTestRunner.TestPackage(resolver);
            Assert.That(result.Summary.Scripts, Is.EqualTo(2));
            Assert.That(result.Summary.Failed, Is.EqualTo(0));
            Assert.That(result.Tests, Has.Count.EqualTo(2));

            var totalTest = result.Tests.First(entry => entry.Path == "total");
            var evalTest = result.Tests.First(entry => entry.Path == "eval");
            Assert.That(totalTest.Result.Summary.Passed, Is.EqualTo(2));
            Assert.That(evalTest.Result.Summary.Passed, Is.EqualTo(1));
        }

        [Test]
        public void TestPackage_FuncScriptExpressionTestedByJavaScript()
        {
            var resolver = new TestPackageResolver(new
            {
                total = "a + b",
                total_test_js = """
const suite = {
  name: "js tests funcscript",
  cases: [
    { a: 5, b: 7 },
    { a: -2, b: 4 }
  ],
  test: (res, data) => assert.equal(res, data.a + data.b)
};
return [suite];
"""
            });

            var result = PackageTestRunner.TestPackage(resolver);
            if (result.Summary.Failed > 0)
            {
                foreach (var failure in result.Tests
                             .SelectMany(t => t.Result.Suites.SelectMany(suite =>
                                 suite.Cases.Where(c => !c.Passed).Select(c => new
                                 {
                                     Test = t.Path,
                                     Suite = suite.Name,
                                     Case = c.Index,
                                     Error = c.Error?.Message,
                                     Stack = c.Error?.Stack,
                                     Assertion = c.AssertionResult
                                 }))))
                {
                    TestContext.WriteLine(
                        $"Failure in {failure.Test}/{failure.Suite} case #{failure.Case}: {failure.Error ?? "no error"} | assertion={failure.Assertion} | stack={failure.Stack}");
                }
            }
            Assert.That(result.Summary.Scripts, Is.EqualTo(1));
            Assert.That(result.Summary.Failed, Is.EqualTo(0));
            Assert.That(result.Tests, Has.Count.EqualTo(1));

            var totalTest = result.Tests.First(entry => entry.Path == "total");
            Assert.That(totalTest.Result.Summary.Passed, Is.EqualTo(2));
        }

        [Test]
        public void TestPackage_JavaScriptExpressionTestedByFuncScript()
        {
            var resolver = new TestPackageResolver(new
            {
                total_js = "return a + b;",
                total_test = """
{
  suite: {
    name: "funcscript tests js";
    cases: [
      { a: 3, b: 4 },
      { a: -5, b: 6 }
    ];
    test: (res, data) => assert.equal(res, data.a + data.b);
  };

  eval [suite];
}
"""
            });

            var result = PackageTestRunner.TestPackage(resolver);
            if (result.Summary.Failed > 0)
            {
                foreach (var failure in result.Tests
                             .SelectMany(t => t.Result.Suites.SelectMany(suite =>
                                 suite.Cases.Where(c => !c.Passed).Select(c => new
                                 {
                                     Test = t.Path,
                                     Suite = suite.Name,
                                     Case = c.Index,
                                     Error = c.Error?.Message,
                                     Stack = c.Error?.Stack,
                                     Assertion = c.AssertionResult
                                 }))))
                {
                    TestContext.WriteLine(
                        $"Failure in {failure.Test}/{failure.Suite} case #{failure.Case}: {failure.Error ?? "no error"} | assertion={failure.Assertion} | stack={failure.Stack}");
                }
            }

            Assert.That(result.Summary.Scripts, Is.EqualTo(1));
            Assert.That(result.Summary.Failed, Is.EqualTo(0));
            Assert.That(result.Tests, Has.Count.EqualTo(1));

            var totalTest = result.Tests.First(entry => entry.Path == "total");
            Assert.That(totalTest.Result.Summary.Passed, Is.EqualTo(2));
        }

        [Test]
        public void TestPackage_FuncScriptFunctionTestedByFuncScript()
        {
            var resolver = new TestPackageResolver(new
            {
                multiplier = "(value)=> value * scale",
                multiplier_test = """
{
  suite: {
    name: "funcscript tests func";
    cases: [
      { ambient: { scale: 2 }, input: [3] },
      { ambient: { scale: 4 }, input: [5] }
    ];
    test: (res, data) => assert.equal(res, data.input[0] * data.ambient.scale);
  };

  eval [suite];
}
"""
            });

            var result = PackageTestRunner.TestPackage(resolver);
            Assert.That(result.Summary.Scripts, Is.EqualTo(1));
            Assert.That(result.Summary.Failed, Is.EqualTo(0));
            var multiplierTest = result.Tests.First(entry => entry.Path == "multiplier");
            Assert.That(multiplierTest.Result.Summary.Passed, Is.EqualTo(2));
        }

        [Test]
        public void TestPackage_FuncScriptFunctionTestedByJavaScript()
        {
            var resolver = new TestPackageResolver(new
            {
                multiplier = "(value)=> value * scale",
                multiplier_test_js = """
const suite = {
  name: "js tests func function";
  cases: [
    { ambient: { scale: 3 }, input: [4] },
    { ambient: { scale: -1 }, input: [7] }
  ];
  test: (res, data) => assert.equal(res, data.input[0] * data.ambient.scale);
};
return [suite];
"""
            });

            var result = PackageTestRunner.TestPackage(resolver);
            Assert.That(result.Summary.Scripts, Is.EqualTo(1));
            Assert.That(result.Summary.Failed, Is.EqualTo(0));
            var multiplierTest = result.Tests.First(entry => entry.Path == "multiplier");
            Assert.That(multiplierTest.Result.Summary.Passed, Is.EqualTo(2));
        }

        [Test]
        public void TestPackage_ModuleWithEvalJsTestedByFuncScript()
        {
            var resolver = new TestPackageResolver(new
            {
                math = new
                {
                    eval_js = "return a * factor;",
                    eval_test = """
{
  suite: {
    name: "funcscript tests module eval";
    cases: [
      { a: 2, factor: 3 },
      { a: -4, factor: 5 }
    ];
    test: (res, data) => assert.equal(res, data.a * data.factor);
  };

  eval [suite];
}
"""
                }
            });

            var result = PackageTestRunner.TestPackage(resolver);
            if (result.Summary.Failed > 0)
            {
                foreach (var failure in result.Tests
                             .SelectMany(t => t.Result.Suites.SelectMany(suite =>
                                 suite.Cases.Where(c => !c.Passed).Select(c => new
                                 {
                                     Test = t.Path,
                                     Suite = suite.Name,
                                     Case = c.Index,
                                     Error = c.Error?.Message,
                                     Stack = c.Error?.Stack,
                                     Assertion = c.AssertionResult
                                 }))))
                {
                    TestContext.WriteLine(
                        $"Failure in {failure.Test}/{failure.Suite} case #{failure.Case}: {failure.Error ?? "no error"} | assertion={failure.Assertion} | stack={failure.Stack}");
                }
            }

            Assert.That(result.Summary.Scripts, Is.EqualTo(1));
            Assert.That(result.Summary.Failed, Is.EqualTo(0));
            var evalTest = result.Tests.First(entry => entry.Path == "math/eval");
            Assert.That(evalTest.Result.Summary.Passed, Is.EqualTo(2));
        }

        [Test]
        public void LoadPackage_InjectsHelpersIntoNestedJavaScript()
        {
            var resolver = new TestPackageResolver(new
            {
                cartoon = new
                {
                    helpers = new
                    {
                        toPoint_js = """
return function toPoint(value) {
  if (Array.isArray(value) && value.length >= 2) {
    return value;
  }
  if (value && typeof value === 'object') {
    if ('x' in value || 'y' in value) {
      return [Number(value.x) || 0, Number(value.y) || 0];
    }
  }
  return [0, 0];
};
""",
                        marker = "21"
                    },
                    stickman = new
                    {
                        leg_js = """
if (!helpers || typeof helpers.toPoint !== 'function') {
  throw new Error('helpers.toPoint missing');
}
const coord = helpers.toPoint({ x: helpers.marker, y: 0 });
return coord[0] * 2;
"""
                    }
                },
                eval = "cartoon.stickman.leg"
            });

            var result = PackageLoader.LoadPackage(resolver);
            Assert.That(result, Is.TypeOf<double>());
            Assert.That((double)result, Is.EqualTo(42).Within(0.0001));
        }

        private sealed class TestPackageResolver : IFsPackageResolver
        {
            private readonly IReadOnlyDictionary<string, IFsPackageResolver> _imports;

            public TestPackageResolver(object data = null, IReadOnlyDictionary<string, IFsPackageResolver> imports = null)
            {
                _imports = imports ?? new Dictionary<string, IFsPackageResolver>(StringComparer.OrdinalIgnoreCase);
                if (data != null)
                {
                    PopulateFromObject(Root, data);
                }
            }

            public Node Root { get; } = new Node("<root>");

            public IEnumerable<PackageNodeDescriptor> ListChildren(IReadOnlyList<string> path)
            {
                var node = Resolve(path);
                if (node == null)
                {
                    return Array.Empty<PackageNodeDescriptor>();
                }

                return node.Children.Values.Select(child => new PackageNodeDescriptor(child.Name));
            }

            public PackageExpressionDescriptor? GetExpression(IReadOnlyList<string> path)
            {
                return Resolve(path)?.Expression;
            }

            public IFsPackageResolver Package(string name)
            {
                if (name == null)
                {
                    return null;
                }

                _imports.TryGetValue(name, out var resolver);
                return resolver;
            }

            private Node Resolve(IReadOnlyList<string> path)
            {
                var node = Root;
                foreach (var segment in path ?? Array.Empty<string>())
                {
                    if (!node.Children.TryGetValue(segment, out var child))
                    {
                        return null;
                    }

                    node = child;
                }

                return node;
            }

            public sealed class Node
            {
                public Node(string name)
                {
                    Name = name;
                }

                public string Name { get; }
                public PackageExpressionDescriptor? Expression { get; private set; }
                public Dictionary<string, Node> Children { get; } = new(StringComparer.OrdinalIgnoreCase);

                public Node SetExpression(string expression, string language = null)
                {
                    Expression = new PackageExpressionDescriptor(expression, language);
                    return this;
                }
            }

            private void PopulateFromObject(Node node, object data)
            {
                if (node == null || data == null)
                {
                    return;
                }

                if (data is PackageExpressionDescriptor descriptor)
                {
                    node.SetExpression(descriptor.Expression, descriptor.Language);
                    return;
                }

                if (data is string text)
                {
                    node.SetExpression(text);
                    return;
                }

                if (data is IEnumerable<KeyValuePair<string, object>> entries)
                {
                    foreach (var entry in entries)
                    {
                        var (childName, languageHint) = NormalizeName(entry.Key);
                        PopulateChild(node, childName, entry.Value, languageHint);
                    }

                    return;
                }

                var type = data.GetType();
                var properties = type
                    .GetProperties(BindingFlags.Instance | BindingFlags.Public)
                    .Where(prop => prop.GetIndexParameters().Length == 0)
                    .ToArray();

                if (properties.Length == 0)
                {
                    node.SetExpression(data.ToString());
                    return;
                }

                foreach (var property in properties)
                {
                    var value = property.GetValue(data);
                    var (childName, languageHint) = NormalizeName(property.Name);
                    PopulateChild(node, childName, value, languageHint);
                }
            }

            private void PopulateChild(Node parent, string name, object data, string languageHint = null)
            {
                if (string.IsNullOrWhiteSpace(name))
                {
                    return;
                }

                var child = new Node(name);
                parent.Children[name] = child;

                if (languageHint != null && data is string script)
                {
                    child.SetExpression(script, languageHint);
                    return;
                }

                PopulateFromObject(child, data);
            }

            private static (string Name, string Language) NormalizeName(string rawName)
            {
                if (string.IsNullOrWhiteSpace(rawName))
                {
                    return (rawName ?? string.Empty, null);
                }

                const string TestJsSuffix = "_test_js";
                const string TestSuffix = "_test";
                const string JsSuffix = "_js";

                if (rawName.EndsWith(TestJsSuffix, StringComparison.OrdinalIgnoreCase))
                {
                    var baseName = rawName[..^TestJsSuffix.Length];
                    return (baseName + ".test", PackageLanguages.JavaScript);
                }

                if (rawName.EndsWith(TestSuffix, StringComparison.OrdinalIgnoreCase))
                {
                    var baseName = rawName[..^TestSuffix.Length];
                    return (baseName + ".test", PackageLanguages.FuncScript);
                }

                if (rawName.EndsWith(JsSuffix, StringComparison.OrdinalIgnoreCase))
                {
                    var baseName = rawName[..^JsSuffix.Length];
                    return (baseName, PackageLanguages.JavaScript);
                }

                return (rawName, PackageLanguages.FuncScript);
            }
        }
    }
}
