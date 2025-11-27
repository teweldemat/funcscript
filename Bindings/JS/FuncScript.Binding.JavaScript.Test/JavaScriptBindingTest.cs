using System.Collections.Generic;
using FuncScript.Binding.JavaScript;
using FuncScript.Core;
using FuncScript.Model;
using NUnit.Framework;

namespace FuncScript.Binding.JavaScript.Test
{
    [TestFixture]
    public class JavaScriptBindingTest
    {
        [OneTimeSetUp]
        public void RegisterBinding()
        {
            Engine.LoadLanguageBindingsFromAssembly(typeof(JavaScriptLanguageBinding).Assembly);
        }

        [Test]
        public void JavaScriptBindingEvaluatesExpression()
        {
            var provider = new SimpleKeyValueCollection(null, new[]
            {
                new KeyValuePair<string, object>("value", 10)
            });

            var expression = "```javascript\nreturn value + 5;\n```";
            var result = Engine.Evaluate(provider, expression);

            Assert.That(result, Is.EqualTo(15));
        }

        [Test]
        public void JavaScriptBindingReturnsKeyValueCollection()
        {
            var provider = new SimpleKeyValueCollection(null, new[]
            {
                new KeyValuePair<string, object>("items", new ArrayFsList(new object[] { 1, 2, 3 }))
            });

            var expression = """
```javascript
const doubled = (items || []).map(x => x * 2);
return {
    count: doubled.length,
    values: doubled
};
```
""";

            var evaluated = Engine.Evaluate(provider, expression);
            var result = evaluated as KeyValueCollection;
            Assert.That(result, Is.Not.Null);
            Assert.That(result.Get("count"), Is.EqualTo(3));
            var values = result.Get("values") as FsList;
            Assert.That(values, Is.Not.Null);
            Assert.That(values[0], Is.EqualTo(2));
            Assert.That(values[1], Is.EqualTo(4));
            Assert.That(values[2], Is.EqualTo(6));
        }

        [Test]
        public void JavaScriptBindingReportsRuntimeErrors()
        {
            var provider = new SimpleKeyValueCollection(null, new[]
            {
                new KeyValuePair<string, object>("value", 1)
            });

            var expression = "```javascript\nthrow new Error('boom');\n```";
            var result = Engine.Evaluate(provider, expression);

            Assert.That(result, Is.InstanceOf<FsError>());
            Assert.That(((FsError)result).ErrorMessage, Does.Contain("Runtime error"));
        }

        [Test]
        public void JavaScriptBindingReportsCompileErrors()
        {
            var provider = new SimpleKeyValueCollection(null, new KeyValuePair<string, object>[0]);
            var expression = "```javascript\nreturn provider.;\n```";

            var result = Engine.Evaluate(provider, expression);

            Assert.That(result, Is.InstanceOf<FsError>());
            Assert.That(((FsError)result).ErrorMessage, Does.Contain("Compile error"));
        }
        [Test]
        public void JavaScriptBindingEvaluateUsingDefaultProvider()
        {
            var expression = """
```javascript
return {
    x: 3,
    y: 5
};
```
""";

            var evaluated = Engine.Evaluate(expression);

            var result = evaluated as KeyValueCollection;
            Assert.That(result, Is.Not.Null);
            Assert.That(result.Get("x"), Is.EqualTo(3));
            Assert.That(result.Get("y"), Is.EqualTo(5));
        }

        [Test]
        public void JavaScriptBindingReturnsArrayFromJavaScriptBlock()
        {
            var expression = """
                             {
                             x:```javascript
                             return [-5,0];
                             ```;
                             }
                             """;

            var evaluated = Engine.Evaluate(expression);
            Assert.That(evaluated, Is.AssignableTo<KeyValueCollection>());
            var result = (KeyValueCollection)evaluated;
            var xValue = result.Get("x");
            Assert.That(xValue, Is.AssignableTo<FsList>());
            var list = (FsList)xValue;
            Assert.That(list[0], Is.EqualTo(-5));
            Assert.That(list[1], Is.EqualTo(0));
        }

        [Test]
        public void JavaScriptBindingFunctionCanBeCalledFromFuncScript()
        {
            var expression = """
{
f:```javascript
return function (a){return a*a;};
```;
eval f(5)
}
""";

            var result = Engine.Evaluate(expression);

            Assert.That(result, Is.EqualTo(25));
        }
        
        [Test]
        public void JavaScriptBindingFunctionRetainsContext()
        {
            var expression = """
                             {
                             r:3;
                             f:```javascript
                             return function (a){return a*r;};
                             ```;
                             eval f(5)
                             }
                             """;

            var result = Engine.Evaluate(expression);

            Assert.That(result, Is.EqualTo(15));
        }
        
        [Test]
        public void JavaScriptBindingFunctionRetainsContextMultipleCalls()
        {
            var expression = """
                             {
                             r:3;
                             f:```javascript
                             return function (a){return a*r;};
                             ```;
                             }
                             """;

            var result = Engine.Evaluate(expression);
            Assert.That(result,Is.AssignableTo<KeyValueCollection>());
            var kvc = (KeyValueCollection)result;
            var _f = kvc.Get("f");
            Assert.That(_f,Is.AssignableTo<IFsFunction>());
            var f = (IFsFunction)_f;
            var res = f.Evaluate(new ArrayFsList(new[] { 5 }));
            Assert.That(res, Is.EqualTo(15));
            
            res = f.Evaluate(new ArrayFsList(new[] { 8 }));
            Assert.That(res, Is.EqualTo(24));
        }
        
        [Test]
        public void JavaScriptBindingNestedFunctionRetainsContextMultipleCalls()
        {
            var expression = """
                             (s)=>{
                             r:s.m;
                             f:```javascript
                             return function (a)
                             {
                                return a*r;
                             };
                             ```;
                             eval f;
                             }
                             """;

            var result = Engine.Evaluate(expression);
            Assert.That(result,Is.AssignableTo<IFsFunction>());
            var f = (IFsFunction)result;
            var _inner = f.Evaluate(new ArrayFsList(new object[] { new ObjectKvc(new { m = 10 }) }));
            Assert.That(_inner,Is.AssignableTo<IFsFunction>());
            var inner = (IFsFunction)_inner;
            var res = inner.Evaluate(new ArrayFsList(new[] { 5 }));
            Assert.That(res, Is.EqualTo(50));
            
            res = inner.Evaluate(new ArrayFsList(new[] { 8 }));
            Assert.That(res, Is.EqualTo(80));
        }

        [Test]
        public void JavaScriptBindingFunctionCanCallAnotherJavaScriptFunction()
        {
            var expression = """
                             {
                             funcs:```javascript
                             const f = a => a * 2;
                             const g = b => f(b) + 5;
                             return { f, g };
                             ```;
                             eval funcs;
                             }
                             """;

            var result = Engine.Evaluate(expression);
            Assert.That(result, Is.AssignableTo<KeyValueCollection>());
            var functions = (KeyValueCollection)result;

            var fFunc = functions.Get("f");
            var gFunc = functions.Get("g");
            Assert.That(fFunc, Is.AssignableTo<IFsFunction>());
            Assert.That(gFunc, Is.AssignableTo<IFsFunction>());

            var f = (IFsFunction)fFunc;
            var g = (IFsFunction)gFunc;

            var fResult = f.Evaluate(new ArrayFsList(new object[] { 4 }));
            Assert.That(fResult, Is.EqualTo(8));

            var gResult = g.Evaluate(new ArrayFsList(new object[] { 4 }));
            Assert.That(gResult, Is.EqualTo(13));

            gResult = g.Evaluate(new ArrayFsList(new object[] { 7 }));
            Assert.That(gResult, Is.EqualTo(19));
        }

        [Test]
        public void JavaScriptBindingFunctionsAcrossBlocksCanCallEachOther()
        {
            var expression = """
                             {
                             f:```javascript
                             return function (a) { return a * 2; };
                             ```;
                             g:```javascript
                             return function (b) { return f(b) + 5; };
                             ```;
                             }
                             """;

            var result = Engine.Evaluate(expression);
            Assert.That(result, Is.AssignableTo<KeyValueCollection>());
            var functions = (KeyValueCollection)result;

            var fValue = functions.Get("f");
            var gValue = functions.Get("g");
            Assert.That(fValue, Is.AssignableTo<IFsFunction>());
            Assert.That(gValue, Is.AssignableTo<IFsFunction>());

            var f = (IFsFunction)fValue;
            var g = (IFsFunction)gValue;

            var fResult = f.Evaluate(new ArrayFsList(new object[] { 6 }));
            Assert.That(fResult, Is.EqualTo(12));

            var gResult = g.Evaluate(new ArrayFsList(new object[] { 4 }));
            Assert.That(gResult, Is.EqualTo(13));

            gResult = g.Evaluate(new ArrayFsList(new object[] { 9 }));
            Assert.That(gResult, Is.EqualTo(23));
        }

        [Test]
        public void JavaScriptBindingFunctionReturnsObjectFromNestedFunction()
        {
            var expression = """
                             {
                             g:```javascript
                             function f(x)
                             {
                               return {
                                 h:x
                               };
                             }
                             return f;
                             ```;
                             eval g(3)
                             }
                             """;

            var result = Engine.Evaluate(expression);
            Assert.That(result, Is.AssignableTo<KeyValueCollection>());
            var kvc = (KeyValueCollection)result;
            Assert.That(kvc.Get("h"), Is.EqualTo(3));
        }
        [Test]
        public void KvcNestedFunctionInJsContextTest()
        {
            var expression = """
                             c:
                             {
                             a:45;
                             b:(x)=>x*2;
                             };
                             
                             eval ```javascript
                               return c.b(45)
                             ```
                             """;

            var result = Engine.Evaluate(expression);
            Assert.That(result, Is.EqualTo(90));
        }
    }
}
