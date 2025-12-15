using System;
using FuncScript;
using FuncScript.Error;
using FuncScript.Model;
using NUnit.Framework;

namespace FuncScript.Test
{
    public class DivisionOperatorTests
    {
        [TestCase("4/2", 2, typeof(int))]
        [TestCase("8/2/2", 2, typeof(int))]
        [TestCase("12l/3", 4L, typeof(long))]
        [TestCase("25L/5/5", 1L, typeof(long))]
        public void SlashOperator_RetainsIntegerWhenExact(string expression, object expected, Type expectedType)
        {
            var result = Engine.Evaluate(expression);
            Assert.That(result, Is.TypeOf(expectedType));
            Assert.That(result, Is.EqualTo(expected));
        }

        [TestCase("1/2", 0.5d)]
        [TestCase("3/2", 1.5d)]
        [TestCase("6/4/2", 0.75d)]
        [TestCase("6/3/4", 0.5d)]
        [TestCase("9/3/2/2", 0.75d)]
        [TestCase("9l/2", 4.5d)]
        [TestCase("5/2l", 2.5d)]
        public void SlashOperator_PromotesToDoubleWhenRemainderExists(string expression, double expected)
        {
            var result = Engine.Evaluate(expression);
            Assert.That(result, Is.TypeOf<double>());
            Assert.That((double)result, Is.EqualTo(expected).Within(1e-10));
        }

        [TestCase("9 div 2", 4, typeof(int))]
        [TestCase("18 div 3 div 2", 3, typeof(int))]
        [TestCase("9l div 2", 4L, typeof(long))]
        [TestCase("9 div 2l", 4L, typeof(long))]
        [TestCase("50l div 4 div 2", 6L, typeof(long))]
        [TestCase("-9 div 2", -4, typeof(int))]
        public void IntegerDivisionOperator_ComputesTruncatedResults(string expression, object expected, Type expectedType)
        {
            var result = Engine.Evaluate(expression);
            Assert.That(result, Is.TypeOf(expectedType));
            Assert.That(result, Is.EqualTo(expected));
        }

        [TestCase("4.0 div 2")]
        [TestCase("4 div 2.0")]
        [TestCase("4 div \"2\"")]
        [TestCase("4 div null")]
        public void IntegerDivisionOperator_RejectsNonIntegerOperands(string expression)
        {
            var result = Engine.Evaluate(expression);
            Assert.That(result, Is.TypeOf<FsError>());
            var fsError = (FsError)result;
            Assert.That(fsError.ErrorType, Is.EqualTo(FsError.ERROR_TYPE_MISMATCH));
            Assert.That(fsError.ErrorMessage, Does.Contain("integer parameters expected").IgnoreCase);
        }
    }
}
