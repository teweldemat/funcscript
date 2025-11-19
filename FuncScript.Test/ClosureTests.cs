using global::FuncScript.Core;
using global::FuncScript.Model;
using NUnit.Framework;

namespace FuncScript.Test
{
    public class ClosureTests
    {
        private static string ClosureExpression(int invocationValue)
        {
            return $@"G:(t)=>
{{
  Z:1;
  H:(s)=>t=s;
}};

b1:G(3);
b2:G(4);

X:[b1.Z,b2.Z],
J:b1.H
  
eval [X,J({invocationValue})]";
        }

        private static FsList EvaluateClosure(int invocationValue)
        {
            var expression = ClosureExpression(invocationValue);
            var result = FuncScriptRuntime.Evaluate(expression);
            Assert.That(result, Is.InstanceOf<FsList>());
            return (FsList)result;
        }

        private static void AssertNumbers(FsList outerList)
        {
            Assert.That(outerList.Length, Is.EqualTo(2));
            Assert.That(outerList[0], Is.InstanceOf<FsList>());
            var numbers = (FsList)outerList[0];
            Assert.That(numbers.Length, Is.EqualTo(2));
            Assert.AreEqual(1, numbers[0]);
            Assert.AreEqual(1, numbers[1]);
        }

        [Test]
        [TestCase(4, false)]
        [TestCase(3, true)]
        public void ClosureRetainsCapturedParameterPerInstance(int invocationValue, bool expected)
        {
            var outerList = EvaluateClosure(invocationValue);
            AssertNumbers(outerList);
            Assert.That(outerList[1], Is.EqualTo(expected));
        }

        [Test]
        public void ContextMixupTest1()
        {
            var exp =
                @"
{
    a:5;
    k:
    {a:3,f:(x)=>x*a;}
    eval k.f(2);
}
";
            var res = Engine.Evaluate(exp);
            Assert.That(res,Is.EqualTo(6));
        }
        [Test]
        public void ContextMixupTest2()
        {
            var exp =
                @"
{
    a:5;
    k:
    {a:3, eval (x)=>x*a;}
    eval k(2);
}
";
            var res = Engine.Evaluate(exp);
            Assert.That(res,Is.EqualTo(6));
        }
    }
}
