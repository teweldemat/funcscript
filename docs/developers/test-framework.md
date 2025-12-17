# FuncScript Test Framework

The FuncScript Test Framework provides a lightweight way to validate FuncScript expressions by simulating input data and asserting on deterministic results.

## Overview

A FuncScript expression **A** can be tested using a FuncScript test script **T**. During a test run, the framework evaluates **A** with a provider that overlays each case’s bindings on top of the base provider, making it possible to run repeatable tests without depending on upstream systems.

## Defining Tests

Each test script returns one or more `testSuite` objects (analogous to test suites). A `testSuite` typically defines:

- `name`: A description of what the suite validates.
- `cases`: Case objects that define the bindings used when evaluating the expression under test. Skip this when you want a single implicit case, which is handy for function targets you plan to call yourself.
- `test` (or `tests`): A function (or list of functions) that runs once per case and performs assertions against the evaluated result. Returning a list of assertions lets you report multiple failures at once.

The `test` function receives two arguments:

1. `resData` — the result of evaluating expression **A** with the mocked inputs. When **A** is a function and you do not provide an `input` list, `resData` is the uninvoked function so your test can decide how to call it.
2. `caseData` — the mock values for the current case, which is handy when assertions depend on the provided inputs (or an empty object when `cases` is omitted).

### Testing Functions

FuncScript functions can be exercised either by calling them directly inside the test or by letting the framework invoke them for each case.

#### Manual invocation (no ambient or input lists)

Skip `cases` to run a single implicit pass and receive the function itself:

```funcscript
// Expression under test
(value, offset) => value + offset
```

```funcscript
// Test script
{
  callDirectly: {
    name: "manual function testing";
    test: (fn) => [
      assert.equal(fn(2, 3), 5),
      assert.equal(fn(-1, 4), 3)
    ];
  };

  eval [callDirectly];
}
```

Here the test gets `fn` as the first argument and decides how many times and with which parameters to invoke it. This pattern is useful when you want to explore multiple inputs without wiring up `cases`.

#### Automatic invocation with ambient and input data

When you prefer the framework to call the function for you, each case can describe:

- `ambient` — Optional key/value collection of variables to inject while evaluating the expression under test (useful when the case object also includes `input`).
- `input` — Optional list of positional arguments that will be passed to the function after evaluation. When `input` is omitted, the framework passes the unevaluated function into your `test` without calling it.

Example:

```funcscript
// Expression under test
(value, offset) => (value + offset) * scale
```

```funcscript
// Test script
{
  scaleFunction: {
    name: "invokes function expressions";
    cases: [
      { ambient: { scale: 2 }, input: [3, 1] },
      { ambient: { scale: 3 }, input: [4, 0] }
    ];
    test: (resData, caseData) => {
      sum: caseData.input reduce (acc, value) => acc + value ~ 0;
      eval [assert.noerror(resData),
        assert.equal(resData, sum * caseData.ambient.scale),
      ]
    };
  };

  eval [scaleFunction];
}
```

Each case supplies per-run `ambient` data (`scale`) that feeds the expression, plus an `input` list that becomes `(value, offset)`. The framework automatically invokes the function with the provided arguments before running the assertions, so `resData` captures the function’s output.

### Testing Non-function Expressions

Script under test:

```funcscript
{
  z: b * b - 4 * a * c;
  eval if z < 0 then error('Equation not solvable')
    else
      {
        r1: (-b + math.sqrt(z)) / (2 * a);
        r2: (-b - math.sqrt(z)) / (2 * a);
      };
}
```

Test script:

```funcscript
{
  shouldBeOk: {
    name: "Returns a non-error result for solvable quadratic equations";
    cases: [
      { "a": 1.0, "b": 2.0, "c": -1.0 },
      { "a": 1.0, "b": 4.0, "c": 2.0 }
    ];
    test: (resData, caseData) => assert.noerror(resData);
  };
  shouldBeError: {
    name: "Returns an error result for non-solvable quadratic equations";
    cases: [
      { "a": 1.0, "b": 1.0, "c": 2 }
    ];
    test: (resData, caseData) => assert.iserror(resData);
  };

  eval [shouldBeOk, shouldBeError];
}
```

In this example:

- Each entry in `cases` defines a different input scenario by providing bindings for `a`, `b`, and `c`.
- The `test` function runs once per case, receiving both the evaluated result (`resData`) and the case data (`caseData`) so it can assert the correct behavior for each scenario.
- Naming the suites (`shouldBeOk`, `shouldBeError`) makes the reported output easy to interpret.

## Assertions

The framework provides a collection of built-in predicates under the `assert` namespace. You can combine them freely inside your test expressions.

### Standard Assertions

| Function | Description |
| --- | --- |
| `assert.equal(a, b)` | Passes if `a` is equal to `b`. |
| `assert.notEqual(a, b)` | Passes if `a` is not equal to `b`. |
| `assert.greater(a, b)` | Passes if `a > b`. |
| `assert.less(a, b)` | Passes if `a < b`. |
| `assert.true(expr)` | Passes if `expr` is `true`. |
| `assert.false(expr)` | Passes if `expr` is `false`. |
| `assert.approx(a, b, eps)` | Passes if the absolute difference between `a` and `b` is less than or equal to `eps`. |

### Error and Null Handling Assertions

| Function | Description |
| --- | --- |
| `assert.noerror(res)` | Passes if `res` does not represent an error. |
| `assert.iserror(res)` | Passes if `res` represents any error. |
| `assert.iserrortype(res, typeName)` | Passes if `res` is an error of the specified type. |
| `assert.hasErrorMessage(res, msg)` | Passes if the error message of `res` matches or contains `msg`. |
| `assert.isnull(value)` | Passes if `value` is `null`. |
| `assert.isnotnull(value)` | Passes if `value` is not `null`. |

These predicates make it easy to validate both normal and exceptional results from FuncScript expressions.

## Execution Flow

1. The framework evaluates **T** to get a list of test suites.
2. For each case in a suite’s `cases` list (or a single implicit case when `cases` is omitted), the case bindings are layered over the base provider.
3. Expression **A** executes with those bindings available as variables.
4. The resulting value is passed to the `test` (or `tests`) function(s) defined by each `testSuite`.
5. Assertion outcomes are reported per case, letting you see which inputs triggered which results.

## Return Structure

Each test script must evaluate to an array of `testSuite` objects:

```funcscript
eval [testSuite1, testSuite2, ...];
```

### Package Integration

The `testPackage(resolver, provider?)` helper walks a FuncScript package resolver, looks for `<name>` / `<name>.test` siblings (plus the special `eval` / `eval.test` pair), and executes each discovered test file using this framework. Package expressions and their tests share the same folder-local scope, so helpers and nested bindings stay available, and function expressions can either be passed through directly to the test (skipping `cases`) or use the `{ ambient, input }` case shape to supply provider overrides and positional parameters.
