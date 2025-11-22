using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using FuncScript.Core;
using FuncScript.Error;
using FuncScript.Model;

namespace FuncScript.Test;

public class BugAnalysis
{
    [Test]
    public void ParserPerformanceIssue_Oct_2025()
    {
        var g = new DefaultFsDataProvider();
        var exp = System.IO.File.ReadAllText(@"data/parse-test-1.fx");
        var err = new List<FuncScriptParser.SyntaxErrorData>();
        var timer = System.Diagnostics.Stopwatch.StartNew();
        var parseContext = new FuncScriptParser.ParseContext(new DefaultFsDataProvider(), exp);
        var parseResult = FuncScriptParser.Parse(parseContext);
        err.AddRange(parseResult.Errors);
        var block = parseResult.ExpressionBlock;
        Assert.NotNull(exp);
        Assert.IsEmpty(err);
        Assert.That(parseResult.NextIndex, Is.EqualTo(exp.Length));
        timer.Stop();
        Assert.Less(timer.ElapsedMilliseconds, 500);
        Console.WriteLine($"Parsing took {timer.ElapsedMilliseconds} milliseconds");
    }
    [Test]
    public void ParserPerformanceIssue_Reduced()
    {
        var g = new DefaultFsDataProvider();
        var exp = "{x:2,y:{x:2,y:{x:2,y:{x:2,y:{x:2,y:{x:2,y:{x:2,y:{x:2,y:5}}}}}}}}";
        var err = new List<FuncScriptParser.SyntaxErrorData>();
        var timer = System.Diagnostics.Stopwatch.StartNew();
        var parseContext = new FuncScriptParser.ParseContext(new DefaultFsDataProvider(), exp);
        var parseResult = FuncScriptParser.Parse(parseContext);
        err.AddRange(parseResult.Errors);
        var block = parseResult.ExpressionBlock;
        Assert.NotNull(exp);
        Assert.IsEmpty(err);
        Assert.That(parseResult.NextIndex, Is.EqualTo(exp.Length));
        timer.Stop();
        Assert.Less(timer.ElapsedMilliseconds, 500);
        Console.WriteLine($"Parsing took {timer.ElapsedMilliseconds} milliseconds");
    }

    [Test]
        public void CommentHandling_Bug()
        {
            var exp = @"4//3 
 +5;
";
            var res = Engine.Evaluate(exp);
            Assert.AreEqual(9, res);
        }

        [Test]
        public void BlockCommentHandling()
        {
            var exp = @"4/*comment
spanning*/
+5;";
            var res = Engine.Evaluate(exp);
            Assert.AreEqual(9, res);
        }

    [Test]
    public void EvaluateSpateSeparatedExpression()
    {
        var exp = "./cis10.api/bin/Release/net6.0/cis10.api.dll cis10.api.Cis10ApplicationScopeFactory ./cis10.ef/Seeds/min/land_tran/land_tran_config --isolated";
        var res = Engine.EvaluateSpaceSeparatedList(exp);
        Assert.That(res, Is.InstanceOf<IEnumerable<string>>());
        var list = (IEnumerable<string>)res;
        Assert.That(list.Count(),Is.EqualTo(4));
    }

    [Test]
    public void Bug20251104()
    {
        var exp = @"{
    return if true then 2 else 1;
}";
        var res = Engine.Evaluate(exp);
        Assert.That(res, Is.EqualTo(2));
    }

    [Test]
    public void Bug20251120()
    {
        const string query = @"
testData.Samples map (sample) => sample 
{
    z: utils.TheLambda(3)
}
";

        var testData = new
        {
            Samples = new[] { new { r = 32 } }
        };
        Assume.That(testData, Is.Not.Null);

        var provider = new DefaultFsDataProvider();
        var utils = new
        {
            TheLambda = new Func<int, long>((x) =>12L)
        };

        var result = Engine.Evaluate(query, provider, new { testData, utils }, Engine.ParseMode.Standard);

        Assert.That(result,Is.AssignableTo<FsList>());
        var lst = (FsList)result;
        Assert.That(lst.Length,Is.EqualTo(1));
        var e = lst[0];
        Assert.That(e,Is.AssignableTo<KeyValueCollection>());
        var kvc = (KeyValueCollection)e;
        var date=kvc.Get("z");
        Assert.That(date,Is.TypeOf<long>());
    }

    [Test]
    public void Bug20251120_2()
    {
        var testData = new
        {
            y=3
        };

        var q=@"
        testData {
            x: x??0+2,
        }";
        var provider = new DefaultFsDataProvider();
        var result = Engine.Evaluate(q, provider, new { testData }, Engine.ParseMode.Standard);
        Assert.That(result,Is.AssignableTo<KeyValueCollection>());
        var kvc = (KeyValueCollection)result;
        var n = kvc.Get("x");
        Assert.That(n,Is.EqualTo(2));
    }

    [Test]
    public void Bug20251120_3()
    {
        string fn = "./data/test-file.txt";
        var exp = $"file('{fn}')";
        Assert.That(System.IO.File.Exists(fn),"This test requires file to exists");
        var res = Engine.Evaluate(exp);
        Assert.That(res,Is.EqualTo(System.IO.File.ReadAllText(fn)));
    }
    [Test]
    public void Bug20251121()
    {
        var exp = @"{list: [3],count: 1} {List: List map (x) => 2+x}";

        var res = Engine.Evaluate( new DefaultFsDataProvider(), exp);
        Assert.That(res is KeyValueCollection);
        var kvc = (KeyValueCollection)res;
        var l = kvc.Get("list");
        Assert.That(l is FsList);
        var list = (FsList)l;
        Assert.That(list[0],Is.EqualTo(5));

    }
}
