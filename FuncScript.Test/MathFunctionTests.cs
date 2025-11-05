using global::FuncScript;
using global::FuncScript.Core;
using global::FuncScript.Model;
using NUnit.Framework;

namespace FuncScript.Test
{
    public class MathFunctionTests
    {
        [Test]
        public void MathProviderCollection_ExposesCommonFunctions()
        {
            var provider = new DefaultFsDataProvider();

            var math = provider.Get("math");
            Assert.That(math, Is.InstanceOf<KeyValueCollection>());

            var mathCollection = (KeyValueCollection)math;
            Assert.That(mathCollection.IsDefined("sin"), Is.True, "sin should be registered under math");
            Assert.That(mathCollection.IsDefined("cos"), Is.True, "cos should be registered under math");
            Assert.That(mathCollection.IsDefined("sqrt"), Is.True, "sqrt should be registered under math");
            Assert.That(mathCollection.IsDefined("pi"), Is.True, "pi should be registered under math");

            var sinFromCollection = mathCollection.Get("sin");
            var cosFromCollection = mathCollection.Get("cos");
            var piFromCollection = mathCollection.Get("pi");

            Assert.That(sinFromCollection, Is.SameAs(provider.Get("sin")), "math.sin should point to the same instance as the global sin function");
            Assert.That(cosFromCollection, Is.SameAs(provider.Get("cos")), "math.cos should point to the same instance as the global cos function");
            Assert.That(piFromCollection, Is.TypeOf<double>());
            Assert.That((double)piFromCollection, Is.EqualTo(System.Math.PI).Within(1e-10));
        }

        [TestCase("math.sin(0)", 0.0)]
        [TestCase("math.cos(0)", 1.0)]
        [TestCase("math.tan(0)", 0.0)]
        [TestCase("math.sqrt(9)", 3.0)]
        [TestCase("math.exp(0)", 1.0)]
        [TestCase("math.log(math.e)", 1.0)]
        [TestCase("math.log(8,2)", 3.0)]
        [TestCase("math.log10(1000)", 3.0)]
        [TestCase("math.abs(-5.0)", 5.0)]
        [TestCase("math.round(2.345,2)", 2.35)]
        [TestCase("math.trunc(2.9)", 2.0)]
        public void MathFunctions_AccessibleThroughMathCollection(string expression, double expected)
        {
            var result = Engine.Evaluate(expression);
            Assert.That(result, Is.TypeOf<double>());
            Assert.That((double)result, Is.EqualTo(expected).Within(1e-10));
        }

        [Test]
        public void InverseTrigFunctions()
        {
            var asinResult = Engine.Evaluate("math.asin(0.5)");
            var acosResult = Engine.Evaluate("math.acos(1)");
            var atanResult = Engine.Evaluate("math.atan(1)");

            Assert.That(asinResult, Is.TypeOf<double>());
            Assert.That((double)asinResult, Is.EqualTo(System.Math.PI / 6).Within(1e-10));
            Assert.That(acosResult, Is.TypeOf<double>());
            Assert.That((double)acosResult, Is.EqualTo(0.0).Within(1e-10));
            Assert.That(atanResult, Is.TypeOf<double>());
            Assert.That((double)atanResult, Is.EqualTo(System.Math.PI / 4).Within(1e-10));
        }

        [Test]
        public void PowerAndClampReturnExpectedResults()
        {
            var pow = Engine.Evaluate("math.pow(2,3)");
            var clamp = Engine.Evaluate("math.clamp(10, 0, 5)");

            Assert.That(pow, Is.TypeOf<double>());
            Assert.That((double)pow, Is.EqualTo(8.0).Within(1e-10));

            Assert.That(System.Convert.ToDouble(clamp), Is.EqualTo(5.0).Within(1e-10));
        }

        [Test]
        public void AbsAndSignPreserveIntegerTypes()
        {
            var absResult = Engine.Evaluate("math.abs(-5)");
            var signResult = Engine.Evaluate("math.sign(-12)");

            Assert.That(System.Convert.ToDouble(absResult), Is.EqualTo(5.0).Within(1e-10));
            Assert.That(System.Convert.ToInt32(signResult), Is.EqualTo(-1));
        }

        [Test]
        public void MinAndMaxPromoteNumericType()
        {
            var minValue = Engine.Evaluate("math.min(5, 2.5, 10)");
            var maxValue = Engine.Evaluate("math.max(5, 20l, 10)");

            Assert.That(minValue, Is.TypeOf<double>());
            Assert.That((double)minValue, Is.EqualTo(2.5).Within(1e-10));

            Assert.That(System.Convert.ToInt64(maxValue), Is.EqualTo(20L));
        }

        [Test]
        public void RandomPiAndEValues()
        {
            var random = Engine.Evaluate("math.random()");
            var pi = Engine.Evaluate("math.pi");
            var e = Engine.Evaluate("math.e");

            Assert.That(random, Is.TypeOf<double>());
            Assert.That((double)random, Is.InRange(0.0, 1.0));

            Assert.That(pi, Is.TypeOf<double>());
            Assert.That((double)pi, Is.EqualTo(System.Math.PI).Within(1e-10));

            Assert.That(e, Is.TypeOf<double>());
            Assert.That((double)e, Is.EqualTo(System.Math.E).Within(1e-10));
        }
    }
}
