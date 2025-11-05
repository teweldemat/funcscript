using global::FuncScript.Model;
using NUnit.Framework;
using System;
using System.Linq;
using System.Text;

namespace FuncScript.Test
{
    delegate void VoidDelegate(int x);
    delegate int DelegateWithOut(int x, out int y);

    internal class KvcTests
    {
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
            Assert.AreEqual(expected, res);
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
            Assert.AreEqual(expected, res);
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
            Assert.Throws(typeof(Error.TypeMismatchError)
                , () =>
                {
                    var vars = new
                    {
                        f = new DelegateWithOut((int x, out int y) =>
                        {
                            y = 2;
                            return x + 1;
                        }
                        )
                    };
                    var ret = FuncScriptRuntime.EvaluateWithVars("f(3)", vars);
                });
        }
        [Test]
        public void TestDelegateRejectVoid()
        {
            Assert.Throws(typeof(Error.TypeMismatchError)
                , () =>
                {
                    var vars = new
                    {
                        f = new VoidDelegate((x) => { })
                    };
                    var ret = FuncScriptRuntime.EvaluateWithVars("f(3)", vars);
                });
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
            String a;
            String b;
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

            Assert.AreEqual(expected, res);
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
    }

}
