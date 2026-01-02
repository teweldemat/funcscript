using FuncScript.Model;
using NUnit.Framework;

namespace FuncScript.Test
{
    internal class CircularReferences
    {
        private static void AssertDepthOverflow(string expression)
        {
            var result = FuncScriptRuntime.Evaluate(expression);
            Assert.That(result, Is.TypeOf<FsError>());
            var fsError = (FsError)result;
            Assert.That(fsError.ErrorMessage, Does.Contain("Maximum evaluation depth"));
        }

        /*
        [Test]
        public void PropertySelfReferenceRaisesEvaluationError()
        {
            AssertDepthOverflow("{ a: a + 1; return a; }");
        }
        */

        [Test]
        public void FunctionSelfReferenceRaisesEvaluationError()
        {
            AssertDepthOverflow("{ f: (x)=>f(x); return f(1); }");
        }

        /*
        [Test]
        public void IndirectPropertyLoopRaisesEvaluationError()
        {
            AssertDepthOverflow("{ a: b + 1; b: a + 1; return a; }");
        }
        */
    }
}
