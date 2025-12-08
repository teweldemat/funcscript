using global::FuncScript.Model;
using NUnit.Framework;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace FuncScript.Test
{
    delegate void VoidDelegate(int x);
    delegate int DelegateWithOut(int x, out int y);

    internal class KvcTests
    {
        private static FsError AssertIsFsError(object value, string reason = null)
        {
            Assert.That(value, Is.TypeOf<FsError>(), reason ?? "Expected evaluation to return FsError");
            return (FsError)value;
        }

        [Test]
        public void TestKvcSimple()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:3,c:5}");
            var expected = new ObjectKvc(new { a = 3, c = 5 });
            Assert.AreEqual(FuncScriptRuntime.FormatToJson(expected),  FuncScriptRuntime.FormatToJson(res));
        }

        [Test]
        public void TestKvcCrossRef()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:3,c:5,d:a*c}");
            var expected = new ObjectKvc(new { a = 3, c = 5, d = 15 });
            Assert.AreEqual(Engine.FormatToJson(expected),Engine.FormatToJson(res));
        }

        [Test]
        public void TestKvcReturn()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:3,c:5,d:a*c,return d}");
            var expected = 15;
            Assert.AreEqual(expected, res);
        }

        [Test]
        public void TestKvcEval()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:3,c:5,d:a*c,eval d}");
            var expected = 15;
            Assert.AreEqual(expected, res);
        }

        [Test]
        public void NestedEvalDoesNotLeakOuterMembers()
        {
            var exp =
@"{
    x:45;
    return {
        a:{b:3};
        eval a.x;
    };
}";
            var res = FuncScriptRuntime.Evaluate(exp);
            Assert.AreEqual(null, res);
        }

        [Test]
        public void TestKvcIdenOnly()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:4,b:5,c:6,return {a,c}}");
            var expected = new ObjectKvc(new { a = 4, c = 6 });
            Assert.AreEqual(FuncScriptRuntime.FormatToJson(expected), FuncScriptRuntime.FormatToJson(res));
        }

        [Test]
        public void TestKvcNameChanged()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:4,b:5,c:6,return {x:a,y:c}}");
            var expected = new ObjectKvc(new { x = 4, y = 6 });
            Assert.AreEqual(expected, res);
        }

        [Test]
        public void TestSelector()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:4,b:5,c:6}{a,c}");
            var expected = new ObjectKvc(new { a = 4, c = 6 });
            Assert.AreEqual(expected, res);
        }
        
        // [Test]
        // public void TestSelectorNovel()
        // {
        //     var g = new DefaultFsDataProvider();
        //     var res = FuncScriptRuntime.Evaluate(g, "{a:4}(a+1)");
        //     var expected = 5;
        //     Assert.AreEqual(expected, res);
        // }
        
        [Test]
        public void TestSelectorStackOverflowBug()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:4}{a:a}");
            var expected = new ObjectKvc(new { a = 4});
            Assert.AreEqual(Engine.FormatToJson(expected),Engine.FormatToJson(res));
        }
        [Test]
        public void TestSelectorStackOverflowBug2()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:4}{a:a+1}");
            var expected = new ObjectKvc(new { a = 5 });
            Assert.AreEqual(FuncScriptRuntime.FormatToJson(expected), FuncScriptRuntime.FormatToJson(res));
        }
        [Test]
        public void TestSelectorStackOverflowBug3()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:4}{a,b:5}");
            var expected = new ObjectKvc(new { a = 4,b=5 });
            Assert.AreEqual(FuncScriptRuntime.FormatToJson(expected), FuncScriptRuntime.FormatToJson(res));
        }

        [Test]
        public void TestSelector2()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:4,b:5,c:6}{'a',\"c\"}");
            var expected = new ObjectKvc(new { a = 4, c = 6 });
            Assert.AreEqual(expected, res);
        }

        [Test]
        public void TestSelectorChain()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:{id:3}}.a.id\r\n");
            var expected = 3;
            ;
            Assert.AreEqual(expected, res);
        }

        [Test]
        public void SelectorProjectionEqualityMatchesSource()
        {
            var exp =
@"{
    x:{
        a:{b:3,c:4};
        d:6;
    };
    y:x{a,d};
    eval x=y;
}";

            var res = FuncScriptRuntime.Evaluate(exp);
            Assert.AreEqual(true, res);
        }

        [Test]
        public void SelectorProjectionHandlesLargeKvcFromFile()
        {
            var dataPath = Path.Combine(TestContext.CurrentContext.TestDirectory, "data", "big-kvc.fs");
            var template = File.ReadAllText(dataPath);

            var exp =
$@"{{
    t:{template};
    a:t{{
        Type,
        Register,
        CaseId,
        OldStatus,
        Status,
        FirstRequestUserId,
        DataSubmitUserId,
        SpatialSubmitUserId,
        Actions,
        SourceLandRecords,
        TargetLandRecords,
        NewTitleDeeds,
        AllNewDocuments,
        AllNewBills,
        AllNewBillsPaid,
        AnyUnpaidBills,
        SpatialTasks,
        TaskId,
        Reference,
        Description,
        CreateTime,
        CreateCommandId,
        UpdateTime,
        UpdateCommandId
    }};
    eval a=t;
}}";

            var res = FuncScriptRuntime.Evaluate(exp);
            Assert.AreEqual(true, res);
        }

        [Test]
        public void FormatToJsonHandlesLargeKvcInUnderThreeSeconds()
        {
            var dataRoot = Path.Combine(TestContext.CurrentContext.TestDirectory, "data");

            Func<string, object> fetch = new Func<string, object>((uic) =>
            {
                var dataPath = Path.Combine(dataRoot, "fetch-data.fs");
                var expression = File.ReadAllText(dataPath);
                var result = FuncScriptRuntime.Evaluate(expression);
                return result;
            });
            
            var dataPath = Path.Combine(dataRoot, "big-kvc.fs");
            var expression = File.ReadAllText(dataPath);
            var result = FuncScriptRuntime.EvaluateWithVars(expression,new
            {
                fetchData=fetch
            });

            Assert.IsNotNull(result);

            // Warm up to exclude JIT and first-run allocations from the measurement.
            FuncScriptRuntime.FormatToJson(result);

            var sw = Stopwatch.StartNew();
            string formatted = null;
            for (var i = 0; i < 100; i++)
            {
                formatted = FuncScriptRuntime.FormatToJson(result);
            }

            sw.Stop();
            Assert.IsNotEmpty(formatted);
            Assert.Less(sw.Elapsed.TotalSeconds, 3, $"FormatToJson took {sw.Elapsed.TotalSeconds:F2}s");
        }
        
        [Test]
        public void FormatToJsonHandlesLargeKvcInEvaluatesAtMostTwice()
        {
            var dataRoot = Path.Combine(TestContext.CurrentContext.TestDirectory, "data");

            var evaluateCount = 0;
            Func<string, object> fetch = new Func<string, object>((uic) =>
            {
                var dataPath = Path.Combine(dataRoot, "fetch-data.fs");
                var expression = File.ReadAllText(dataPath);
                var result = FuncScriptRuntime.Evaluate(expression);
                evaluateCount++;
                Console.Write("Evaluate\n");
                return result;
            });
            
            var dataPath = Path.Combine(dataRoot, "big-kvc.fs");
            var expression = File.ReadAllText(dataPath);
            var result = FuncScriptRuntime.EvaluateWithVars(expression,new
            {
                fetchData=fetch
            });

            Assert.IsNotNull(result);

            // Warm up to exclude JIT and first-run allocations from the measurement.
            FuncScriptRuntime.FormatToJson(result);

            
            var    formatted = FuncScriptRuntime.FormatToJson(result);

            Assert.IsNotEmpty(formatted);
            Assert.Less(evaluateCount, 3, $"FormatToJson evaluated function more than 2 times");
        }

        [Test]
        public void TestKvcMergeDifferentParents()
        {
            var exp =
                @"{
  a:{
      aa:2;
      ab:3;
    };
  b:{
    c:{
      ca:6;
      cb:7;
    }
  };

  return a+b.c;
}";


            var res = FuncScriptRuntime.Evaluate(exp);
            var expected = new ObjectKvc(new {aa=2,ab=3,ca=6,cb=7}); ;
            Assert.AreEqual(FuncScriptRuntime.FormatToJson( expected), FuncScriptRuntime.FormatToJson(res));

        }
        
        [Test]
        public void TestLamdaContextChange()
        {
            var exp =
@"{
    a:
    {
      r:6;
      f:(x)=>r+x;
    };
  return a.f(2);
}";


            var res = FuncScriptRuntime.Evaluate(exp);
            var expected = 8;
            Assert.AreEqual(expected, res);

        }
        [Test]
        public void TestLamdaContextChange2()
        {
            var exp =
@"{
    a:
    {
      r:6;
      f:(x)=>r+x;
    };
    r:2;
    return a.f(2);
}";


            var res = FuncScriptRuntime.Evaluate(exp);
            var expected = 8;
            Assert.AreEqual(expected, res);

        }

        [Test]
        public void TestKvcLambdaWithoutColonSyntax()
        {
            var exp =
@"{
    add(x,y)=>x+y;
    double(n)=>add(n,n);
    eval double(5);
}";
            var res = FuncScriptRuntime.Evaluate(exp);
            Assert.AreEqual(10, res);
        }
        [Test]
        public void TestNakedKvcLambdaWithoutColonSyntax()
        {
            var exp =
                @"
    add(x,y)=>x+y;
    double(n)=>add(n,n);
    eval double(5);
";
            var res = FuncScriptRuntime.Evaluate(exp);
            Assert.AreEqual(10, res);
        }

        [Test]
        public void TestNestedKvcLambdaWithoutColon()
        {
            var exp =
@"{
    outer:{
        seed:4;
        grow(x)=>x+seed;
    };
    return outer.grow(3);
}";
            var res = FuncScriptRuntime.Evaluate(exp);
            Assert.AreEqual(7, res);
        }
        
        [Test]
        public void TestMapLambdaContextTest()
        {
            var exp =
                @"{
    a:2;
      return [4,5] map (x)=>x+a;
}";

            var res = FuncScriptRuntime.Evaluate(exp);
            var expected = new ArrayFsList(new int[]{6,7});
            Assert.AreEqual(expected, res);

        }

        [Test]
        public void TestSelectorOne()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:{id:3}}.a");
            var expected = new ObjectKvc(new {id=3}); ;
            Assert.AreEqual(FuncScriptRuntime.FormatToJson( expected), FuncScriptRuntime.FormatToJson(res));
        }

        [Test]
        public void TestSelectorWithExp()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:4,b:5,c:6} {a,c,z:45}");
            var expected = new ObjectKvc(new { a = 4, c = 6, z = 45 });
            Assert.AreEqual(FuncScriptRuntime.FormatToJson(expected), FuncScriptRuntime.FormatToJson(res));
        }

        [Test]
        public void TestFormatToJson()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{a:5,b:6}");
            var jsonStr = FuncScriptRuntime.FormatToJson(res);
            Assert.That(jsonStr.Replace(" ",""), Is.EqualTo( @"{""a"":5,""b"":6}"));

        }
    

    [Test]
        public void TestSelectorOnArray()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "[{a:4,b:5,c:6},{a:7,b:8,c:9}]\n{a,c}") as FsList;
            Assert.IsNotNull(res);
            Assert.That(res.Length,Is.EqualTo(2));
            var item1 = res[0] as KeyValueCollection;
            Assert.IsNotNull(item1);
            Assert.That(item1.Get("a"),Is.EqualTo(4));
            Assert.That(item1.Get("c"),Is.EqualTo(6));
            var item2 = res[1] as KeyValueCollection;
            Assert.IsNotNull(item2);
            Assert.That(item2.Get("a"),Is.EqualTo(7));
            Assert.That(item2.Get("c"),Is.EqualTo(9));

            var expected = new ArrayFsList(new object[]{new ObjectKvc(new { a = 4, c=6})
            ,new ObjectKvc(new { a = 7, c = 9})
            });
            Assert.AreEqual(FuncScriptRuntime.FormatToJson(expected), FuncScriptRuntime.FormatToJson(res));
        }
        [Test]
        public void ChainFunctionCall()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "((x)=>((y)=>3*y))(0)(2)");
            var expected = 6;
            Assert.AreEqual(expected, res);

        }
        [Test]
        public void DoubleMap()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, @"{
z:Map([1,2,3],(x)=>x*x),
return Map(z,(x)=>x*x);
}") as FsList;
            Assert.IsNotNull(res);
            var expected = new ArrayFsList(new object[] { 1, 16, 81 });

            Assert.AreEqual(expected.ToArray(), res.ToArray());
        }

        [Test]
        public void KvcMergeHeriarchy()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, @"{a:12,b:{c:10,z:10}}+{d:13,b:{c:12,x:5}}");
            var expected = new ObjectKvc(new { a = 12, d = 13, b = new { c = 12, z = 10, x = 5 } });

            Assert.AreEqual(expected, res);
        }
        [Test]
        public void KvcAdditionPrefersRightMostNestedValues()
        {
            var exp = "{y:{b:6;};}+{y:{b:7};}";
            var res = FuncScriptRuntime.Evaluate(exp);
            var expected = new ObjectKvc(new { y = new { b = 7 } });

            Assert.AreEqual(FuncScriptRuntime.FormatToJson(expected), FuncScriptRuntime.FormatToJson(res));
        }

        [Test]
        public void KvcAdditionReplacesListsWithRightMostValue()
        {
            var exp = "{x:[1,2]}+{x:[3]}";
            var res = FuncScriptRuntime.Evaluate(exp);
            var expected = FuncScriptRuntime.Evaluate("{x:[3]}");

            Assert.That(FuncScriptRuntime.FormatToJson(res), Is.EqualTo(FuncScriptRuntime.FormatToJson(expected)));
        }

        [Test]
        public void KvcAdditionMergesDeeplyNestedCollections()
        {
            var exp = "{a:{x:1,y:{z:2}},b:3}+{a:{x:10,y:{w:4}},c:5}";
            var res = FuncScriptRuntime.Evaluate(exp);
            var expected = new ObjectKvc(new
            {
                a = new
                {
                    x = 10,
                    y = new { z = 2, w = 4 }
                },
                b = 3,
                c = 5
            });

            Assert.That(FuncScriptRuntime.FormatToJson(res), Is.EqualTo(FuncScriptRuntime.FormatToJson(expected)));
        }

        [Test]
        public void KvcAdditionKeepsDeepChildrenWhileOverridingSiblings()
        {
            const string exp =
@"{
    base:{ torso:{ height:22; width:12 }; legs:{ left:{ upper:10; target:[1,2] }; right:{ target:[3,4] } } };
    overrides:{ legs:{ left:{ target:[9,9] }; right:{ upper:12 } }; torso:{ width:10 } };
    merged:base + overrides;
    eval merged;
}";

            var res = FuncScriptRuntime.Evaluate(exp);
            var expected = FuncScriptRuntime.Evaluate("{ torso:{ height:22; width:10 }; legs:{ left:{ upper:10; target:[9,9] }; right:{ target:[3,4]; upper:12 } } }");

            Assert.That(FuncScriptRuntime.FormatToJson(res), Is.EqualTo(FuncScriptRuntime.FormatToJson(expected)));
        }

        [Test]
        public void KvcAdditionDoesNotMutateLeftOperand()
        {
            const string exp =
@"{
    a:{x:5,y:7};
    b:a+{x:6};
    c:{x:5,y:7};
    eval a=c;
}";

            var res = FuncScriptRuntime.Evaluate(exp);

            Assert.That(res, Is.EqualTo(true));
        }

        [Test]
        public void KvcAdditionPrefersRightScalarOverLeftCollection()
        {
            var exp = "{a:{x:1,y:2}}+{a:5}";
            var res = FuncScriptRuntime.Evaluate(exp);
            Assert.That(res, Is.InstanceOf<KeyValueCollection>());
            var kvc = (KeyValueCollection)res;
            Assert.That(kvc.Get("a"), Is.EqualTo(5));
        }
        [Test]
        public void TestDelegate()
        {
            var vars = new
            {
                f = new Func<int, int>((x) => x + 1)
            };
            Assert.AreEqual(4, FuncScriptRuntime.EvaluateWithVars("f(3)", vars));
        }


        [Test]
        public void TestDelegateRejectOut()
        {
            var vars = new
            {
                f = new DelegateWithOut((int x, out int y) =>
                {
                    y = 2;
                    return x + 1;
                })
            };
            var result = FuncScriptRuntime.EvaluateWithVars("f(3)", vars);
            var fsError = AssertIsFsError(result);
            Assert.That(fsError.ErrorMessage, Does.Contain("output parameters not supported"));
        }
        [Test]
        public void TestDelegateRejectVoid()
        {
            var vars = new
            {
                f = new VoidDelegate((x) => { })
            };
            var result = FuncScriptRuntime.EvaluateWithVars("f(3)", vars);
            var fsError = AssertIsFsError(result);
            Assert.That(fsError.ErrorMessage, Does.Contain("Delegate with no return is not supported"));
        }
        [Test]
        public void ByteArray()
        {
            var bytes = new byte[] { 1, 2, 3 };
            var b = FuncScriptRuntime.EvaluateWithVars("x", new { x = bytes });
            Assert.AreEqual(bytes, b);
        }
        class XY
        {
            public string a { get; set; }
            public string b { get; set; }
        }
        [Test]
        public void TestJsonEquivalenceWithTextLineFeed()
        {
            var a = @"{
";
            var b = @"c
d";
            var x = new ObjectKvc(new { a, b });
            var sb = new StringBuilder();
            FuncScriptRuntime.Format(sb, null, null, false, true);
            var str = sb.ToString();
            var ret = Newtonsoft.Json.JsonConvert.DeserializeObject<XY>(str);
        }

        [Test]
        public void JsonEquivalenceFuzz()
        {
            var scenarios = new[]
            {
                "{ \"id\": 1, \"name\": \"FuncScript\" }",
                "{ \"numbers\": [1, 2, 3.5, -10], \"flag\": true, \"nothing\": null }",
                "{ \"nested\": { \"level1\": { \"level2\": { \"value\": \"deep\" } }, \"list\": [ { \"inner\": 1 }, { \"inner\": 2 } ] } }",
                "[ { \"a\": 1 }, { \"a\": 2, \"b\": [true, false, null] } ]",
                "{ \"text\": \"Line\\nFeed\\tTabbed\\\"Quote\\\"\", \"escaped\": \"\\\\backslash\" }",
                "{ \"mixed\": [1, \"two\", { \"three\": 3 }], \"emptyArray\": [], \"emptyObject\": {} }",
                "  {  \"spaced\"  :  {   \"value\" :   [1,2,3] } , \"bool\" : false }",
                "{ \"largeNumber\": 9223372036854775807, \"floating\": -12345.6789e2 }",
                "{ \"unicode\": \"Smiley \\u263A\", \"surrogate\": \"\\ud83d\\ude03\" }"
            };

            foreach (var json in scenarios)
            {
                AssertJsonEquivalent(json);
            }
        }
        [Test]
        public void TestListParse2()
        {
            var exp = @" [ [ 3, 4 ] , [ 5 , 6 ] ]";
            var expected = new ArrayFsList(new object[] { new ArrayFsList(new object[] { 3,4}) ,
                 new ArrayFsList(new object[] { 5, 6 }) });
            var res = FuncScriptRuntime.Evaluate(exp) as FsList;
            Assert.NotNull(res);
            Assert.AreEqual(expected, res);
        }
        [Test]
        public void TestListParse3()
        {
            var exp = " \n [ \n [ \n 3 \n , \n 4 \n ] \n , \n [ \n 5 \n , \n 6 \n ] \n ] \n ";
            var expected = new ArrayFsList(new object[] { new ArrayFsList(new object[] { 3,4}) ,
                 new ArrayFsList(new object[] { 5, 6 }) });
            var res = FuncScriptRuntime.Evaluate(exp) as FsList;
            Assert.NotNull(res);
            Assert.AreEqual(expected, res);
        }
        [Test]
        public void FromJson1()
        {
            string json = "{x:1}";
            var expected = new ObjectKvc(new { x = 1 });

            var res = FuncScriptRuntime.FromJson(json);

            Assert.AreEqual(Engine.FormatToJson(expected),Engine.FormatToJson(res));
        }

        [Test]
        [TestCase("5", 5)]
        [TestCase("5.0", 5.0)]
        [TestCase("'5'", "5")]
        public void FromJsonAtomic(string json, object expected)
        {
            var res = FuncScriptRuntime.FromJson(json);
            Assert.AreEqual(expected, res);
        }
        [Test]
        [TestCase("5", "5")]
        [TestCase("5.0", "5.0")]

        [TestCase("'5'", "'5'")]
        [TestCase("'5'", "\"5\"")]
        [TestCase("'{5'", @"'{5'")]
        [TestCase("{x:1,y:2}", "{x:1,y:2}")]
        [TestCase("{x:[1,2],y:2}", "{x:[1,2],y:2}")]
        [TestCase("{x:[1,2,'3'],y:2}", "{x:[1,2,'3'],y:2}")]
        [TestCase("9223372036854775807", "9223372036854775807")]
        public void FromJsonFs(string json, string fs)
        {
            var res = FuncScriptRuntime.FromJson(json);
            var expected = FuncScriptRuntime.Evaluate(fs);
            Assert.AreEqual( FuncScriptRuntime.FormatToJson( expected), FuncScriptRuntime.FormatToJson(res));
        }
        [Test]
        public void ObjectKvRetailCases()
        {
            var obj = new ObjectKvc(new { AbC = "123" });
            var sb = new StringBuilder();
            FuncScriptRuntime.Format(sb, obj, null, false, true);
            Assert.IsTrue(FuncScriptRuntime.FormatToJson(sb).Contains("AbC"));

        }
        [Test]
        public void IndexKvcSensitivyBug()
        {
            var exp = @"{
'A':5
}['A']";
            var res = FuncScriptRuntime.Evaluate(exp);
            Assert.AreEqual(5, res);  
        }
        [Test]
        public void IndexKvcSensitivyBug2()
        {
            var exp = @"{
'A':5
}['a']";
            var res = FuncScriptRuntime.Evaluate(exp);
            Assert.AreEqual(5, res);  
        }
        [Test]
        public void TestKeyWordMixup()
        {
            var g = new DefaultFsDataProvider();
            var res = FuncScriptRuntime.Evaluate(g, "{ null1:5; y:null1;}");
            var expected = new ObjectKvc(new { null1 = 5, y = 5 });
            Assert.AreEqual(FuncScriptRuntime.FormatToJson(expected),  FuncScriptRuntime.FormatToJson(res));
        }
        
        [Test]
        public void KvcAddition()
        {
            var exp = "{a:5}+{b:6}";
            var res = FuncScriptRuntime.Evaluate( exp);
            var expected = new ObjectKvc(new { a = 5, b = 6 });
            Assert.AreEqual(FuncScriptRuntime.FormatToJson(expected),  FuncScriptRuntime.FormatToJson(res));
        }

        private static void AssertJsonEquivalent(string json)
        {
            using var document = JsonDocument.Parse(json);
            var expected = document.RootElement.Clone();
            var actual = Engine.Evaluate(json);
            AssertJsonElementEquivalent(expected, actual, "root");
        }

        private static void AssertJsonElementEquivalent(JsonElement expected, object actual, string path)
        {
            switch (expected.ValueKind)
            {
                case JsonValueKind.Object:
                    Assert.That(actual, Is.InstanceOf<KeyValueCollection>(), $"{path}: expected object but found {Describe(actual)}");
                    var kvc = (KeyValueCollection)actual;
                    var actualProperties = kvc
                        .GetAll()
                        .ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.OrdinalIgnoreCase);
                    Assert.AreEqual(expected.EnumerateObject().Count(), actualProperties.Count, $"{path}: property count mismatch");
                    foreach (var property in expected.EnumerateObject())
                    {
                        Assert.IsTrue(actualProperties.TryGetValue(property.Name, out var value), $"{path}: missing property {property.Name}");
                        AssertJsonElementEquivalent(property.Value, value, $"{path}.{property.Name}");
                    }
                    break;
                case JsonValueKind.Array:
                    Assert.That(actual, Is.InstanceOf<FsList>(), $"{path}: expected array but found {Describe(actual)}");
                    var list = (FsList)actual;
                    var expectedItems = expected.EnumerateArray().ToArray();
                    Assert.AreEqual(expectedItems.Length, list.Length, $"{path}: array length mismatch");
                    for (var i = 0; i < expectedItems.Length; i++)
                    {
                        AssertJsonElementEquivalent(expectedItems[i], list[i], $"{path}[{i}]");
                    }
                    break;
                case JsonValueKind.String:
                    Assert.That(actual, Is.InstanceOf<string>(), $"{path}: expected string but found {Describe(actual)}");
                    var actualString = (string)actual;
                    Assert.AreEqual(expected.GetString(), actualString, $"{path}: string mismatch");
                    break;
                case JsonValueKind.Number:
                    AssertNumberEquivalent(expected, actual, path);
                    break;
                case JsonValueKind.True:
                case JsonValueKind.False:
                    Assert.That(actual, Is.InstanceOf<bool>(), $"{path}: expected boolean but found {Describe(actual)}");
                    var actualBool = (bool)actual;
                    Assert.AreEqual(expected.ValueKind == JsonValueKind.True, actualBool, $"{path}: boolean mismatch");
                    break;
                case JsonValueKind.Null:
                case JsonValueKind.Undefined:
                    Assert.IsNull(actual, $"{path}: expected null but found {Describe(actual)}");
                    break;
                default:
                    Assert.Fail($"{path}: unsupported JSON value kind {expected.ValueKind}");
                    break;
            }
        }

        private static void AssertNumberEquivalent(JsonElement expected, object actual, string path)
        {
            if (actual is int actualInt)
            {
                Assert.IsTrue(expected.TryGetInt64(out var expectedLong), $"{path}: JSON number not convertible to integer");
                Assert.AreEqual(expectedLong, actualInt, $"{path}: integer mismatch");
                return;
            }

            if (actual is long actualLong)
            {
                Assert.IsTrue(expected.TryGetInt64(out var expectedLong), $"{path}: JSON number not convertible to integer");
                Assert.AreEqual(expectedLong, actualLong, $"{path}: long mismatch");
                return;
            }

            if (actual is double actualDouble)
            {
                var expectedDouble = expected.GetDouble();
                Assert.AreEqual(expectedDouble, actualDouble, 1e-9, $"{path}: double mismatch");
                return;
            }

            Assert.Fail($"{path}: unsupported numeric type {Describe(actual)}");
        }

        private static string Describe(object value) => value == null ? "null" : value.GetType().FullName ?? value.GetType().Name;
    }

}
