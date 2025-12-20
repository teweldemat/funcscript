using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Esprima.Ast;
using FuncScript;
using FuncScript.Binding.JavaScript;
using FuncScript.Core;
using FuncScript.Error;
using FuncScript.Package;
using FuncScript.Model;
using NUnit.Framework;
using Newtonsoft.Json.Linq;

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

            var result = PackageLoader.LoadPackage(resolver).Evaluate();
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

            var result = PackageLoader.LoadPackage(resolver).Evaluate();
            Assert.That(result, Is.EqualTo(5));
        }

        [Test]
        public void LoadPackage_ReturnsLazyKvcAndDefersErrorsUntilAccess()
        {
            var resolver = new TestPackageResolver(new
            {
                x = "1+{", // intentionally malformed
                y = "2"
            });

            var result = PackageLoader.LoadPackage(resolver).Evaluate();
            Assert.That(result, Is.InstanceOf<KeyValueCollection>());

            var kvc = (KeyValueCollection)result;
            Assert.That(kvc.Get("y"), Is.EqualTo(2));
            var err=kvc.Get("x");
            Assert.That(err,Is.TypeOf<FsError>());
            var fserror=(FsError)err;
            Assert.That(fserror.ErrorType,Is.EqualTo(FsError.ERROR_SYNTAX_ERROR));
        }

        [Test]
        public void LoadPackage_TraceInvokedForEvalExpression()
        {
            var traces = new List<(string Path, Engine.TraceInfo Info)>();
            var resolver = new TestPackageResolver(new
            {
                x = "1+{", // intentionally malformed
                y = "2",
                eval = "y+1"
            });

            var result = PackageLoader.LoadPackage(resolver, trace: (path, info, entryState) =>
            {
                traces.Add((path, info));
            }).Evaluate();

            foreach (var trace in traces)
            {
                Console.WriteLine($"{trace.Path}: {trace.Info.ToString()} {trace.Info.Snippet}");
            }
            Assert.That(result, Is.Not.Null);
            Assert.That(traces, Is.Not.Empty);
            var theTrace = traces.FirstOrDefault(t => string.Equals(t.Info.Snippet, "y+1", StringComparison.Ordinal));
            Assert.That(theTrace.Info, Is.Not.Null);
            StringAssert.Contains("eval", theTrace.Path);
        }
        [Test]
        public void SiblingKeyOnlyReference()
        {
            var traces = new List<(string Path, Engine.TraceInfo Info)>();
            var resolver = new TestPackageResolver(new
            {
                theOne = "1", 
                theTwo = "2",
                eval = "{theOne,theTwo}"
            });

            var result = PackageLoader.LoadPackage(resolver, trace: (path, info, entryState) =>
            {
                traces.Add((path, info));
            }).Evaluate();

            var kvc=result as KeyValueCollection;
            Assert.NotNull(kvc);
            Assert.That(kvc.Get("theOne"), Is.EqualTo(1));
            Assert.That(kvc.Get("theTwo"), Is.EqualTo(2));
        }

        [Test]
        public void LoadPackage_TraceInvokedForLazyMemberEvaluation()
        {
            var traces = new List<(string Path, Engine.TraceInfo Info)>();
            var resolver = new TestPackageResolver(new
            {
                x = "1+{", // intentionally malformed
                y = "1+1"
            });

            var result = PackageLoader.LoadPackage(resolver, trace: (path, info, entryState) =>
            {
                traces.Add((path, info));
            }).Evaluate();

            Assert.That(result, Is.InstanceOf<KeyValueCollection>());
            Assert.That(traces, Is.Empty);

            var kvc = (KeyValueCollection)result;
            var yVal = kvc.Get("y");

            Assert.That(yVal, Is.EqualTo(2));
            Assert.That(traces, Is.Not.Empty);
            Assert.That(traces.All(t => t.Path == "y"));
            Assert.That(traces.Any(t => Equals(t.Info.Result, 2)));

            traces.Clear();
            var err=kvc.Get("x");
            Assert.That(err,Is.TypeOf<FsError>());
            var fserror=(FsError)err;
            Assert.That(fserror.ErrorType,Is.EqualTo(FsError.ERROR_SYNTAX_ERROR));
            Assert.That(traces, Is.Not.Empty);
        }

        [Test]
        public void LoadPackage_TraceDetailedPackageEvaluation()
        {
            var traces = new List<(string Path, Engine.TraceInfo Info)>();
            var resolver = new TestPackageResolver(new
            {
                x="math.abs(-2)",
                eval = "3+x"
            });

            var result = PackageLoader.LoadPackage(resolver, trace: (path, info, entryState) => { traces.Add((path, info)); }).Evaluate();

            
            foreach (var trace in traces)
            {
                Console.WriteLine($"{trace.Path} {trace.Info.ToString()} '{trace.Info.Snippet}' {FormatTraceValue(trace.Info.Result)}");
            }
            Assert.That(result, Is.InstanceOf<int>());
            Assert.That(traces.Count, Is.GreaterThanOrEqualTo(3));

            Assert.That(traces.Any(t => t.Path=="eval" && t.Info.Snippet == "3" && Equals(t.Info.Result, 3)));
            Assert.That(traces.Any(t => t.Path=="x" && t.Info.Snippet == "math.abs(-2)" && Equals(t.Info.Result, 2)));
            Assert.That(traces.Any(t => t.Path=="eval" && t.Path == "eval" && t.Info.Snippet == "3+x" && Equals(t.Info.Result, 5)));
        }
        
        [Test]
        public void LoadPackage_TraceDetailedPackageEvaluation_2()
        {
            var traces = new List<(string Path, Engine.TraceInfo Info)>();
            var resolver = new TestPackageResolver(new
            { 
                h=new
                {
                    f="math.abs(-2)"
                },
                eval = "3+h.f"
            });

            var result = PackageLoader.LoadPackage(resolver, trace: (path, info, entryState) => { traces.Add((path, info)); }).Evaluate();

            
            foreach (var trace in traces)
            {
                Console.WriteLine($"{trace.Path} {trace.Info.ToString()} '{trace.Info.Snippet}' {FormatTraceValue(trace.Info.Result)}");
            }
            Assert.That(result, Is.InstanceOf<int>());
            Assert.That(traces.Count, Is.GreaterThanOrEqualTo(3));

            Assert.That(traces.Any(t => t.Path=="eval" && t.Info.Snippet == "3" && Equals(t.Info.Result, 3)));
            Assert.That(traces.Any(t => t.Path=="h/f" && t.Info.Snippet == "math.abs(-2)" && Equals(t.Info.Result, 2)));
            Assert.That(traces.Any(t => t.Path=="eval"  && t.Info.Snippet == "3+h.f" && Equals(t.Info.Result, 5)));
        }
        [Test]
        public void LoadPackage_TraceDetailedPackageEvaluation_3()
        {
            var traces = new List<(string Path, Engine.TraceInfo Info)>();
            var resolver = new TestPackageResolver(new
            { 
                h=new
                {
                    f="x=>math.abs(x)"
                },
                eval = "3+h.f(-4)"
            });

            var result = PackageLoader.LoadPackage(resolver, trace: (path, info, entryState) => { traces.Add((path, info)); }).Evaluate();

            
            foreach (var trace in traces)
            {
                Console.WriteLine($"{trace.Path} {trace.Info.ToString()} '{trace.Info.Snippet}' {FormatTraceValue(trace.Info.Result)}");
            }
            Assert.That(result, Is.InstanceOf<int>());
            Assert.That(traces.Count, Is.GreaterThanOrEqualTo(3));

            Assert.That(traces.Any(t => t.Path=="eval" && t.Info.Snippet == "3" && Equals(t.Info.Result, 3)));
            Assert.That(traces.Any(t => t.Path=="h/f" && t.Info.Snippet == "math.abs(x)" && Equals(t.Info.Result, 4)));
            Assert.That(traces.Any(t => t.Path=="eval"  && t.Info.Snippet == "3+h.f(-4)" && Equals(t.Info.Result, 7)));
        }

        [Test]
        public void PackageMemberAccess_ResolvesFunctionsFromImportedPackage()
        {
            var lib = new TestPackageResolver(new
            {
                square = "x => x + 1"
            });
            var imports = new Dictionary<string, IFsPackageResolver>(StringComparer.OrdinalIgnoreCase)
            {
                ["lib"] = lib
            };

            var resolver = new TestPackageResolver(new
            {
                lib = "package(\"lib\")",
                squareFn = "lib.square",
                eval = "squareFn(3)"
            }, imports);

            var result = PackageLoader.LoadPackage(resolver).Evaluate();
            Assert.That(result, Is.Not.InstanceOf<FsError>(), "lib.square should resolve and evaluate");
            Assert.That(result, Is.EqualTo(4));
        }

        [Test]
        public void PackageMemberAccess_EvaluatesMathPiDivision()
        {
            var lib = new TestPackageResolver(new
            {
                bugexp = @"
{
  piOverTwo: math.Pi / 2;
  eval
  {
    angle: piOverTwo;
  };
}"
            });
            var imports = new Dictionary<string, IFsPackageResolver>(StringComparer.OrdinalIgnoreCase)
            {
                ["lib"] = lib
            };

            var resolver = new TestPackageResolver(new
            {
                eval = @"package(""lib"").bugexp.piOverTwo"
            }, imports);

            var result = PackageLoader.LoadPackage(resolver).Evaluate();

            Assert.That(result, Is.Null, "Expected hidden intermediate member to be null");
        }

        [Test]
        public void PackageMemberAccess_BindsFunctionOnLazyPackageValue()
        {
            var lib = new TestPackageResolver(new
            {
                square = "x => x + 1"
            });
            var imports = new Dictionary<string, IFsPackageResolver>(StringComparer.OrdinalIgnoreCase)
            {
                ["lib"] = lib
            };

            var resolver = new TestPackageResolver(new
            {
                lib = "package(\"lib\")",
                squareFn = "lib.square"
            }, imports);

            var package = PackageLoader.LoadPackage(resolver, new DefaultFsDataProvider(),(p, info, _) =>
            {
                Console.WriteLine("Exit :"+info.Snippet);
                if(info.Result is string or FsError or int)
                    Console.WriteLine("Value "+info.Result);
                else
                {
                    Console.WriteLine("Value "+info.Result.GetType());
                }

            },
            (p, info) =>
            {
                Console.WriteLine("Entry :"+info.Snippet);
                return null;
            }).Evaluate();
            Assert.That(package, Is.InstanceOf<KeyValueCollection>(), "Root package should be a KVC");

            var kvc = (KeyValueCollection)package;
            var squareFn = kvc.Get("squareFn");
            Assert.That(squareFn, Is.Not.InstanceOf<FsError>(), "squareFn should resolve without type mismatch");
            Assert.That(squareFn, Is.InstanceOf<IFsFunction>(), "squareFn should be callable");

            var func = (IFsFunction)squareFn;
            var callResult = func.Evaluate(new ArrayFsList(new []{3}));
            Assert.That(callResult, Is.EqualTo(4));
        }

        [Test]
        public void PackageMemberAccess_BindsFunctionOnLazyPackageValue_2()
        {
            var lib = new TestPackageResolver(new
            {
                f = "x =>math.sin(1)"
            });
            var imports = new Dictionary<string, IFsPackageResolver>(StringComparer.OrdinalIgnoreCase)
            {
                ["lib"] = lib
            };

            var resolver = new TestPackageResolver(new
            {
                lib = "package(\"lib\")",
                eval = "lib.f(0)"
            }, imports);

            var package = PackageLoader.LoadPackage(resolver, new DefaultFsDataProvider(),(p, info, _) =>
            {
                Console.WriteLine("Exit :"+info.Snippet);
                if(info.Result is string or FsError or int)
                    Console.WriteLine("Value "+info.Result);
                else
                {
                    Console.WriteLine("Value "+info.Result.GetType());
                }

            },
            (p, info) =>
            {
                Console.WriteLine("Entry :"+info.Snippet);
                return null;
            }).Evaluate();

            Assert.That(package,Is.EqualTo(Math.Sin(1)).Within(1e-6));
        }

        [Test]
        public void PackageMemberAccess_InlineCallInCompositeExpressionProducesValues()
        {
            var lib = new TestPackageResolver(new
            {
                square = @"
(center, sideLength)=>
{
  centerPoint:center ?? [0,0];
  size:sideLength ?? 2;
  eval
  {
    position:centerPoint;
    size:size;
  }
}"
            });
            var imports = new Dictionary<string, IFsPackageResolver>(StringComparer.OrdinalIgnoreCase)
            {
                ["lib"] = lib
            };

            var resolver = new TestPackageResolver(new
            {
                lib = "package(\"lib\")",
                square = "lib.square",
                eval = @"
{
  graphics:[
    lib.square([1,2], 3),
    square([4,5], 6)
  ]
}"
            }, imports);

            var root = PackageLoader.LoadPackage(resolver).Evaluate();
            Assert.That(root, Is.InstanceOf<KeyValueCollection>(), "Root package should be a KVC");

            var rootKvc = (KeyValueCollection)root;
            var graphics = rootKvc.Get("graphics");
            Assert.That(graphics, Is.InstanceOf<FsList>(), "graphics should be a list");

            var list = (FsList)graphics;
            Assert.That(list.Length, Is.EqualTo(2), "Both lib.square calls should succeed");
            Assert.That(list[0], Is.InstanceOf<KeyValueCollection>());
            Assert.That(list[1], Is.InstanceOf<KeyValueCollection>());
        }

        static string FormatTraceValue(object v)
        {
            if (v is KeyValueCollection)
                return "[kvc]";
            if (v is FsList)
                return "[list]";
            if(v is IFsFunction)
                return "[function]";
            if (v == null)
                return "[null]";
            return v.ToString();
        }
        
        [Test]
        public void LoadPackage_TraceDetailedPackageEvaluation_4()
        {
            var traces = new List<(string Path, Engine.TraceInfo Info)>();
            var resolver = new TestPackageResolver(new
            { 
                h=new
                {
                    f="error('err')",
                    g="5"
                },
                eval = "h.g+h.f"
            });

            var result = PackageLoader.LoadPackage(resolver, trace: (path, info, entryState) => { traces.Add((path, info)); }).Evaluate();


            foreach (var trace in traces)
            {
                Console.WriteLine($"{trace.Path} {trace.Info.ToString()} '{trace.Info.Snippet}' {FormatTraceValue(trace.Info.Result)}");
            }
            Assert.That(result, Is.InstanceOf<FsError>());

            Assert.That(traces.Any(t => t.Path?.Contains("eval", StringComparison.OrdinalIgnoreCase) == true
                                        && t.Info.Snippet?.Contains("h.g+h.f", StringComparison.Ordinal) == true));
            Assert.That(traces.Any(t => t.Path?.Contains("h/f", StringComparison.OrdinalIgnoreCase) == true
                                        && t.Info.Snippet?.Contains("error('err')", StringComparison.Ordinal) == true));
            Assert.That(traces.Any(t => t.Path?.Contains("h/g", StringComparison.OrdinalIgnoreCase) == true
                                        && t.Info.Snippet?.Contains("5", StringComparison.Ordinal) == true));
        }
        
        [Test]
        public void LoadPackage_TraceDetailedPackageEvaluation_5()
        {
            var traces = new List<(string Path, Engine.TraceInfo Info)>();
            var resolver = new TestPackageResolver(new
            { 
                h=new
                {
                    f_js="return z(5)",
                    g="5"
                },
                eval = "h.g+h.f"
            });

            var result = PackageLoader.LoadPackage(resolver, trace: (path, info, entryState) => { traces.Add((path, info)); }).Evaluate();


            foreach (var trace in traces)
            {
                Console.WriteLine($"{trace.Path} {trace.Info.ToString()} '{trace.Info.Snippet}' {FormatTraceValue(trace.Info.Result)}");
            }
            Assert.That(result, Is.InstanceOf<FsError>());

            Assert.That(traces.Any(t => t.Path?.Contains("eval", StringComparison.OrdinalIgnoreCase) == true
                                        && t.Info.Snippet?.Contains("h.g+h.f", StringComparison.Ordinal) == true));
            Assert.That(traces.Any(t => t.Path?.Contains("h/f", StringComparison.OrdinalIgnoreCase) == true
                                        && t.Info.Snippet?.Contains("return z(5)", StringComparison.Ordinal) == true));
            Assert.That(traces.Any(t => t.Path?.Contains("h/g", StringComparison.OrdinalIgnoreCase) == true
                                        && t.Info.Snippet?.Contains("5", StringComparison.Ordinal) == true));
        }
        
        [Test]
        public void LoadPackage_TraceDetailedPackageEvaluation_6()
        {
            var traces = new List<(string Path, Engine.TraceInfo Info)>();
            var resolver = new TestPackageResolver(new
            { 
                h = new
                {
                    f_js = @"return () => { throw new Error(""boom""); };"
                },
                eval = "2+h.f(1)"
            });

            var result = PackageLoader.LoadPackage(resolver, trace: (path, info, entryState) => { traces.Add((path, info)); }).Evaluate();


            foreach (var trace in traces)
            {
                Console.WriteLine($"{trace.Path} {trace.Info.ToString()} '{trace.Info.Snippet}' {FormatTraceValue(trace.Info.Result)}");
            }
            Assert.That(result, Is.InstanceOf<FsError>());

            var evalTrace = traces.FirstOrDefault(t => t.Path == "eval" && t.Info.Snippet == "h.f(1)");
            Assert.NotNull(evalTrace);
            var evalErr = evalTrace.Info.Result as FsError;
            Assert.NotNull(evalErr);
            Assert.That(evalErr.ErrorMessage.ToLowerInvariant().Contains("boom"));

            var funcTrace = traces.FirstOrDefault(t => t.Path == "h/f" && t.Info.Snippet.Contains("return () =>"));
            Assert.NotNull(funcTrace);
            Assert.That(funcTrace.Info.Result, Is.InstanceOf<IFsFunction>());
            Assert.That(funcTrace.Info.Result, Is.Not.InstanceOf<FsError>());
        }

        [Test]
        public void LoadPackage_EntryAndExitHooks()
        {
            var entries = new List<(string Path, string Snippet)>();
            var exits = new List<(string Path, string Snippet, object EntryState)>();
            var resolver = new TestPackageResolver(new
            {
                eval = "1+2"
            });

            var result = PackageLoader.LoadPackage(
                resolver,
                trace: (path, info, entryState) =>
                {
                    exits.Add((path, info.Snippet, entryState));
                },
                entryTrace: (path, info) =>
                {
                    var state = (path, info?.Snippet);
                    entries.Add(state);
                    return state;
                }).Evaluate();

            Assert.That(result, Is.EqualTo(3));
            Assert.That(entries, Is.Not.Empty);
            Assert.That(exits, Is.Not.Empty);
            Assert.That(exits.Any(e => e.Path == "eval" && e.EntryState is ValueTuple<string, string> entry && entry.Item1 == "eval"));
        }

        [Test]
        public void LoadPackage_HierarchicalTracingAcrossExpressions()
        {
            var stack = new Stack<TraceNode>();
            TraceNode root = new TraceNode();
            stack.Push(root);
            var resolver = new TestPackageResolver(new
            {
                left = "1+2",
                right = "left*3",
                eval = "left+right"
            });

            var result = PackageLoader.LoadPackage(
                resolver,
                trace: (path, info, entryState) =>
                {
                    var node = (TraceNode)entryState;
                    node.Result = info.Result;
                    stack.Pop();
                    Assert.That(stack,Is.Not.Empty);
                    stack.Peek().Children.Add(node);
                },
                entryTrace: (path, info) =>
                {
                    var node = new TraceNode { Path = path, Snippet = info?.Snippet ?? string.Empty };
                    stack.Push(node);
                    return node;
                }).Evaluate();
            
            stack.Pop();
            
            Assert.That(result, Is.EqualTo(12));
            Assert.That(stack.Count, Is.EqualTo(0), "trace stack should unwind");
            Assert.That(root, Is.Not.Null);
            Assert.That(root.Children.Count, Is.EqualTo(1));
            root = root.Children[0];

            var heirarchy = ToHierarchy(root);
            Console.WriteLine(
                Newtonsoft.Json.JsonConvert.SerializeObject(
                    heirarchy,
                    Newtonsoft.Json.Formatting.Indented
                )
            );
            
        }

        [Test]
        public void LoadPackage_HierarchicalTracingAcrossExpressions_2()
        {
            var stack = new Stack<TraceNode>();
            TraceNode root = new TraceNode();
            stack.Push(root);
            var resolver = new TestPackageResolver(new
            {
                left = "error('test')",
                right = "3",
                eval = "right+left"
            });

            var result = PackageLoader.LoadPackage(
                resolver,
                trace: (path, info, entryState) =>
                {
                    var node = (TraceNode)entryState;
                    node.Result = info.Result;
                    stack.Pop();
                    Assert.That(stack,Is.Not.Empty);
                    stack.Peek().Children.Add(node);
                },
                entryTrace: (path, info) =>
                {
                    var node = new TraceNode { Path = path, Snippet = info?.Snippet ?? string.Empty };
                    stack.Push(node);
                    return node;
                }).Evaluate();
            
            stack.Pop();
            
            Assert.That(result, Is.TypeOf<FsError>());
            Assert.That(stack.Count, Is.EqualTo(0), "trace stack should unwind");
            Assert.That(root, Is.Not.Null);
            Assert.That(root.Children.Count, Is.EqualTo(1));
            root = root.Children[0];
            var filtered = new List<TraceNode>();
            var rightNode=CollectByFilter(root,node=>node.Path=="right").FirstOrDefault();
            Assert.NotNull(rightNode);
            Assert.That(rightNode.Result, Is.EqualTo(3));
            
            var leftErrorNode=CollectByFilter(root,node=>node.Path=="left" && node.Result is FsError).FirstOrDefault();
            Assert.NotNull(leftErrorNode);
        }

        
        [Test]
        public void LoadPackage_HierarchicalTracingAcrossExpressions_3()
        {
            var stack = new Stack<TraceNode>();
            TraceNode root = new TraceNode();
            stack.Push(root);
            var resolver = new TestPackageResolver(new
            {
                constants = "{x:5}",
                eval = "3+constants.x"
            });

            var result = PackageLoader.LoadPackage(
                resolver,
                trace: (path, info, entryState) =>
                {
                    var node = (TraceNode)entryState;
                    node.Result = info.Result;
                    stack.Pop();
                    Assert.That(stack,Is.Not.Empty);
                    stack.Peek().Children.Add(node);
                },
                entryTrace: (path, info) =>
                {
                    var node = new TraceNode { Path = path, Snippet = info?.Snippet ?? string.Empty };
                    stack.Push(node);
                    return node;
                }).Evaluate();
            
            stack.Pop();
            
            Assert.That(result, Is.EqualTo(8));
            Assert.That(stack.Count, Is.EqualTo(0), "trace stack should unwind");
            Assert.That(root, Is.Not.Null);
            Assert.That(root.Children.Count, Is.EqualTo(1));
            var mainExp = root.Children[0];
            
            var tree = ToHierarchy(mainExp);
            Console.WriteLine(
                Newtonsoft.Json.JsonConvert.SerializeObject(
                    tree,
                    Newtonsoft.Json.Formatting.Indented
                )
            );

            var nodes=mainExp.Children.Where(node=>node.Path=="eval" && string.Equals(node.Snippet,"constants.x",StringComparison.Ordinal));
            Assert.That(nodes.Count(),Is.EqualTo(1));
            var node = nodes.First();
            Assert.That(node.Children.Count >= 2); //at least . function and parameter list
            var parList = node.Children[1];
            Assert.That( parList.Snippet,Is.EqualTo("constants.x")); 
        }

        [Test]
        public void LoadPackage_HierarchicalTracingAcrossExpressions_4()
        {
            var stack = new Stack<TraceNode>();
            var root = new TraceNode();
            stack.Push(root);
            var resolver = new TestPackageResolver(new
            {
                helpers = new
                {
                    z = "\"test\""
                },
                constants = "{ c1:12; c2:20; }",
                eval = "\"this is a \" + helpers.z+ f\"\\n{constants.c1}\""
            });

            var result = PackageLoader.LoadPackage(
                resolver,
                trace: (path, info, entryState) =>
                {
                    var node = (TraceNode)entryState;
                    node.Result = info.Result;
                    stack.Pop();
                    Assert.That(stack, Is.Not.Empty);
                    stack.Peek().Children.Add(node);
                },
                entryTrace: (path, info) =>
                {
                    var node = new TraceNode { Path = path, Snippet = info?.Snippet ?? string.Empty, Result = info?.Result };
                    stack.Push(node);
                    return node;
                }).Evaluate();

           

            stack.Pop();

            Assert.That(stack.Count, Is.EqualTo(0));
            var candidateTemplates = CollectByFilter(root, n => true);
            var templateNode = candidateTemplates.FirstOrDefault(n => n.Snippet != null && n.Snippet.Contains("constants.c1") && n.Result is string);
            Assert.That(templateNode, Is.Not.Null);
            StringAssert.Contains("12", templateNode.Result?.ToString());

            var helperNodes = CollectByFilter(root, n =>
                !string.IsNullOrEmpty(n.Snippet) &&
                (n.Snippet.Contains("_templatemerge") || n.Snippet.Contains("format")));
            Assert.That(helperNodes, Is.Not.Empty);
            Assert.That(helperNodes.All(n => n.Result is IFsFunction));
        }
        
        [Test]
        public void LoadPackage_HierarchicalTracingAcrossExpressions_5()
        {
            var stack = new Stack<TraceNode>();
            var root = new TraceNode();
            stack.Push(root);
            var resolver = new TestPackageResolver(new
            {
                f ="(x)=>Math.Round(x)",
                eval = "f(5.6)"
            });

            var result = PackageLoader.LoadPackage(
                resolver,
                trace: (path, info, entryState) =>
                {
                    var node = (TraceNode)entryState;
                    node.Result = info.Result;
                    stack.Pop();
                    Assert.That(stack, Is.Not.Empty);
                    stack.Peek().Children.Add(node);
                },
                entryTrace: (path, info) =>
                {
                    var node = new TraceNode { Path = path, Snippet = info?.Snippet ?? string.Empty, Result = info?.Result };
                    stack.Push(node);
                    return node;
                }).Evaluate();

           
            stack.Pop();
            Assert.That(stack.Count, Is.EqualTo(0));
            Assert.That(root.Children.Count,Is.EqualTo(1));
            var main = root.Children[0];
            var tree = ToHierarchy(main);
            Console.WriteLine(
                Newtonsoft.Json.JsonConvert.SerializeObject(
                    tree,
                    Newtonsoft.Json.Formatting.Indented
                )
            );

            var mathRound = CollectByFilter(main, n=>n.Path=="f" && n.Snippet=="Math.Round");
            Assert.NotNull(mathRound);
            
        }
        
        List<TraceNode> CollectByFilter(TraceNode node, Func<TraceNode, bool> filter,bool excludeRoot=false)
        {
            var res = new List<TraceNode>();
            CollectByFilter(node, res, filter,excludeRoot);
            return res;
        }
        void CollectByFilter(TraceNode node, List<TraceNode> res,Func<TraceNode,bool> filter,bool excludeRoot=false)
        {
            if(!excludeRoot)
            {
                if(filter(node))
                res.Add(node);
            }
            foreach (var n in node.Children)
            {
                CollectByFilter(n,res,filter,false);
            }
        }

        [Test]
        public void LoadPackage_TraceIncludesLineInfoForSyntaxErrors()
        {
            var traces = new List<(string Path, Engine.TraceInfo Info)>();
            var resolver = new TestPackageResolver(new
            {
                eval = "1+\n{"
            });

            var result = PackageLoader.LoadPackage(resolver, trace: (path, info, entryState) =>
            {
                traces.Add((path, info));
            }).Evaluate();

            Assert.That(result, Is.InstanceOf<FsError>());
            Assert.That(traces, Is.Not.Empty);
            Assert.That(traces.All(t => t.Path == "eval"));
            var info = traces[0].Info;
            Assert.That(info.Result, Is.InstanceOf<FsError>());
            Assert.That(info.StartLine, Is.EqualTo(1));
            Assert.That(info.EndLine, Is.EqualTo(2));
            Assert.That(info.Snippet, Does.Contain("1+"));
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

            var result = PackageLoader.LoadPackage(resolver).Evaluate();
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

            var result = PackageLoader.LoadPackage(resolver).Evaluate();
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
        public void TestPackage_CanTargetSpecificExpression()
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

            var result = PackageTestRunner.TestPackage(resolver, new[] { "total" });
            Assert.That(result.Summary.Scripts, Is.EqualTo(1));
            Assert.That(result.Summary.Failed, Is.EqualTo(0));
            Assert.That(result.Tests, Has.Count.EqualTo(1));
            Assert.That(result.Tests[0].Path, Is.EqualTo("total"));
            Assert.That(result.Tests[0].Result.Summary.Passed, Is.EqualTo(2));
        }

        [Test]
        public void TestPackage_CanTargetFolder()
        {
            var resolver = new TestPackageResolver(new
            {
                total = "a + b",
                total_test = """
{
  suite: {
    name: "root test";
    cases: [
      { a: 1, b: 2 }
    ];
    test: (res, data) => assert.equal(res, data.a + data.b);
  };

  eval [suite];
}
""",
                math = new
                {
                    eval = "a * factor",
                    eval_test = """
{
  suite: {
    name: "math eval";
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

            var result = PackageTestRunner.TestPackage(resolver, new[] { "math" });
            Assert.That(result.Summary.Scripts, Is.EqualTo(1));
            Assert.That(result.Summary.Failed, Is.EqualTo(0));
            Assert.That(result.Tests, Has.Count.EqualTo(1));
            Assert.That(result.Tests[0].Path, Is.EqualTo("math/eval"));
            Assert.That(result.Tests[0].Result.Summary.Passed, Is.EqualTo(2));
        }

        [Test]
        public void TestPackage_IgnoreUnreferencedExpression()
        {
            var resolver = new TestPackageResolver(new
            {
                total = "a + b",
                total_test = """
{
  suite: {
    name: "ignores unreferenced expressions";
    cases: [
      { a: 1, b: 2 },
      { a: -3, b: 5 }
    ];
    test: (res, data) => assert.equal(res, data.a + data.b);
  };

  eval [suite];
}
""",
                badMain = "{)",
                badTest_test = "{)"
            });

            var result = PackageTestRunner.TestPackage(resolver);
            Assert.That(result.Summary.Scripts, Is.EqualTo(1));
            Assert.That(result.Summary.Failed, Is.EqualTo(0));
            Assert.That(result.Tests, Has.Count.EqualTo(1));

            var totalTest = result.Tests.First(entry => entry.Path == "total");
            Assert.That(totalTest.Result.Summary.Passed, Is.EqualTo(2));
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

            var result = PackageLoader.LoadPackage(resolver).Evaluate();
            Assert.That(result, Is.TypeOf<double>());
            Assert.That((double)result, Is.EqualTo(42).Within(0.0001));
        }

        private sealed class TraceNode
        {
            public string Path;
            public string Snippet;
            public object Result;
            public List<TraceNode> Children { get; } = new();
        }

        private static Dictionary<string, object> ToHierarchy(TraceNode node)
        {
            return new Dictionary<string, object>
            {
                [$"{node.Path}:{node.Snippet}"] = node.Children.Select(ToHierarchy).Cast<object>().ToList()
            };
        }

        private static Dictionary<string, object> Tree(string label, params Dictionary<string, object>[] children)
        {
            return new Dictionary<string, object>
            {
                [label] = (children ?? Array.Empty<Dictionary<string, object>>()).Cast<object>().ToList()
            };
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
                    if (string.IsNullOrWhiteSpace(segment) ||
                        string.Equals(segment, ".", StringComparison.Ordinal) ||
                        segment.Contains(Path.DirectorySeparatorChar) ||
                        segment.Contains(Path.AltDirectorySeparatorChar))
                    {
                        return null;
                    }

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
