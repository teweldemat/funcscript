using FuncScript.Core;
using NUnit.Framework;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using FuncScript.Model;

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
                FuncScriptRuntime.Trace("1+2", (trace, infoObj) =>
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
        public void TraceWithHookReceivesLocationDataForError()
        {
            var errMsg = "the error";
            var infos = new List<Engine.TraceInfo>();
            FuncScriptRuntime.Trace($"1+error('{errMsg}')", (trace, infoObj) =>
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
            FuncScriptRuntime.Trace("2+f(3)",p,(trace, infoObj) =>
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
            
            FuncScriptRuntime.Trace("1+2",(trace, infoObj) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
            });
            Assert.That(infos.Count,Is.EqualTo(4));
            
        }
        [Test]
        public void TraceNumberOfEvaluations_2()
        {
            var infos = new List<Engine.TraceInfo>();
            
            FuncScriptRuntime.Trace("math.round(2)",(trace, infoObj) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
            });
            //literal 2
            //function call math.round with parameter [2]
            //function call dot function wit parameter  [math, round]
            //reference block 'math'
            //reference block 'round'
            //full expressio
            Assert.That(infos.Count,Is.EqualTo(6));
            
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
            FuncScriptRuntime.Trace("f(3)",p,(trace, infoObj) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
            });
            //literal 3
            //function call f with parameter [3]
            //reference block 'f'
            Assert.That(infos.Count,Is.EqualTo(3));
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
            FuncScriptRuntime.Trace("2+f(3)",p,(trace, infoObj) =>
            {
                Assert.That(trace, Is.Not.Null);
                infos.Add((Engine.TraceInfo)infoObj);
            });
            //literal 2
            //function call +, [2,f(3)]
            //literal 3
            //reference f
            //reference +
            //full expression
            Assert.That(infos.Count,Is.EqualTo(6));
        }
    }
}
