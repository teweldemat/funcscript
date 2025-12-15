using FuncScript.Model;
using NUnit.Framework;

namespace FuncScript.Test
{
    public class KvcItemSelectorSyntaxTests
    {
        [Test]
        public void IdentifierSelector_Item_Sugars_To_KeyValuePair()
        {
            var result = FuncScriptRuntime.EvaluateWithVars(
                "{person {name,age}}",
                new { person = new { name = "Alice", age = 30, extra = true } });

            Assert.That(result, Is.AssignableTo<KeyValueCollection>());
            var outer = (KeyValueCollection)result;

            var projected = outer.Get("person");
            Assert.That(projected, Is.AssignableTo<KeyValueCollection>());

            var projectedKvc = (KeyValueCollection)projected;
            Assert.That(projectedKvc.Get("name"), Is.EqualTo("Alice"));
            Assert.That(projectedKvc.Get("age"), Is.EqualTo(30));
            Assert.That(projectedKvc.IsDefined("extra", hierarchy: false), Is.False);
        }

        [Test]
        public void IdentifierSelector_Item_Works_In_Eval_Block()
        {
            var expression = @"{
  x:{a:3,b:4},
  eval {
    x {a}
  }
}";

            var result = FuncScriptRuntime.Evaluate(expression);
            Assert.That(result, Is.AssignableTo<KeyValueCollection>());

            var kvc = (KeyValueCollection)result;
            var projected = kvc.Get("x");
            Assert.That(projected, Is.AssignableTo<KeyValueCollection>());

            var projectedKvc = (KeyValueCollection)projected;
            Assert.That(projectedKvc.Get("a"), Is.EqualTo(3));
            Assert.That(projectedKvc.IsDefined("b", hierarchy: false), Is.False);
        }
    }
}
