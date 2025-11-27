using NUnit.Framework;

namespace FuncScript.Test
{
    /*FuncScript format function:
     Two types of formatting 'json' and default:
    Default mode:
        Atomic values are formatted similar to the way Console.WriteLine will print them. 
        The second paramter of the format function is used as additional fine control of the way the formatting operation.
        For list and keyvalue collection the out is json like with the following difference:
            - long values are represented as number instead of quated text
    Json mode
        Value is converted to json.
        
     */
    public class FormatFunctionTests
    {
        [Test]
        public void FormatLongDefaultMode()
        {
            var result = FuncScriptRuntime.Evaluate("format(12345678901234l)");

            Assert.That(result, Is.TypeOf<string>());
            Assert.That(result, Is.EqualTo("12345678901234"));
        }
        [Test]
        public void FormatStringDefaultMode()
        {
            var result = FuncScriptRuntime.Evaluate("format('1234')");

            Assert.That(result, Is.TypeOf<string>());
            Assert.That(result, Is.EqualTo("1234"));
        }

        [Test]
        public void FormatListDefault()
        {
            var result = FuncScriptRuntime.Evaluate("format([4,5])");

            Assert.That(result, Is.TypeOf<string>());
            Assert.That(((string)result)
                .Replace(" ","")
                .Replace("\n","")
                .Replace("\r",""), Is.EqualTo("[4,5]"));
        }
        [Test]
        public void FormatListStringInterpolation()
        {
            var result = FuncScriptRuntime.Evaluate("f'{[4,5]}'");

            Assert.That(result, Is.TypeOf<string>());
            Assert.That(((string)result).Replace(" ","")
                .Replace("\n","")
                .Replace("\r",""), Is.EqualTo("[4,5]"));
        }
        
        [Test]
        public void FormatListWithStringDefault()
        {
            var result = FuncScriptRuntime.Evaluate("format([4,'5'])");

            Assert.That(result, Is.TypeOf<string>());
            Assert.That(((string)result)
                .Replace(" ","")
                .Replace("\n","")
                .Replace("\r",""), Is.EqualTo("[4,\"5\"]"));
        }
        [Test]
        public void FormatListWithStringStringInterpolation()
        {
            var result = FuncScriptRuntime.Evaluate("f'{[4,\"5\"]}'");

            Assert.That(result, Is.TypeOf<string>());
            Assert.That(((string)result)
                .Replace(" ","")
                .Replace("\n","")
                .Replace("\r",""), Is.EqualTo("[4,\"5\"]"));
        }

        [Test]
        public void FormatLongJsonMode()
        {
            var result = FuncScriptRuntime.Evaluate("format(12345678901234l,\"json\")");

            Assert.That(result, Is.TypeOf<string>());
            Assert.That(result, Is.EqualTo("\"12345678901234\""));
        }
    }
}
