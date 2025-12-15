using FuncScript.Model;
using Newtonsoft.Json;
using NUnit.Framework;
using System.Collections.Generic;
using System.Linq;

namespace FuncScript.Test
{
    [TestFixture]
    public class FormatToJsonIntegrityTests
    {
        [Test]
        public void FormatToJsonMatchesNewtonsoftForSimpleObject()
        {
            var payload = new { x = 3, y = 5 };
            var obj = new ObjectKvc(payload);
            AssertFormatMatchesNewtonsoft(obj, payload);
        }
        

        [Test]
        public void FormatToJsonMatchesNewtonsoftForNestedObjectWithList()
        {
            var payload = new
            {
                id = 42,
                name = "sample",
                nested = new { flag = true, count = 3 },
                values = new[] { 1, 2, 3 }
            };
            var obj = new ObjectKvc(payload);
            AssertFormatMatchesNewtonsoft(obj, payload);
        }

        [Test]
        public void FormatToJsonMatchesNewtonsoftForSimpleKeyValueCollection()
        {
            var list = FuncScriptRuntime.NormalizeDataType(new[] { "x", "y" });
            var kv = new SimpleKeyValueCollection(new[]
            {
                new KeyValuePair<string, object>("alpha", 1),
                new KeyValuePair<string, object>("beta", list),
                new KeyValuePair<string, object>("nested", new ObjectKvc(new { inner = "z" }))
            });

            var expected = new
            {
                alpha = 1,
                beta = new[] { "x", "y" },
                nested = new { inner = "z" }
            };

            AssertFormatMatchesNewtonsoft(kv, expected);
        }

        private static void AssertFormatMatchesNewtonsoft(object value, object expectedJsonSource = null)
        {
            var result = FuncScriptRuntime.EvaluateWithVars("x", new { x = value });
            var fsJson = FuncScriptRuntime.FormatToJson(result);
            var comparisonSource = expectedJsonSource ?? value;
            if (comparisonSource is ObjectKvc objectKvc)
                comparisonSource = objectKvc.GetUnderlyingValue();
            var nsJson = JsonConvert.SerializeObject(comparisonSource);
            Assert.That(NormalizeJson(fsJson), Is.EqualTo(NormalizeJson(nsJson)));
        }

        private static string NormalizeJson(string json) =>
            new string(json.Where(c => !char.IsWhiteSpace(c)).ToArray());
    }
}
