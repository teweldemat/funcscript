using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using FuncScript.Core;
using FuncScript.Error;

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
        var parseContext = new FuncScriptParser.ParseContext(new DefaultFsDataProvider(), exp, err);
        var parseResult = FuncScriptParser.Parse(parseContext);
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
        var parseContext = new FuncScriptParser.ParseContext(new DefaultFsDataProvider(), exp, err);
        var parseResult = FuncScriptParser.Parse(parseContext);
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
}
