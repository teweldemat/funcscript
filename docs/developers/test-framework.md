# FuncScript Test Framework

The FuncScript Test Framework provides a lightweight way to validate FuncScript expressions by simulating input data and asserting on deterministic results.

## Overview

A FuncScript expression **A** can be tested using another FuncScript expression **T**. During a test run, the framework intercepts calls to `IFsDataProvider.Get` within **A** and replaces them with mock values supplied by **T**. This makes it possible to run repeatable tests without depending on upstream systems.

## Defining Tests

Each test script returns one or more `testSuite` objects (analogous to test suites). A `testSuite` typically defines:

- `name`: A description of what the suite validates.
- `cases`: Mock input values for intercepted symbols.
- `test`: A function that runs once per case and performs assertions against the evaluated result. The function returns the assertion outcome, and when multiple assertions run it can return a list of results.

The `test` function receives two arguments:

1. `resData` — the result of evaluating expression **A** with the mocked inputs.
2. `caseData` — the mock values for the current case, which is handy when assertions depend on the provided inputs.

### Example

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
    test: (resData, caseData) => assert.isnotnull(resData);
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

- Each entry in `cases` defines a different input scenario for the intercepted symbols `a`, `b`, and `c`.
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

1. The framework intercepts `IFsDataProvider.Get` calls inside the tested expression **A**.
2. For each mock case defined in `cases`, the specified symbols are substituted with the provided mock values.
3. Expression **A** executes with the substituted data.
4. The resulting value is passed to the `test` function defined by each `testSuite`.
5. Assertion outcomes are reported per case, letting you see which inputs triggered which results.

## Return Structure

Each test script must evaluate to an array of `testSuite` objects:

```funcscript
eval [testSuite1, testSuite2, ...];
```
