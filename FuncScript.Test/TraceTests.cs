using FuncScript.Core;
using NUnit.Framework;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using FuncScript.Model;
using Newtonsoft.Json.Linq;

namespace FuncScript.Test
{
    public class TraceTests
    {
        [Test]
        public void TraceInvokesHookWithFinalResult()
        {
            var hookCalls = 0;
            var sawFinalResult = false;

            var (result, log) = TraceWithOutput("1+2", value =>
            {
                hookCalls++;
                if (Equals(value, 3))
                    sawFinalResult = true;
            });

            Assert.That(result, Is.EqualTo(3));
            Assert.That(hookCalls, Is.GreaterThan(0));
            Assert.That(sawFinalResult, Is.True);
            StringAssert.Contains("Evaluating", log);
        }

        [Test]
        public void TraceLogsLocationAndSnippet()
        {
            var (result, log) = TraceWithOutput("1+2");

            Assert.That(result, Is.EqualTo(3));
            StringAssert.Contains("Evaluating 1:", log);
            StringAssert.Contains("1+2", log);
        }

        [Test]
        public void TraceHandlesMultiLineExpressions()
        {
            var expression = "1+\n2";
            var (result, log) = TraceWithOutput(expression);

            Assert.That(result, Is.EqualTo(3));
            StringAssert.Contains("-2:", log);
            StringAssert.Contains("1+\n2", log);
        }

        [Test]
        public void TraceWithHookReceivesLocationData()
        {
            var infos = new List<Engine.TraceInfo>();
            var log = CaptureConsole(() =>
            {
                FuncScriptRuntime.Trace("1+2", (trace, infoObj, entryState) =>
                {
                    Assert.That(trace, Is.Not.Null);
                    infos.Add((Engine.TraceInfo)infoObj);
                });
            });

            foreach (var info in infos)
            {
                Console.WriteLine(info.Snippet);    
            }

            
            Assert.That(log, Is.Empty);
            Assert.That(infos, Is.Not.Empty);
            var last = infos[^1];
            Assert.That(last.Result, Is.EqualTo(3));
            Assert.That(last.Snippet, Does.Contain("1+2"));
            Assert.That(last.StartLine, Is.EqualTo(1));
            Assert.That(last.StartColumn, Is.GreaterThanOrEqualTo(1));
        }

        [Test]
        public void TraceReportsInclusiveEndIndex()
        {
            Engine.TraceInfo last = null;
            FuncScriptRuntime.Trace("1+2", (result, info, entryState) =>
            {
                if (Equals(result, 3))
                    last = info;
            });

            Assert.That(last, Is.Not.Null);
            Assert.That(last.StartIndex, Is.EqualTo(0));
            Assert.That(last.EndIndex, Is.EqualTo(2));
        }
        [Test]
        public void TraceWithHookReceivesLocationDataForError()
        {
            var errMsg = "the error";
            var infos = new List<Engine.TraceInfo>();
            FuncScriptRuntime.Trace($"1+error('{errMsg}')", (trace, infoObj, entryState) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
            });

            Assert.That(infos, Is.Not.Empty);
            var last = infos[^1];
            Assert.That(last.Result, Is.TypeOf<FsError>());
            var e = (FsError)last.Result;
            Assert.That(e.ErrorMessage, Is.EqualTo(errMsg));

        }
        [Test]
        public void TraceWithHookReceivesLocationDataForException()
        {
            var infos = new List<Engine.TraceInfo>();
            var  errMsg = "The error";
            var kvc=new ObjectKvc(new
            {
                f=new Func<object,object>((x)=>throw new Exception(errMsg))
            });
            var p = new KvcProvider(kvc, new DefaultFsDataProvider());
            FuncScriptRuntime.Trace("2+f(3)",p,(trace, infoObj, entryState) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
            });

            var last = infos[^1];
            Assert.That(last.Result, Is.TypeOf<FsError>());
            var e = (FsError)last.Result;
            Assert.That(e.ErrorMessage, Is.EqualTo(errMsg));
        }

        private static (object result, string log) TraceWithOutput(string expression, Action<object> hook = null)
        {
            var originalOut = Console.Out;
            var writer = new StringWriter();
            try
            {
                Console.SetOut(writer);
                var result = FuncScriptRuntime.Trace(expression, hook);
                return (result, writer.ToString());
            }
            finally
            {
                Console.SetOut(originalOut);
            }
        }

        private static string CaptureConsole(Action action)
        {
            var originalOut = Console.Out;
            var writer = new StringWriter();
            try
            {
                Console.SetOut(writer);
                action();
                return writer.ToString();
            }
            finally
            {
                Console.SetOut(originalOut);
            }
        }
        
        
        [Test]
        public void TraceNumberOfEvaluations_1()
        {
            var infos = new List<Engine.TraceInfo>();
            
            FuncScriptRuntime.Trace("1+2",(trace, infoObj, entryState) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
            });
            Assert.That(infos, Is.Not.Empty);
            Assert.That(infos.Any(i => string.Equals(i.Snippet, "1+2", StringComparison.Ordinal)));
            
        }
        [Test]
        public void TraceNumberOfEvaluations_2()
        {
            var infos = new List<Engine.TraceInfo>();
            
            FuncScriptRuntime.Trace("math.round(2)",(trace, infoObj, entryState) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
            });
            Assert.That(infos, Is.Not.Empty);
            Assert.That(infos.Any(i => i.Snippet?.Contains("math.round", StringComparison.OrdinalIgnoreCase) == true));
            Assert.That(infos.Any(i => string.Equals(i.Snippet, "2", StringComparison.Ordinal)));
            
        }
        
        [Test]
        public void TraceNumberOfEvaluations_3()
        {
            var infos = new List<Engine.TraceInfo>();
            var kvc=new ObjectKvc(new
            {
                f=new Func<object,object>((x)=>x)
            });
            var p = new KvcProvider(kvc, new DefaultFsDataProvider());
            FuncScriptRuntime.Trace("f(3)",p,(trace, infoObj, entryState) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
            });
            Assert.That(infos, Is.Not.Empty);
            Assert.That(infos.Any(i => string.Equals(i.Snippet, "f(3)", StringComparison.Ordinal)));
        }
        
        [Test]
        public void TraceNumberOfEvaluations_4()
        {
            var infos = new List<Engine.TraceInfo>();
            var  errMsg = "The error";
            var kvc=new ObjectKvc(new
            {
                f=new Func<object,object>((x)=>throw new Exception(errMsg))
            });
            var p = new KvcProvider(kvc, new DefaultFsDataProvider());
            FuncScriptRuntime.Trace("2+f(3)",p,(trace, infoObj, entryState) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
            });
            Assert.That(infos, Is.Not.Empty);
            Assert.That(infos.Any(i => string.Equals(i.Snippet, "2+f(3)", StringComparison.Ordinal)));
        }
        [Test]
        public void TracerListKvc_1()
        {
            var infos = new List<Engine.TraceInfo>();
            var p = new DefaultFsDataProvider();
            var res=FuncScriptRuntime.Trace("[1,2]",p,(trace, infoObj, entryState) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
                Console.WriteLine($"{infoObj.ToString()} {infoObj.Snippet}");
            });
            
            Assert.That(infos.Count,Is.EqualTo(1));
            Assert.That(infos[0].Snippet,Is.EqualTo("[1,2]"));
            infos.Clear();//populate with late list evaluation
            var str = Engine.FormatToJson(res);
            Assert.That(infos.Count,Is.GreaterThanOrEqualTo(2));
            Assert.That(infos.Any(i => string.Equals(i.Snippet, "1", StringComparison.Ordinal)));
            Assert.That(infos.Any(i => string.Equals(i.Snippet, "2", StringComparison.Ordinal)));

        }
        [Test]
        public void TracerListKvc_2()
        {
            var infos = new List<Engine.TraceInfo>();
            var p = new DefaultFsDataProvider();
            Console.WriteLine("phase 1");
            var res=FuncScriptRuntime.Trace("{x:5,eval [x,2]}",p,(trace, infoObj, entryState) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
                Console.WriteLine($"{infoObj.ToString()} {infoObj.Snippet}");
            });
            Console.WriteLine("phase 2");
            var str = Engine.FormatToJson(res);
        }

        [Test]
        public void TraceEntryHookBuildsEvaluationTree_1()
        {
            var stack = new Stack<EvalNode>();
            EvalNode root = new EvalNode();

            Func<Engine.TraceInfo, object> entryHook = info =>
            {
                var node = new EvalNode { Snippet = info.Snippet };
                stack.Push(node);
                return node;
            };
            stack.Push(root);
            FuncScriptRuntime.Trace("3+4", (result, info, entryState) =>
            {
                var node = (EvalNode)entryState;
                node.Result = result;
                stack.Pop();
                stack.Peek().Children.Add(node);
            }, entryHook);
            stack.Pop();
            Assert.That(stack.Count, Is.EqualTo(0), "stack should be empty after trace exits");
            Assert.That(root, Is.Not.Null);
            Assert.That(root.Children, Has.Count.EqualTo(1));
            root = root.Children[0];
            Assert.That(root.Snippet, Does.Contain("3+4"));

            var actualHierarchy = ToHierarchy(root);
            Console.WriteLine(
                Newtonsoft.Json.JsonConvert.SerializeObject(
                    actualHierarchy,
                    Newtonsoft.Json.Formatting.Indented
                )
            );
            var expectedHierarchy = Tree("3+4",
                Tree("+"),
                    Tree("3+4"),    //parameter list don't evaluate children because of list lazy evaluation
                    Tree("3"),//evaluation of + function forces evaluation of list elements
                    Tree("4")
                );

            Assert.That(
                JToken.DeepEquals(JToken.FromObject(actualHierarchy), JToken.FromObject(expectedHierarchy)),
                Is.True,
                "Trace hierarchy does not match expected structure");
        }
        
        [Test]
        public void TraceEntryHookBuildsEvaluationTree_2()
        {
            var stack = new Stack<EvalNode>();
            EvalNode root = new EvalNode();

            Func<Engine.TraceInfo, object> entryHook = info =>
            {
                var node = new EvalNode { Snippet = info.Snippet };
                stack.Push(node);
                return node;
            };
            stack.Push(root);
            FuncScriptRuntime.Trace("1+2*3", (result, info, entryState) =>
            {
                var node = (EvalNode)entryState;
                node.Result = result;
                stack.Pop();
                stack.Peek().Children.Add(node);
            }, entryHook);
            stack.Pop();
            Assert.That(stack.Count, Is.EqualTo(0), "stack should be empty after trace exits");
            Assert.That(root, Is.Not.Null);
            Assert.That(root.Children, Has.Count.EqualTo(1));
            root = root.Children[0];
            Assert.That(root.Snippet, Does.Contain("1+2*3"));

            var actualHierarchy = ToHierarchy(root);
            Console.WriteLine(
                Newtonsoft.Json.JsonConvert.SerializeObject(
                    actualHierarchy,
                    Newtonsoft.Json.Formatting.Indented
                )
            );
            var expectedHierarchy = Tree("1+2*3",
                Tree("+"), Tree("1+2*3"), Tree("1"), Tree("2*3",
                            Tree("*"), Tree("2*3"), Tree("2"), Tree("3")
                                )
                        );

            Assert.That(
                JToken.DeepEquals(JToken.FromObject(actualHierarchy), JToken.FromObject(expectedHierarchy)),
                Is.True,
                "Trace hierarchy does not match expected structure");
        }
        [Test]
        public void TraceEntryHookBuildsEvaluationTree_3()
        {
            var stack = new Stack<EvalNode>();
            EvalNode root = new EvalNode();

            Func<Engine.TraceInfo, object> entryHook = info =>
            {
                var node = new EvalNode { Snippet = info.Snippet };
                stack.Push(node);
                return node;
            };
            stack.Push(root);
            var res=FuncScriptRuntime.Trace("[3,4]", (result, info, entryState) =>
            {
                var node = (EvalNode)entryState;
                node.Result = result;
                stack.Pop();
                stack.Peek().Children.Add(node);
            }, entryHook);
            stack.Pop();
            Assert.That(stack.Count, Is.EqualTo(0), "stack should be empty after trace exits");
            Assert.That(root, Is.Not.Null);
            Assert.That(root.Children, Has.Count.EqualTo(1));
            root = root.Children[0];
            Assert.That(root.Snippet, Does.Contain("[3,4]"));

            var actualHierarchy = ToHierarchy(root);
            Console.WriteLine("Lazy list");
            Console.WriteLine(
                Newtonsoft.Json.JsonConvert.SerializeObject(
                    actualHierarchy,
                    Newtonsoft.Json.Formatting.Indented
                )
            );
            var expectedHierarchy = Tree("[3,4]"); //because of lazy evaluation children evaluation are not done

            Assert.That(
                JToken.DeepEquals(JToken.FromObject(actualHierarchy), JToken.FromObject(expectedHierarchy)),
                Is.True,
                "Trace hierarchy does not match expected structure");
            root = new EvalNode();
            stack.Push(root);
            Engine.FormatToJson(res);//force evaluation of list elements
            Assert.That(root.Children.Count,Is.EqualTo(2)); //there will be two evaluation tress for the two list elements
            var actualHierarchies = root.Children.Select(r => ToHierarchy(r));
            var expectedHierarchies = new []{Tree("3"),Tree("4")};

            var i = 0;
            foreach (var pair in actualHierarchies.Zip(expectedHierarchies))
            {
                Console.WriteLine($"Tree {i}");
                i++;
                Console.WriteLine(
                    Newtonsoft.Json.JsonConvert.SerializeObject(
                        pair.First,
                        Newtonsoft.Json.Formatting.Indented
                    )
                );
                Assert.That(
                    JToken.DeepEquals(JToken.FromObject(pair.First), JToken.FromObject(pair.Second)),
                    Is.True,
                    "Trace hierarchy does not match expected structure");

            }
            
        }
        
        [Test]
        public void TraceEntryHookBuildsEvaluationTree_4()
        {
            var stack = new Stack<EvalNode>();
            EvalNode root = new EvalNode();

            Func<Engine.TraceInfo, object> entryHook = info =>
            {
                var node = new EvalNode { Snippet = info.Snippet };
                stack.Push(node);
                return node;
            };
            stack.Push(root);
            var res=FuncScriptRuntime.Trace("{x:[3,4],y:2}", (result, info, entryState) =>
            {
                var node = (EvalNode)entryState;
                node.Result = result;
                stack.Pop();
                stack.Peek().Children.Add(node);
            }, entryHook);
            
            stack.Pop();
            Assert.That(stack.Count, Is.EqualTo(0), "stack should be empty after trace exits");
            Assert.That(root, Is.Not.Null);
            Assert.That(root.Children, Has.Count.EqualTo(1));
            root = root.Children[0];
            Assert.That(root.Snippet, Does.Contain("{x:[3,4],y:2}"));

            var actualHierarchy = ToHierarchy(root);
            Console.WriteLine("Lazy kvc");
            Console.WriteLine(
                Newtonsoft.Json.JsonConvert.SerializeObject(
                    actualHierarchy,
                    Newtonsoft.Json.Formatting.Indented
                )
            );
            var expectedHierarchy = Tree("{x:[3,4],y:2}"); //because of lazy evaluation children evaluation are not done

            Assert.That(
                JToken.DeepEquals(JToken.FromObject(actualHierarchy), JToken.FromObject(expectedHierarchy)),
                Is.True,
                "Trace hierarchy does not match expected structure");
            
            
            root = new EvalNode();
            stack.Push(root);
            Engine.FormatToJson(res);
            Assert.That(root.Children.Count,Is.EqualTo(4)); 
            
            
            var actualHierarchies = root.Children.Select(r => ToHierarchy(r));
            var expectedHierarchies = new []{Tree("[3,4]"),Tree("3"),Tree("4"),Tree("2")};

            var i = 0;
            foreach (var pair in actualHierarchies.Zip(expectedHierarchies))
            {
                Console.WriteLine($"Tree {i}");
                i++;
                Console.WriteLine(
                    Newtonsoft.Json.JsonConvert.SerializeObject(
                        pair.First,
                        Newtonsoft.Json.Formatting.Indented
                    )
                );
                Assert.That(
                    JToken.DeepEquals(JToken.FromObject(pair.First), JToken.FromObject(pair.Second)),
                    Is.True,
                    "Trace hierarchy does not match expected structure");
            }
        }
        [Test]
        public void TraceEntryHookBuildsEvaluationTree_5()
        {
            var stack = new Stack<EvalNode>();
            EvalNode root = new EvalNode();

            Func<Engine.TraceInfo, object> entryHook = info =>
            {
                var node = new EvalNode { Snippet = info.Snippet };
                stack.Push(node);
                return node;
            };
            stack.Push(root);
            var res=FuncScriptRuntime.Trace("[[3,4],2]", (result, info, entryState) =>
            {
                var node = (EvalNode)entryState;
                node.Result = result;
                stack.Pop();
                stack.Peek().Children.Add(node);
            }, entryHook);
            
            stack.Pop();
            Assert.That(stack.Count, Is.EqualTo(0), "stack should be empty after trace exits");
            Assert.That(root, Is.Not.Null);
            Assert.That(root.Children, Has.Count.EqualTo(1));
            root = root.Children[0];
            Assert.That(root.Snippet, Does.Contain("[[3,4],2]"));

            var actualHierarchy = ToHierarchy(root);
            Console.WriteLine("Lazy kvc");
            Console.WriteLine(
                Newtonsoft.Json.JsonConvert.SerializeObject(
                    actualHierarchy,
                    Newtonsoft.Json.Formatting.Indented
                )
            );
            var expectedHierarchy = Tree("[[3,4],2]"); //because of lazy evaluation children evaluation are not done

            Assert.That(
                JToken.DeepEquals(JToken.FromObject(actualHierarchy), JToken.FromObject(expectedHierarchy)),
                Is.True,
                "Trace hierarchy does not match expected structure");
            
            
            root = new EvalNode();
            stack.Push(root);
            Engine.FormatToJson(res);
            Assert.That(root.Children.Count,Is.EqualTo(4)); 
            
            
            var actualHierarchies = root.Children.Select(r => ToHierarchy(r));
            var expectedHierarchies = new []{Tree("[3,4]"),Tree("3"),Tree("4"),Tree("2")};

            var i = 0;
            foreach (var pair in actualHierarchies.Zip(expectedHierarchies))
            {
                Console.WriteLine($"Tree {i}");
                i++;
                Console.WriteLine(
                    Newtonsoft.Json.JsonConvert.SerializeObject(
                        pair.First,
                        Newtonsoft.Json.Formatting.Indented
                    )
                );
                Assert.That(
                    JToken.DeepEquals(JToken.FromObject(pair.First), JToken.FromObject(pair.Second)),
                    Is.True,
                    "Trace hierarchy does not match expected structure");
            }
        }
        
        [Test]
        public void TraceEntryHookBuildsEvaluationTree_6()
        {
            var stack = new Stack<EvalNode>();
            EvalNode root = new EvalNode();

            Func<Engine.TraceInfo, object> entryHook = info =>
            {
                var node = new EvalNode { Snippet = info.Snippet };
                stack.Push(node);
                return node;
            };
            stack.Push(root);
            var res=FuncScriptRuntime.Trace("{x:3,eval x+4}", (result, info, entryState) =>
            {
                var node = (EvalNode)entryState;
                node.Result = result;
                stack.Pop();
                stack.Peek().Children.Add(node);
            }, entryHook);
            
            stack.Pop();
            Assert.That(stack.Count, Is.EqualTo(0), "stack should be empty after trace exits");
            Assert.That(root, Is.Not.Null);
            Assert.That(root.Children, Has.Count.EqualTo(1));
            root = root.Children[0];
            Assert.That(root.Snippet, Does.Contain("{x:3,eval x+4}"));

            var actualHierarchy = ToHierarchy(root);
            Console.WriteLine(
                Newtonsoft.Json.JsonConvert.SerializeObject(
                    actualHierarchy,
                    Newtonsoft.Json.Formatting.Indented
                )
            );
            var expectedHierarchy = Tree("{x:3,eval x+4}",Tree("eval x+4",
                Tree("+"),Tree("x+4"),Tree("x",Tree("3")),Tree("4")));

            Assert.That(
                JToken.DeepEquals(JToken.FromObject(actualHierarchy), JToken.FromObject(expectedHierarchy)),
                Is.True,
                "Trace hierarchy does not match expected structure");
        }
        private class EvalNode
        {
            public string Snippet;
            public object Result;
            public List<EvalNode> Children { get; } = new();
        }

        private static EvalNode Find(EvalNode node, string snippet)
        {
            if (node == null)
                return null;
            if (string.Equals(node.Snippet, snippet, StringComparison.Ordinal))
                return node;
            foreach (var child in node.Children)
            {
                var match = Find(child, snippet);
                if (match != null)
                    return match;
            }
            return null;
        }
        [Test]
        public void TraceEntryHookBuildsEvaluationTree_7()
        {
            var stack = new Stack<EvalNode>();
            EvalNode root = new EvalNode();

            Func<Engine.TraceInfo, object> entryHook = info =>
            {
                var node = new EvalNode { Snippet = info.Snippet };
                stack.Push(node);
                return node;
            };
            stack.Push(root);
            FuncScriptRuntime.Trace("x.y", (result, info, entryState) =>
            {
                var node = (EvalNode)entryState;
                node.Result = result;
                stack.Pop();
                stack.Peek().Children.Add(node);
            }, entryHook);
            stack.Pop();
            Assert.That(stack.Count, Is.EqualTo(0), "stack should be empty after trace exits");
            Assert.That(root, Is.Not.Null);
            Assert.That(root.Children, Has.Count.EqualTo(1));
            root = root.Children[0];
            Assert.That(root.Snippet, Does.Contain("x.y"));

            var actualHierarchy = ToHierarchy(root);
            Console.WriteLine(
                Newtonsoft.Json.JsonConvert.SerializeObject(
                    actualHierarchy,
                    Newtonsoft.Json.Formatting.Indented
                )
            );
            var expectedHierarchy = Tree("x.y",
                Tree("."),
                Tree("x.y"),    
                Tree("y"), //member access function first evaluates the member name
                Tree("x")
            );

            Assert.That(
                JToken.DeepEquals(JToken.FromObject(actualHierarchy), JToken.FromObject(expectedHierarchy)),
                Is.True,
                "Trace hierarchy does not match expected structure");
        }
        private static Dictionary<string, object> ToHierarchy(EvalNode node)
        {
            return new Dictionary<string, object>
            {
                [node.Snippet] = node.Children.Select(ToHierarchy).Cast<object>().ToList()
            };
        }

        private static Dictionary<string, object> Tree(string snippet, params Dictionary<string, object>[] children)
        {
            return new Dictionary<string, object>
            {
                [snippet] = (children ?? Array.Empty<Dictionary<string, object>>()).Cast<object>().ToList()
            };
        }
    }
}
