using global::FuncScript.Core;
using global::FuncScript.Error;
using global::FuncScript.Model;
using NUnit.Framework;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Threading.Tasks;

namespace FuncScript.Test
{
    public class TestErrorReporting
    {
        private static FsError AssertExpressionReturnsFsError(string expression)
        {
            var result = FuncScriptRuntime.Evaluate(expression);
            Assert.That(result, Is.TypeOf<FsError>(), $"Expected '{expression}' to return FsError");
            var fsError = (FsError)result;
            Assert.That(fsError.CodeLocation, Is.Not.Null, $"FsError from '{expression}' is missing CodeLocation");
            return fsError;
        }

        private static FsError AssertExpressionReturnsFsError(string expression, string errorExpression)
        {
            var fsError = AssertExpressionReturnsFsError(expression);
            var expectedPos = expression.IndexOf(errorExpression, StringComparison.Ordinal);
            Assert.That(expectedPos, Is.GreaterThanOrEqualTo(0), $"Failed to locate '{errorExpression}' within '{expression}'");
            Assert.That(fsError.CodeLocation.Position, Is.EqualTo(expectedPos));
            Assert.That(fsError.CodeLocation.Length, Is.EqualTo(errorExpression.Length));
            return fsError;
        }

        void AnalyzeError(Exception ex, String exp, int expectedPos, int expecctedLen)
        {
            Assert.AreEqual(typeof(Error.EvaluationException), ex.GetType());
            var evalError = (EvaluationException)ex;
            Console.WriteLine(evalError.Message);
            if (evalError.InnerException != null)
                Console.WriteLine(evalError.InnerException.Message);
            Assert.AreEqual(expectedPos, evalError.Pos);
            Assert.AreEqual(expecctedLen, evalError.Len);
        }
        void AnalyzeSyntaxError(Exception ex, String exp)
        {
            Assert.AreEqual(typeof(Error.SyntaxError), ex.GetType());
            var sError = (SyntaxError)ex;
            Console.WriteLine(sError.Message);
            if (sError.InnerException != null)
                Console.WriteLine(sError.InnerException.Message);
        }
        void AnalyzeMainSyntaxErrorLine(Exception ex,string line)
        {
            Assert.AreEqual(typeof(Error.SyntaxError), ex.GetType());
            var sError = (SyntaxError)ex;
            Assert.That(sError.Line,Is.EqualTo(line));
        }
        [Test]
        public void TestFunctionError()
        {
            var exp = $"length(a)";
            try
            {
                FuncScriptRuntime.Evaluate(exp);
            }
            catch (Exception ex)
            {
                AnalyzeError(ex, exp, 0, exp.Length);
            }
        }


        [Test]
        public void TestFunctionError2()
        {
            var error_exp = "length(a)";
            var exp = $"10+{error_exp}";
            try
            {
                FuncScriptRuntime.Evaluate(exp);
            }
            catch (Exception ex)
            {
                AnalyzeError(ex, exp, exp.IndexOf(error_exp), error_exp.Length);
            }
        }
        [Test]
        public void TestTypeMismatchError()
        {
            var error_exp = "len(5)";
            var exp = $"10+{error_exp}";
            try
            {
                FuncScriptRuntime.Evaluate(exp);
                throw new Exception("No error");
            }
            catch (Exception ex)
            {
                AnalyzeError(ex, exp, exp.IndexOf(error_exp), error_exp.Length);
                Assert.AreEqual(typeof(Error.TypeMismatchError), ex.InnerException.GetType());
            }
        }
        [Test]
        public void TestNullMemberAccessError()
        {
            var error_exp = "x.l";
            var exp = $"10+{error_exp}";
            var fsError = AssertExpressionReturnsFsError(exp, error_exp);
            Assert.That(fsError.ErrorType, Is.EqualTo(FsError.ERROR_TYPE_MISMATCH));
        }

        [Test]
        public void LogErrorExpressionSpanMatchesOriginalExpression()
        {
            var expression = "1+x.l";
            var fsError = AssertExpressionReturnsFsError(expression, "x.l");
            Assert.That(expression.Substring(fsError.CodeLocation.Position, fsError.CodeLocation.Length), Is.EqualTo("x.l"));
        }

        [Test]
        public void FunctionCallErrorMessageContainsOriginalExpression()
        {
            var expression = "1+z(a)";
            var exception = Assert.Throws<Error.EvaluationException>(() => FuncScriptRuntime.Evaluate(expression));
            Assert.That(exception!.Message, Does.Contain("z(a)"));
        }
        [Test]
        public void TestListMemberAccessError()
        {
            var error_exp = "[5,6].l";
            var exp = $"10+{error_exp}";
            var fsError = AssertExpressionReturnsFsError(exp, error_exp);
            Assert.That(fsError.ErrorType, Is.EqualTo(FsError.ERROR_TYPE_MISMATCH));

        }
        [Test]
        public void TestListMemberAccessError2()
        {
            var error_exp = "c.d";
            var exp = $"{{a:5; b:{error_exp};}}";
            var result = FuncScriptRuntime.Evaluate(exp);
            Assert.That(result, Is.InstanceOf<KeyValueCollection>());
            var collection = (KeyValueCollection)result;
            var value = collection.Get("b");
            Assert.That(value, Is.TypeOf<FsError>());
            var fsError = (FsError)value;
            Assert.That(fsError.CodeLocation, Is.Not.Null);
            var expectedPos = exp.IndexOf(error_exp, StringComparison.Ordinal);
            Assert.That(expectedPos, Is.GreaterThanOrEqualTo(0));
            Assert.That(fsError.CodeLocation.Position, Is.EqualTo(expectedPos));
            Assert.That(fsError.CodeLocation.Length, Is.EqualTo(error_exp.Length));
            Assert.That(fsError.ErrorType, Is.EqualTo(FsError.ERROR_TYPE_MISMATCH));

        }

        [Test]
        public void IfExpressionMemberAccessReturnsError()
        {
            var error_exp = "a.b";
            var exp = "if a.b then true else false";
            var fsError = AssertExpressionReturnsFsError(exp, error_exp);
            Assert.That(fsError.ErrorType, Is.EqualTo(FsError.ERROR_TYPE_MISMATCH));
        }

        [Test]
        public void IfExpressionShortCircuitsMemberAccess()
        {
            var exp = "if false and a.b then 'x' else 'y'";
            var result = FuncScriptRuntime.Evaluate(exp);
            Assert.That(result, Is.EqualTo("y"));
        }
        [Test]
        public void TestListUncalledError()
        {
            var exp = "{a:x.y; b:3; return b}";
            var res=FuncScriptRuntime.Evaluate(exp);
            Assert.AreEqual(res,3);
        }

        [Test]
        public void TestSyntaxErrorMissingOperand()
        {
            var error_exp = "3+";
            var exp = $"{error_exp}";
            var msg = Guid.NewGuid().ToString();
            try
            {
                //FuncScriptRuntime.Evaluate(exp, new { f = new Func<int, int>((x) => { throw new Exception("internal"); }) });
                FuncScriptRuntime.EvaluateWithVars(exp, new
                {
                    f = new Func<int, int>((x) =>
                    {
                        throw new Exception(msg);
                    })
                });
            }
            catch (Exception ex)
            {
                AnalyzeSyntaxError(ex, exp);
            }
        }
        [Test]
        public void TestSyntaxErrorIncompletKvc1()
        {
            var error_exp = "{a:3,c:";
            var exp = $"{error_exp}";
            var msg = Guid.NewGuid().ToString();
            try
            {
                //FuncScriptRuntime.Evaluate(exp, new { f = new Func<int, int>((x) => { throw new Exception("internal"); }) });
                FuncScriptRuntime.EvaluateWithVars(exp, new
                {
                    f = new Func<int, int>((x) =>
                    {
                        throw new Exception(msg);
                    })
                });
                throw new Exception("No error");
            }
            catch (Exception ex)
            {
                AnalyzeSyntaxError(ex, exp);
            }
        }
        [Test]
        public void TestLambdaErrorMemberAccessError()
        {
            var error_exp = "f(3)";
            var exp = $"10+{error_exp}";
            var msg = Guid.NewGuid().ToString();
            try
            {
                //FuncScriptRuntime.Evaluate(exp, new { f = new Func<int, int>((x) => { throw new Exception("internal"); }) });
                FuncScriptRuntime.EvaluateWithVars(exp, new { f = new Func<int, int>((x) =>
                {
                    throw new Exception(msg);
                })});
                throw new Exception("No error");
            }
            catch (Exception ex)
            {
                AnalyzeError(ex, exp, exp.IndexOf(error_exp), error_exp.Length);
                Assert.AreEqual(msg, ex.InnerException.InnerException.Message);
            }

        }
    }
}
