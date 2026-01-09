use funcscript_core::vm::VM;
use funcscript_core::value::Value;
use funcscript_core::obj::Obj;
use std::rc::Rc;

fn eval(source: &str) -> Value {
    let mut vm = VM::new();
    vm.interpret(source).expect("interpret should succeed")
}

fn s(text: &str) -> Value {
    Value::Obj(Rc::new(Obj::String(text.to_string())))
}

#[test]
fn if_expression_works() {
    assert_eq!(eval("If(true, 10, 20)"), Value::Number(10.0));
    assert_eq!(eval("If(false, 10, 20)"), Value::Number(20.0));
}

#[test]
fn if_then_else_keyword_form_works() {
    assert_eq!(eval("if 1 < 2 then 10 else 20"), Value::Number(10.0));
    assert_eq!(eval("if 1 > 2 then 10 else 20"), Value::Number(20.0));
}

#[test]
fn naked_kvc_root_works() {
    assert_eq!(eval("a:1; b:2; eval a+b"), Value::Number(3.0));
}

#[test]
fn selector_item_sugar_works() {
    let exp = "{person:{name:'Alice',age:30,extra:true}, person {name,age}}";
    assert_eq!(eval(format!("{exp}.person.name").as_str()), s("Alice"));
    assert_eq!(eval(format!("{exp}.person.age").as_str()), Value::Number(30.0));
    assert_eq!(eval(format!("{exp}.person.extra").as_str()), Value::Bool(true));
}

#[test]
fn case_expression_works() {
    assert_eq!(eval("case 1=2:10, true:20, 30"), Value::Number(20.0));
    assert_eq!(eval("case false:10, false:20, 30"), Value::Number(30.0));
}

#[test]
fn switch_expression_works() {
    assert_eq!(eval("switch 2, 1:10, 2:20, 30"), Value::Number(20.0));
    assert_eq!(eval("switch 3, 1:10, 2:20, 30"), Value::Number(30.0));
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
    assert_eq!(eval("{a:1}?.a"), Value::Number(1.0));
}

#[test]
fn map_operator_works() {
    assert_eq!(eval("nil map (x)=>x"), Value::Nil);
    assert_eq!(eval("[4,5] map (x)=>x+2"), Value::Obj(Rc::new(Obj::List(vec![Value::Number(6.0), Value::Number(7.0)]))));
    let exp = r#"{
        a:2;
        return [4,5] map (x)=>x+a;
    }"#;
    assert_eq!(eval(exp), Value::Obj(Rc::new(Obj::List(vec![Value::Number(6.0), Value::Number(7.0)]))));
}

#[test]
fn reduce_works_prefix_and_infix() {
    assert_eq!(eval("reduce([4,5,6],(s,x)=>s+x)"), Value::Number(15.0));
    assert_eq!(eval("reduce([4,5,6],(s,x)=>s+x,-2)"), Value::Number(13.0));
    assert_eq!(eval("[4,5,6] reduce (s,x)=>s+x ~ -2"), Value::Number(13.0));
}

#[test]
fn template_strings_work() {
    assert_eq!(eval(r#"f"hi {1+2}""#), s("hi 3"));
    assert_eq!(eval(r#"f'X{ "a" + "b" }Y'"#), s("XabY"));
    assert_eq!(eval("f\"{nil}\""), s("nil"));
}

#[test]
fn math_and_comparisons_work() {
    assert_eq!(eval("1 + 2 * 3"), Value::Number(7.0));
    assert_eq!(eval("10 / 2 + 1"), Value::Number(6.0));
    assert_eq!(eval("1 < 2"), Value::Bool(true));
    assert_eq!(eval("1 == 1"), Value::Bool(true));
    assert_eq!(eval("1 != 2"), Value::Bool(true));
}

#[test]
fn lists_work() {
    assert_eq!(eval("[1, 2, 3]"), Value::Obj(Rc::new(Obj::List(vec![
        Value::Number(1.0),
        Value::Number(2.0),
        Value::Number(3.0),
    ]))));

    assert_eq!(eval("Len([1,2,3])"), Value::Number(3.0));
    assert_eq!(eval("First([9,8,7])"), Value::Number(9.0));
}

#[test]
fn huge_range_does_not_allocate_list() {
    // This should compile/evaluate quickly and not try to allocate 1e9 items.
    assert_eq!(eval("Len(Range(0, 1000000000))"), Value::Number(1000000000.0));
}

#[test]
fn maps_and_property_access_work() {
    assert_eq!(eval("{a: 1, b: 2}.a"), Value::Number(1.0));
    assert_eq!(eval("{a: 1, b: 2}.b"), Value::Number(2.0));
    assert_eq!(eval("{a: 1, b: 2}.missing"), Value::Nil);
    assert_eq!(eval("Len({a: 1, b: 2})"), Value::Number(2.0));
}

#[test]
fn kvc_addition_merges_nested_kvcs() {
    assert_eq!(eval("({a:12,b:{c:10,z:10}}+{d:13,b:{c:12,x:5}}).a"), Value::Number(12.0));
    assert_eq!(eval("({a:12,b:{c:10,z:10}}+{d:13,b:{c:12,x:5}}).d"), Value::Number(13.0));
    assert_eq!(eval("({a:12,b:{c:10,z:10}}+{d:13,b:{c:12,x:5}}).b.c"), Value::Number(12.0));
    assert_eq!(eval("({a:12,b:{c:10,z:10}}+{d:13,b:{c:12,x:5}}).b.z"), Value::Number(10.0));
    assert_eq!(eval("({a:12,b:{c:10,z:10}}+{d:13,b:{c:12,x:5}}).b.x"), Value::Number(5.0));
}

#[test]
fn kvc_addition_replaces_lists_with_rightmost_value() {
    assert_eq!(eval("({x:[1,2]}+{x:[3]}).x[0]"), Value::Number(3.0));
    assert_eq!(eval("Len(({x:[1,2]}+{x:[3]}).x)"), Value::Number(1.0));
}

#[test]
fn kvc_addition_prefers_right_scalar_over_left_collection() {
    assert_eq!(eval("({a:{x:1,y:2}}+{a:5}).a"), Value::Number(5.0));
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
    assert_eq!(eval("Abs(-5)"), Value::Number(5.0));
    assert_eq!(eval("Max(2, 9)"), Value::Number(9.0));
    assert_eq!(eval("Min(2, 9)"), Value::Number(2.0));
    assert_eq!(eval("Sqrt(9)"), Value::Number(3.0));

    assert_eq!(eval("Len(Range(3, 4))"), Value::Number(4.0));
    assert_eq!(eval("Range(3, 4)[0]"), Value::Number(3.0));
    assert_eq!(eval("Range(3, 4)[3]"), Value::Number(6.0));
}

#[test]
fn lambdas_can_be_called_and_use_parameters() {
    assert_eq!(eval("((x)=> x + 1)(2)"), Value::Number(3.0));
    assert_eq!(eval("((x,y)=> x * y)(3,4)"), Value::Number(12.0));
}

#[test]
fn strings_concatenate_with_plus() {
    assert_eq!(eval(r#""a" + "b""#), s("ab"));
    assert_eq!(eval(r#"Len("hello")"#), Value::Number(5.0));
    assert_eq!(eval(r#"First("hello")"#), s("h"));
}


