using global::FuncScript;
using global::FuncScript.Core;
using global::FuncScript.Model;
using NUnit.Framework;

namespace FuncScript.Test
{
    public class FloatFunctionTests
    {
        [Test]
        public void FloatProviderCollection_RegistersClassificationFunctions()
        {
            var provider = new DefaultFsDataProvider();

            var floatCollection = provider.Get("float") as KeyValueCollection;
            Assert.That(floatCollection, Is.Not.Null, "float collection should be exposed as a key-value collection");

            Assert.That(floatCollection!.IsDefined("isnormal"), Is.True);
            Assert.That(floatCollection.IsDefined("isnan"), Is.True);
            Assert.That(floatCollection.IsDefined("isinfinity"), Is.True);

            Assert.That(floatCollection.Get("isnormal"), Is.SameAs(provider.Get("isnormal")));
            Assert.That(floatCollection.Get("isnan"), Is.SameAs(provider.Get("isnan")));
            Assert.That(floatCollection.Get("isinfinity"), Is.SameAs(provider.Get("isinfinity")));
        }

        [TestCase(1.0, true)]
        [TestCase(double.Epsilon, false)] // subnormal
        [TestCase(0.0, false)]
        [TestCase(double.NegativeInfinity, false)]
        public void FloatIsNormal_ClassifiesCorrectly(double value, bool expected)
        {
            var provider = new DefaultFsDataProvider();
            var fn = provider.Get("isnormal") as IFsFunction;

            Assert.That(fn, Is.Not.Null);

            var result = fn!.Evaluate(new ArrayFsList(new object[] { value }));
            Assert.That(result, Is.TypeOf<bool>());
            Assert.That((bool)result, Is.EqualTo(expected));
        }

        [TestCase(double.NegativeInfinity, true)]
        [TestCase(double.PositiveInfinity, true)]
        [TestCase(5.0, false)]
        [TestCase(double.NaN, false)]
        public void FloatIsInfinity_ClassifiesCorrectly(double value, bool expected)
        {
            var provider = new DefaultFsDataProvider();
            var fn = provider.Get("isinfinity") as IFsFunction;

            Assert.That(fn, Is.Not.Null);

            var result = fn!.Evaluate(new ArrayFsList(new object[] { value }));
            Assert.That(result, Is.TypeOf<bool>());
            Assert.That((bool)result, Is.EqualTo(expected));
        }

        [TestCase(double.NaN, true)]
        [TestCase(42.0, false)]
        [TestCase(double.NegativeInfinity, false)]
        public void FloatIsNaN_ClassifiesCorrectly(double value, bool expected)
        {
            var provider = new DefaultFsDataProvider();
            var fn = provider.Get("isnan") as IFsFunction;

            Assert.That(fn, Is.Not.Null);

            var result = fn!.Evaluate(new ArrayFsList(new object[] { value }));
            Assert.That(result, Is.TypeOf<bool>());
            Assert.That((bool)result, Is.EqualTo(expected));
        }
    }
}
