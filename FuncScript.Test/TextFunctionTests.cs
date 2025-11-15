using global::FuncScript;
using global::FuncScript.Model;
using NUnit.Framework;

namespace FuncScript.Test
{
    public class TextFunctionTests
    {
        [Test]
        public void TextProviderCollection_ExposesStringHelpers()
        {
            var provider = new DefaultFsDataProvider();

            var textProvider = provider.Get("text");
            Assert.That(textProvider, Is.InstanceOf<KeyValueCollection>());

            var textCollection = (KeyValueCollection)textProvider;
            Assert.That(textCollection.IsDefined("upper"), Is.True);
            Assert.That(textCollection.IsDefined("lower"), Is.True);
            Assert.That(textCollection.IsDefined("regex"), Is.True);

            var upperFromCollection = textCollection.Get("upper");
            Assert.That(upperFromCollection, Is.SameAs(provider.Get("upper")));
        }

        [TestCase("upper(\"hello\")", "HELLO")]
        [TestCase("text.upper(\"Hello world\")", "HELLO WORLD")]
        [TestCase("lower(\"HELLO\")", "hello")]
        [TestCase("text.lower(\"MiXeD\")", "mixed")]
        public void UpperAndLowerReturnTransformedStrings(string expression, string expected)
        {
            var result = Engine.Evaluate(expression);

            Assert.That(result, Is.TypeOf<string>());
            Assert.That(result, Is.EqualTo(expected));
        }

        [Test]
        public void LowerReturnsNullForNullInput()
        {
            var result = Engine.Evaluate("lower(null)");
            Assert.That(result, Is.Null);
        }

        [Test]
        public void RegexFunctionMatchesWithOptionalFlags()
        {
            Assert.That(Engine.Evaluate("regex(\"Hello world\", \"world\")"), Is.EqualTo(true));
            Assert.That(Engine.Evaluate("regex(\"Hello world\", \"^world$\")"), Is.EqualTo(false));
            Assert.That(Engine.Evaluate("regex(\"Hello\", \"^hello$\", \"i\")"), Is.EqualTo(true));
        }
    }
}
