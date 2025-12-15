using FuncScript.Model;
using NUnit.Framework;
using System;

namespace FuncScript.Test
{
    public class ChangeTypeFunctionTests
    {
        [TestCase("ChangeType('123','Integer')", 123)]
        [TestCase("ChangeType('123','integer')", 123)]
        [TestCase("ChangeType('123','InTeGeR')", 123)]
        public void Converts_String_To_Integer(string expression, int expected)
        {
            var result = FuncScriptRuntime.Evaluate(expression);
            Assert.That(result, Is.TypeOf<int>());
            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void Converts_Integer_To_Float()
        {
            var result = FuncScriptRuntime.Evaluate("ChangeType(1,'Float')");
            Assert.That(result, Is.TypeOf<double>());
            Assert.That(result, Is.EqualTo(1d));
        }

        [Test]
        public void Converts_Integer_To_BigInteger()
        {
            var result = FuncScriptRuntime.Evaluate("ChangeType(1,'BigInteger')");
            Assert.That(result, Is.TypeOf<long>());
            Assert.That(result, Is.EqualTo(1L));
        }

        [Test]
        public void Converts_String_To_Boolean()
        {
            var result = FuncScriptRuntime.Evaluate("ChangeType('true','Boolean')");
            Assert.That(result, Is.TypeOf<bool>());
            Assert.That(result, Is.EqualTo(true));
        }

        [Test]
        public void Converts_String_To_Guid()
        {
            var result = FuncScriptRuntime.Evaluate("ChangeType('00000000-0000-0000-0000-000000000000','Guid')");
            Assert.That(result, Is.TypeOf<Guid>());
            Assert.That(result, Is.EqualTo(Guid.Empty));
        }

        [Test]
        public void Converts_Ticks_To_DateTime()
        {
            var ticks = 637134336000000000L; // 2020-01-01T00:00:00
            var result = FuncScriptRuntime.Evaluate($"ChangeType({ticks}l,'DateTime')");
            Assert.That(result, Is.TypeOf<DateTime>());
            Assert.That(result, Is.EqualTo(new DateTime(ticks)));
        }

        [Test]
        public void Converts_Base64_To_ByteArray()
        {
            var result = FuncScriptRuntime.Evaluate("ChangeType('AQID','ByteArray')");
            Assert.That(result, Is.TypeOf<byte[]>());
            Assert.That((byte[])result, Is.EqualTo(new byte[] { 1, 2, 3 }));
        }

        [Test]
        public void Unknown_TypeName_Returns_Error()
        {
            var result = FuncScriptRuntime.Evaluate("ChangeType(1,'NotAType')");
            Assert.That(result, Is.TypeOf<FsError>());
            Assert.That(((FsError)result).ErrorType, Is.EqualTo(FsError.ERROR_TYPE_INVALID_PARAMETER));
        }

        [Test]
        public void NonString_TypeName_Returns_Error()
        {
            var result = FuncScriptRuntime.Evaluate("ChangeType(1,2)");
            Assert.That(result, Is.TypeOf<FsError>());
            Assert.That(((FsError)result).ErrorType, Is.EqualTo(FsError.ERROR_TYPE_MISMATCH));
        }

        [Test]
        public void Propagates_Error_Values()
        {
            var result = FuncScriptRuntime.Evaluate("ChangeType(error('boom'),'String')");
            Assert.That(result, Is.TypeOf<FsError>());
            Assert.That(((FsError)result).ErrorMessage, Is.EqualTo("boom"));
        }
    }
}

