using System;
using global::FuncScript.Model;
using NUnit.Framework;

namespace FuncScript.Test;

public class AdvancedSyntax
{
    [Test]
    public void NakedKeyValuePair()
    {
        var exp = "a:4,b:5";
        var res = FuncScriptRuntime.Evaluate(exp);
        var expected = new ObjectKvc(new { a = 4, b = 5 });
        Assert.That(FuncScriptRuntime.FormatToJson(res),Is.EqualTo(FuncScriptRuntime.FormatToJson(expected)));
    }

    [Test]
    public void KeyValuePairsAllowWhitespaceSeparators()
    {
        var exp = "{x:3 y:4\nz:x+y}";
        var res = FuncScriptRuntime.Evaluate(exp);
        var expected = new ObjectKvc(new { x = 3, y = 4, z = 7 });
        Assert.That(FuncScriptRuntime.FormatToJson(res), Is.EqualTo(FuncScriptRuntime.FormatToJson(expected)));
    }
    [Test]
    [TestCase("!true",false)]
    [TestCase("!false",true)]
    [TestCase("!(1=2)",true)]
    public void NotOperator(string exp,object expected)
    {
        var res = FuncScriptRuntime.Evaluate(exp);
        Assert.That(res,Is.EqualTo(expected));
    }
    [Test]
    [TestCase("-5",-5)]
    [TestCase("1--5",6)]
    [TestCase("1+-5",-4)]
    [TestCase("{x:-5;return -x}",5)]
    [TestCase("{x:-5;return 1--x}",-4)]
    [TestCase("{x:-5;return 1+-x}",6)]
    public void NegOperator(string exp,object expected)
    {
        var res = FuncScriptRuntime.Evaluate(exp);
        Assert.That(res,Is.EqualTo(expected));
    }
    
    [Test]
    [TestCase("reduce([4,5,6],(s,x)=>s+x)",15)]
    [TestCase("reduce([4,5,6],(s,x)=>s+x,-2)",13)]
    [TestCase("[4,5,6] reduce (s,x)=>s+x ~ -2",13)]
    [TestCase("(range(0,4) reduce (s,x)=>s+x ~ 0)",6)]
    [TestCase("range(0,4) reduce (s,x)=>s+x ~ 0",6)]
    [TestCase("(range(1,3) map (a)=>a*a) reduce (s,x)=>s+x ~ 5",19)]
    [TestCase("[{a:5},{a:6}] reduce (s,x)=>s+x.a",11)]
    [TestCase("x?![1,2,3] first(x)=>x*x",null)]
    [TestCase("{ b:x?! [1,2,3] map(x) => 5; return b}",null)]
    [TestCase("{x:9; b:x?! [1,2,3] map(x) => 5; return b[1]}",5)]
    public void GeneralInfix(string exp,object expected)
    {
        var res = FuncScriptRuntime.Evaluate(exp);
        Assert.That(res,Is.EqualTo(expected));
    }
    
    [Test]
    [TestCase("1+2*4",9)]
    [TestCase("1+4/2",3)]
    public void Precedence(string exp,object expected)
    {
        var res = FuncScriptRuntime.Evaluate(exp);
        Assert.That(res,Is.EqualTo(expected));
    }
    
    [Test]
    [TestCase("!null",FsError.ERROR_TYPE_MISMATCH)]
    public void ErrorResults(string exp,string type)
    {
        var res = FuncScriptRuntime.Evaluate(exp);
        Assert.That(res, Is.TypeOf<FsError>());
        Assert.That(((FsError)res).ErrorType,Is.EqualTo(type));
    }
}
