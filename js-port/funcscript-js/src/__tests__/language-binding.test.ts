import { describe, expect, it } from 'vitest';
import {
  Engine,
  SimpleKeyValueCollection,
  ArrayFsList,
  KeyValueCollection,
  BaseFunction,
  ParameterList,
  normalize,
  valueOf,
  typeOf,
  DefaultFsDataProvider,
  FSDataType,
  FsError
} from '../funcscript.js';

class ArrayParameterList extends ParameterList {
  private readonly typedValues: ReturnType<typeof normalize>[];

  constructor(values: unknown[]) {
    super();
    this.typedValues = values.map((v) => normalize(v));
  }

  get count(): number {
    return this.typedValues.length;
  }

  getParameterAt(index: number) {
    return this.typedValues[index];
  }

  getParameter(_provider: DefaultFsDataProvider, index: number) {
    return this.getParameterAt(index);
  }
}

function callFunction(func: BaseFunction, args: unknown[], provider = new DefaultFsDataProvider()) {
  const parameters = new ArrayParameterList(args);
  const typed = func.evaluate(provider, parameters);
  return valueOf(typed);
}

describe('JavaScript language binding (JS runtime)', () => {
  it('evaluates expression', () => {
    const provider = new SimpleKeyValueCollection(null, [['value', normalize(10)]]);
    const expression = `
\`\`\`javascript
return value + 5;
\`\`\``;

    const typed = Engine.evaluate(expression, provider);
    expect(valueOf(typed)).toBe(15);
  });

  it('returns key-value collection', () => {
    const typedItems = [normalize(1), normalize(2), normalize(3)];
    const provider = new SimpleKeyValueCollection(null, [['items', normalize(new ArrayFsList(typedItems))]]);
    const expression = `
\`\`\`javascript
const doubled = (items || []).map(x => x * 2);
return {
  count: doubled.length,
  values: doubled
};
\`\`\``;

    const typedResult = Engine.evaluate(expression, provider);
    const result = valueOf(typedResult) as KeyValueCollection;
    expect(result).toBeInstanceOf(KeyValueCollection);

    const count = valueOf(result.get('count'));
    expect(count).toBe(3);
    const valuesList = valueOf(result.get('values')) as ArrayFsList;
    expect(valuesList).toBeInstanceOf(ArrayFsList);
    const values = valuesList.toArray().map((item) => valueOf(item));
    expect(values).toEqual([2, 4, 6]);
  });

  it('reports runtime errors', () => {
    const provider = new SimpleKeyValueCollection(null, [['value', normalize(1)]]);
    const expression = `
\`\`\`javascript
throw new Error('boom');
\`\`\``;

    const typed = Engine.evaluate(expression, provider);
    expect(typeOf(typed)).toBe(FSDataType.Error);
    const error = valueOf(typed) as FsError;
    expect(error).toBeInstanceOf(FsError);
    expect(error.errorMessage).toContain('Runtime error');
  });

  it('reports compile errors', () => {
    const provider = new SimpleKeyValueCollection(null, []);
    const expression = `
\`\`\`javascript
return provider.;
\`\`\``;

    const typed = Engine.evaluate(expression, provider);
    expect(typeOf(typed)).toBe(FSDataType.Error);
    const error = valueOf(typed) as FsError;
    expect(error.errorMessage).toContain('Compile error');
  });

  it('evaluates using default provider', () => {
    const expression = `
\`\`\`javascript
return {
  x: 3,
  y: 5
};
\`\`\``;

    const typed = Engine.evaluate(expression);
    const result = valueOf(typed) as KeyValueCollection;
    expect(result.get('x')).toBeDefined();
    expect(valueOf(result.get('x'))).toBe(3);
    expect(valueOf(result.get('y'))).toBe(5);
  });

  it('returns arrays from JavaScript blocks', () => {
    const cases: Array<{ body: string; expected: number[] }> = [
      { body: 'return [-5,0];', expected: [-5, 0] },
      { body: 'return [2,0];', expected: [2, 0] }
    ];

    for (const { body, expected } of cases) {
      const expression = `
{
x:\`\`\`javascript
${body}
\`\`\`;
}
`;

      const typed = Engine.evaluate(expression);
      const result = valueOf(typed) as KeyValueCollection;
      expect(result).toBeInstanceOf(KeyValueCollection);

      const arrayValue = valueOf(result.get('x')) as ArrayFsList;
      expect(arrayValue).toBeInstanceOf(ArrayFsList);
      const values = arrayValue.toArray().map((item) => valueOf(item));
      expect(values).toEqual(expected);
    }
  });

  it('allows calling a JavaScript function from FuncScript', () => {
    const expression = `
{
f:\`\`\`javascript
return function (a){return a*a;};
\`\`\`;
eval f(5)
}
`;

    const typed = Engine.evaluate(expression);
    expect(valueOf(typed)).toBe(25);
  });

  it('retains context inside a JavaScript function', () => {
    const expression = `
{
r:3;
f:\`\`\`javascript
return function (a){return a*r;};
\`\`\`;
eval f(5)
}
`;

    const typed = Engine.evaluate(expression);
    expect(valueOf(typed)).toBe(15);
  });

  it('retains context across multiple calls', () => {
    const expression = `
{
r:3;
f:\`\`\`javascript
return function (a){return a*r;};
\`\`\`;
}
`;
    const typed = Engine.evaluate(expression);
    const result = valueOf(typed) as KeyValueCollection;
    const func = valueOf(result.get('f')) as BaseFunction;

    expect(callFunction(func, [5])).toBe(15);
    expect(callFunction(func, [8])).toBe(24);
  });

  it('retains nested context across multiple calls', () => {
    const expression = `
(s)=>{
r:s.m;
f:\`\`\`javascript
return function (a){return a*r;};
\`\`\`;
eval f;
}
`;

    const typed = Engine.evaluate(expression);
    const outerFunc = valueOf(typed) as BaseFunction;
    const provider = new DefaultFsDataProvider();
    const parameterList = new ArrayParameterList([
      new SimpleKeyValueCollection(null, [['m', normalize(10)]])
    ]);
    const innerFuncResult = outerFunc.evaluate(provider, parameterList);
    const innerFunc = valueOf(innerFuncResult) as BaseFunction;

    expect(callFunction(innerFunc, [5])).toBe(50);
    expect(callFunction(innerFunc, [8])).toBe(80);
  });

  it('allows JS functions to call each other within same block', () => {
    const expression = `
{
funcs:\`\`\`javascript
const f = a => a * 2;
const g = b => f(b) + 5;
return { f, g };
\`\`\`;
eval funcs;
}
`;
    const typed = Engine.evaluate(expression);
    const functions = valueOf(typed) as KeyValueCollection;
    const fFunc = valueOf(functions.get('f')) as BaseFunction;
    const gFunc = valueOf(functions.get('g')) as BaseFunction;

    expect(callFunction(fFunc, [4])).toBe(8);
    expect(callFunction(gFunc, [4])).toBe(13);
    expect(callFunction(gFunc, [7])).toBe(19);
  });

  it('allows functions defined across blocks to call each other', () => {
    const expression = `
{
f:\`\`\`javascript
return function (a) { return a * 2; };
\`\`\`;
g:\`\`\`javascript
return function (b) { return f(b) + 5; };
\`\`\`;
}
`;
    const typed = Engine.evaluate(expression);
    const result = valueOf(typed) as KeyValueCollection;
    const fFunc = valueOf(result.get('f')) as BaseFunction;
    const gFunc = valueOf(result.get('g')) as BaseFunction;

    expect(callFunction(fFunc, [6])).toBe(12);
    expect(callFunction(gFunc, [4])).toBe(13);
    expect(callFunction(gFunc, [9])).toBe(23);
  });

  it('returns object from nested JavaScript function', () => {
    const expression = `
{
g:\`\`\`javascript
function f(x)
{
  return {
    h:x
  };
}
return f;
\`\`\`;
eval g(3)
}
`;
    const typed = Engine.evaluate(expression);
    const result = valueOf(typed) as KeyValueCollection;
    expect(result).toBeInstanceOf(KeyValueCollection);
    expect(valueOf(result.get('h'))).toBe(3);
  });

  it('allows calling nested FuncScript functions from JavaScript context', () => {
    const expression = `
c:
{
a:45;
b:(x)=>x*2;
};

eval \`\`\`javascript
  return c.b(45)
\`\`\`
`;

    const typed = Engine.evaluate(expression);
    expect(valueOf(typed)).toBe(90);
  });
});
