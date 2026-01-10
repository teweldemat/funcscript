use funcscript_core::vm::VM;
use funcscript_core::value::Value;
use funcscript_core::obj::Obj;
use funcscript_core::host;
use std::rc::Rc;
use uuid::Uuid;
use std::path::PathBuf;

fn eval(source: &str) -> Value {
    let mut vm = VM::new();
    vm.interpret(source).expect("interpret should succeed")
}

fn s(text: &str) -> Value {
    Value::Obj(Rc::new(Obj::String(text.to_string())))
}

fn i(n: i64) -> Value {
    Value::Int(n)
}

#[test]
fn if_expression_works() {
    assert_eq!(eval("If(true, 10, 20)"), i(10));
    assert_eq!(eval("If(false, 10, 20)"), i(20));
}

#[test]
fn if_then_else_keyword_form_works() {
    assert_eq!(eval("if 1 < 2 then 10 else 20"), i(10));
    assert_eq!(eval("if 1 > 2 then 10 else 20"), i(20));
}

#[test]
fn naked_kvc_root_works() {
    assert_eq!(eval("a:1; b:2; eval a+b"), i(3));
}

#[test]
fn selector_item_sugar_works() {
    let exp = "{person:{name:'Alice',age:30,extra:true}, person {name,age}}";
    assert_eq!(eval(format!("{exp}.person.name").as_str()), s("Alice"));
    assert_eq!(eval(format!("{exp}.person.age").as_str()), i(30));
    assert_eq!(eval(format!("{exp}.person.extra").as_str()), Value::Bool(true));
}

#[test]
fn case_expression_works() {
    assert_eq!(eval("case 1=2:10, true:20, 30"), i(20));
    assert_eq!(eval("case false:10, false:20, 30"), i(30));
}

#[test]
fn switch_expression_works() {
    assert_eq!(eval("switch 2, 1:10, 2:20, 30"), i(20));
    assert_eq!(eval("switch 3, 1:10, 2:20, 30"), i(30));
}

#[test]
fn keyword_operators_work() {
    assert_eq!(eval("true and false"), Value::Bool(false));
    assert_eq!(eval("true or false"), Value::Bool(true));
    assert_eq!(eval("nil and nil"), Value::Nil);
    assert_eq!(eval("nil or nil"), Value::Nil);
    assert_eq!(eval("2 in [1,2,3]"), Value::Bool(true));
    assert_eq!(eval("4 in [1,2,3]"), Value::Bool(false));
    assert_eq!(eval("nil in [2,nil]"), Value::Bool(false));
}

#[test]
fn safe_member_access_works() {
    assert_eq!(eval("nil?.a"), Value::Nil);
    assert_eq!(eval("{a:1}?.a"), i(1));
}

#[test]
fn null_coalesce_and_eval_if_not_null_work() {
    assert_eq!(eval("nil ?? 5"), i(5));
    assert_eq!(eval("false ?? 5"), Value::Bool(false));
    assert_eq!(eval("nil ?? nil ?? 5"), i(5));

    assert_eq!(eval("nil ?! 10"), Value::Nil);
    assert_eq!(eval("5 ?! (5*200)"), i(1000));
    // short-circuit: RHS should not run
    assert_eq!(eval("nil ?! file('definitely-does-not-exist')"), Value::Nil);
}

#[test]
fn map_operator_works() {
    assert_eq!(eval("nil map (x)=>x"), Value::Nil);
    assert_eq!(eval("[4,5] map (x)=>x+2"), Value::Obj(Rc::new(Obj::List(vec![i(6), i(7)]))));
    let exp = r#"{
        a:2;
        return [4,5] map (x)=>x+a;
    }"#;
    assert_eq!(eval(exp), Value::Obj(Rc::new(Obj::List(vec![i(6), i(7)]))));
}

#[test]
fn reduce_works_prefix_and_infix() {
    assert_eq!(eval("reduce([4,5,6],(s,x)=>s+x)"), i(15));
    assert_eq!(eval("reduce([4,5,6],(s,x)=>s+x,-2)"), i(13));
    assert_eq!(eval("[4,5,6] reduce (s,x)=>s+x ~ -2"), i(13));
}

#[test]
fn template_strings_work() {
    assert_eq!(eval(r#"f"hi {1+2}""#), s("hi 3"));
    assert_eq!(eval(r#"f'X{ "a" + "b" }Y'"#), s("XabY"));
    assert_eq!(eval("f\"{nil}\""), s("nil"));
}

#[test]
fn math_and_comparisons_work() {
    assert_eq!(eval("1 + 2 * 3"), i(7));
    assert_eq!(eval("10 / 2 + 1"), i(6));
    assert_eq!(eval("1 < 2"), Value::Bool(true));
    assert_eq!(eval("2 <= 2"), Value::Bool(true));
    assert_eq!(eval("2 <= 3"), Value::Bool(true));
    assert_eq!(eval("3 <= 2"), Value::Bool(false));
    assert_eq!(eval("2 >= 2"), Value::Bool(true));
    assert_eq!(eval("3 >= 2"), Value::Bool(true));
    assert_eq!(eval("2 >= 3"), Value::Bool(false));
    assert_eq!(eval("1 == 1"), Value::Bool(true));
    assert_eq!(eval("1 != 2"), Value::Bool(true));
    assert_eq!(eval("1 != 1"), Value::Bool(false));
}

#[test]
fn math_provider_and_pow_work() {
    let pi = eval("math.Pi");
    match pi {
        Value::Number(n) => assert!((n - std::f64::consts::PI).abs() < 1e-12),
        other => panic!("expected number, got {other}"),
    }
    assert_eq!(eval("Pow(2,3)"), Value::Number(8.0));
    assert_eq!(eval("2 ^ 3"), Value::Number(8.0));
    assert_eq!(eval("math.Pow(2,3)"), Value::Number(8.0));
    assert_eq!(eval("math.Round(2.4)"), Value::Number(2.0));
}

#[test]
fn div_and_modulo_work() {
    assert_eq!(eval("10 div 3"), i(3));
    assert_eq!(eval("10 div 2"), i(5));
    assert_eq!(eval("10 % 3"), i(1));
    assert_eq!(eval("10 % 2"), i(0));
    assert_eq!(eval("10.5 % 2"), Value::Number(0.5));
}

#[test]
fn not_operator_is_boolean_only() {
    assert_eq!(eval("not true"), Value::Bool(false));
    assert_eq!(eval("!false"), Value::Bool(true));
    let mut vm = VM::new();
    assert!(vm.interpret("not nil").is_err());
}

#[test]
fn lists_work() {
    assert_eq!(eval("[1, 2, 3]"), Value::Obj(Rc::new(Obj::List(vec![
        i(1),
        i(2),
        i(3),
    ]))));

    assert_eq!(eval("Len([1,2,3])"), i(3));
    assert_eq!(eval("First([9,8,7])"), i(9));
}

#[test]
fn huge_range_does_not_allocate_list() {
    assert_eq!(eval("Len(Range(0, 1000000000))"), i(1000000000));
}

#[test]
fn maps_and_property_access_work() {
    assert_eq!(eval("{a: 1, b: 2}.a"), i(1));
    assert_eq!(eval("{a: 1, b: 2}.b"), i(2));
    assert_eq!(eval("{a: 1, b: 2}.missing"), Value::Nil);
    assert_eq!(eval("Len({a: 1, b: 2})"), i(2));
}

#[test]
fn kvc_addition_merges_nested_kvcs() {
    assert_eq!(eval("({a:12,b:{c:10,z:10}}+{d:13,b:{c:12,x:5}}).a"), i(12));
    assert_eq!(eval("({a:12,b:{c:10,z:10}}+{d:13,b:{c:12,x:5}}).d"), i(13));
    assert_eq!(eval("({a:12,b:{c:10,z:10}}+{d:13,b:{c:12,x:5}}).b.c"), i(12));
    assert_eq!(eval("({a:12,b:{c:10,z:10}}+{d:13,b:{c:12,x:5}}).b.z"), i(10));
    assert_eq!(eval("({a:12,b:{c:10,z:10}}+{d:13,b:{c:12,x:5}}).b.x"), i(5));
}

#[test]
fn kvc_addition_replaces_lists_with_rightmost_value() {
    assert_eq!(eval("({x:[1,2]}+{x:[3]}).x[0]"), i(3));
    assert_eq!(eval("Len(({x:[1,2]}+{x:[3]}).x)"), i(1));
}

#[test]
fn kvc_addition_prefers_right_scalar_over_left_collection() {
    assert_eq!(eval("({a:{x:1,y:2}}+{a:5}).a"), i(5));
}

#[test]
fn kvc_addition_does_not_mutate_left_operand_semantically() {
    let exp = r#"{
        a:{x:5,y:7};
        b:a+{x:6};
        c:{x:5,y:7};
        eval a=c;
    }"#;
    assert_eq!(eval(exp), Value::Bool(true));
}

#[test]
fn native_functions_work() {
    assert_eq!(eval("Abs(-5)"), i(5));
    assert_eq!(eval("Max(2, 9)"), i(9));
    assert_eq!(eval("Min(2, 9)"), i(2));
    assert_eq!(eval("Sqrt(9)"), Value::Number(3.0));

    assert_eq!(eval("Len(Range(3, 4))"), i(4));
    assert_eq!(eval("Range(3, 4)[0]"), i(3));
    assert_eq!(eval("Range(3, 4)[3]"), i(6));

    assert_eq!(eval("Sum(Range(1,5))"), i(15));
    assert_eq!(eval("SumApprox(Range(1,5))"), Value::Number(15.0));
}

#[test]
fn change_type_supports_guid_datetime_and_bytearray() {
    let guid = eval("ChangeType('00000000-0000-0000-0000-000000000000','Guid')");
    assert_eq!(guid, Value::Obj(Rc::new(Obj::Guid(Uuid::nil()))));

    let ticks = 637134336000000000i64;
    let dt = eval(&format!("ChangeType({ticks}l,'DateTime')"));
    assert_eq!(dt, Value::Obj(Rc::new(Obj::DateTimeTicks(ticks))));

    let bytes = eval("ChangeType('AQID','ByteArray')");
    assert_eq!(bytes, Value::Obj(Rc::new(Obj::Bytes(vec![1, 2, 3]))));
}

#[test]
fn sum_of_huge_range_is_approx_only() {
    assert_eq!(
        eval("Sum(Range(1, 1000000000))").to_string(),
        "500000000500000000".to_string()
    );
    match eval("SumApprox(Range(1, 1000000000))") {
        Value::Number(n) => {
            let expected = 500000000500000000.0f64;
            assert!((n - expected).abs() < 1.0e6);
        }
        other => panic!("expected number, got {other}"),
    }
}

#[test]
fn lambdas_can_be_called_and_use_parameters() {
    assert_eq!(eval("((x)=> x + 1)(2)"), i(3));
    assert_eq!(eval("((x,y)=> x * y)(3,4)"), i(12));
}

#[test]
fn strings_concatenate_with_plus() {
    assert_eq!(eval(r#""a" + "b""#), s("ab"));
    assert_eq!(eval(r#"3 + "cool""#), s("3cool"));
    assert_eq!(eval(r#""cool" + 4"#), s("cool4"));
    assert_eq!(eval(r#"Len("hello")"#), i(5));
    assert_eq!(eval(r#"First("hello")"#), s("h"));
}

#[test]
fn calling_lambda_with_missing_args_pads_nil_like_csharp() {
    // C# allows calling with fewer args; missing params become null (nil).
    // In that case the parameter name is still considered "defined" and shadows outer bindings.
    assert_eq!(
        eval(r#"{ name: "Esubalew"; say_hello: (name) => "Hello " + name; eval say_hello(); }"#),
        s("Hello ")
    );
}

#[test]
fn text_functions_work() {
    assert_eq!(eval(r#"lower(" HeLLo ")"#), s(" hello "));
    assert_eq!(eval(r#"upper("HeLLo")"#), s("HELLO"));
    assert_eq!(eval(r#"endswith("hello","lo")"#), Value::Bool(true));
    assert_eq!(eval(r#"endswith("hello",nil)"#), Value::Bool(false));

    assert_eq!(eval(r#"substring("hello", 1, 3)"#), s("ell"));
    assert_eq!(eval(r#"substring("hello", 99, 3)"#), s(""));

    assert_eq!(eval(r#"find("hello","ll")"#), i(2));
    assert_eq!(eval(r#"find("hello","zz")"#), i(-1));

    assert_eq!(eval(r#"isBlank(nil)"#), Value::Bool(true));
    assert_eq!(eval(r#"isBlank("   ")"#), Value::Bool(true));
    assert_eq!(eval(r#"isBlank(" x ")"#), Value::Bool(false));

    assert_eq!(eval(r#"[ "a", nil, "b" ] join ",""#), s("a,b"));
    assert_eq!(eval(r#"join(["a","b"],"-")"#), s("a-b"));
    assert_eq!(eval(r#"Range(1,3) join ":""#), s("1:2:3"));
}

#[test]
fn list_functions_work() {
    assert_eq!(eval("Take([1,2,3], 2)"), Value::Obj(Rc::new(Obj::List(vec![i(1), i(2)]))));
    assert_eq!(eval("Skip([1,2,3], 2)"), Value::Obj(Rc::new(Obj::List(vec![i(3)]))));
    assert_eq!(eval("Reverse([1,2,3])"), Value::Obj(Rc::new(Obj::List(vec![i(3), i(2), i(1)]))));
    assert_eq!(eval("Distinct([1,1,2,nil,2,nil])"), Value::Obj(Rc::new(Obj::List(vec![i(1), i(2), Value::Nil]))));
    assert_eq!(eval("Contains([1,2,3], 2)"), Value::Bool(true));
    assert_eq!(eval(r#"Contains("Hello","ell")"#), Value::Bool(true));
    assert_eq!(eval("Contains(Range(1,3), 2)"), Value::Bool(true));

    assert_eq!(eval("Map([1,2,3], (x,i)=>x+i)"), Value::Obj(Rc::new(Obj::List(vec![i(1), i(3), i(5)]))));
    assert_eq!(eval("[1,2,3] filter (x,i)=>x>1"), Value::Obj(Rc::new(Obj::List(vec![i(2), i(3)]))));
    assert_eq!(eval("Filter([1,2,3], (x,i)=>x>1)"), Value::Obj(Rc::new(Obj::List(vec![i(2), i(3)]))));
    assert_eq!(eval("Any([1,2,3], (x,i)=>x=2)"), Value::Bool(true));
    assert_eq!(eval("First([1,2,3], (x,i)=>x>1)"), i(2));
    assert_eq!(eval("Sort([3,1,2], (a,b)=>a-b)"), Value::Obj(Rc::new(Obj::List(vec![i(1), i(2), i(3)]))));
}

#[test]
fn vm_can_be_reused_across_multiple_interpret_calls() {
    let mut vm = VM::new();
    assert_eq!(vm.interpret("1+2").unwrap(), i(3));
    assert_eq!(vm.interpret("3+4").unwrap(), i(7));
}

#[test]
fn regex_parse_format_and_htmlencode_work() {
    assert_eq!(eval(r#"regex("Hello world", "world")"#), Value::Bool(true));
    assert_eq!(eval(r#"regex("Hello", "^hello$", "i")"#), Value::Bool(true));

    assert_eq!(eval(r#"parse("ff","hex")"#), i(255));
    assert_eq!(eval(r#"parse("123","l")"#), i(123));
    assert_eq!(eval(r#"parse("1+2","fs")"#), i(3));

    assert_eq!(eval(r#"format([1,2],"json")"#), s("[1,2]"));
    assert_eq!(eval(r#"format("a","json")"#), s("\"a\""));

    assert_eq!(eval(r#"_templatemerge("a", ["b","c"], nil, 1)"#), s("abc1"));
    assert_eq!(eval(r#"HEncode("<>&")"#), s("&lt;&gt;&amp;"));
    assert_eq!(eval(r#"HEncode('"')"#), s("&quot;"));
    assert_eq!(eval(r#"HEncode("'")"#), s("&#39;"));
}

#[test]
fn os_functions_work() {
    let _host = host::push(host::std_fs_callbacks());
    let base: PathBuf = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join("fs_test_tmp");
    let _ = std::fs::remove_dir_all(&base);
    std::fs::create_dir_all(&base).unwrap();

    let file_path = base.join("a.txt");
    std::fs::write(&file_path, "hello").unwrap();

    let dir_path = base.join("d");
    std::fs::create_dir_all(&dir_path).unwrap();

    let base_s = base.to_string_lossy().to_string();
    let file_s = file_path.to_string_lossy().to_string();
    let dir_s = dir_path.to_string_lossy().to_string();

    assert_eq!(eval(&format!("fileexists('{file_s}')")), Value::Bool(true));
    assert_eq!(eval(&format!("isfile('{file_s}')")), Value::Bool(true));
    assert_eq!(eval(&format!("file('{file_s}')")), s("hello"));

    assert_eq!(eval(&format!("fileexists('{dir_s}')")), Value::Bool(true));
    assert_eq!(eval(&format!("isfile('{dir_s}')")), Value::Bool(false));

    assert_eq!(eval(&format!("Len(dirlist('{base_s}'))")), i(2));
    assert_eq!(eval(&format!("Contains(dirlist('{base_s}'), '{file_s}')")), Value::Bool(true));
    assert_eq!(eval(&format!("Contains(dirlist('{base_s}'), '{dir_s}')")), Value::Bool(true));
}


