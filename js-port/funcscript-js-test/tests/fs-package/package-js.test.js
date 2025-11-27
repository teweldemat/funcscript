'use strict';

const { expect } = require('chai');
const { loadPackage, typeOf, valueOf, FSDataType } = require('@tewelde/funcscript');
const { createMockResolver, jsBlock } = require('./helpers');

describe('Packages with ```javascript``` blocks', () => {
  it('evaluates nested resolver structure as key-value collection', () => {
    const resolver = createMockResolver({
      children: {
        constants: {
          children: {
            pi: { expression: jsBlock`return 3.14;` },
            tau: { expression: jsBlock`return pi * 2;` }
          }
        },
        eval: { expression: jsBlock`return constants.tau;` }
      }
    });

    const typed = loadPackage(resolver);
    expect(typeOf(typed)).to.equal(FSDataType.Float);
    expect(valueOf(typed)).to.be.closeTo(6.28, 0.01);
  });

  it('wraps javascript expressions and wires package helper', () => {
    const mathResolver = createMockResolver({
      children: {
        fortyTwo: {
          expression: jsBlock`
            return 41 + 1;
          `
        },
        eval: { expression: jsBlock`return fortyTwo;` }
      }
    });

    const rootResolver = createMockResolver(
      {
        children: {
          total: {
            expression: jsBlock`
              return package('math') + 8;
            `
          },
          eval: { expression: jsBlock`return total;` }
        }
      },
      { math: mathResolver }
    );

    const typed = loadPackage(rootResolver);
    expect(typeOf(typed)).to.equal(FSDataType.Integer);
    expect(valueOf(typed)).to.equal(50);
  });

  it('invokes function expressions exported from sibling resolvers', () => {
    const resolver = createMockResolver({
      children: {
        helpers: {
          children: {
            doubler: {
              expression: jsBlock`
                return function (value) {
                  return value * 2;
                };
              `
            }
          }
        },
        consumer: {
          expression: jsBlock`
            return helpers.doubler(21);
          `
        },
        eval: { expression: jsBlock`return consumer;` }
      }
    });

    const typed = loadPackage(resolver);
    expect(typeOf(typed)).to.equal(FSDataType.Integer);
    expect(valueOf(typed)).to.equal(42);
  });

  it('invokes function expressions exported from sibling resolvers without helper folder', () => {
    const resolver = createMockResolver({
      children: {
        doubler: {
          expression: jsBlock`
            return (value) => value * 2;
          `
        },
        consumer: {
          expression: jsBlock`
            return doubler(21);
          `
        },
        eval: { expression: jsBlock`return consumer;` }
      }
    });

    const typed = loadPackage(resolver);
    expect(typeOf(typed)).to.equal(FSDataType.Integer);
    expect(valueOf(typed)).to.equal(42);
  });

  it('invokes functions returned from named declarations inside resolver expressions', () => {
    const resolver = createMockResolver({
      children: {
        a: {
          expression: jsBlock`
            function f(x) {
              return x * x;
            }
            return f;
          `
        },
        eval: { expression: jsBlock`return a(3);` }
      }
    });

    const typed = loadPackage(resolver);
    expect(typeOf(typed)).to.equal(FSDataType.Integer);
    expect(valueOf(typed)).to.equal(9);
  });

  it('evaluates folder eval expressions scoped to sibling values', () => {
    const resolver = createMockResolver({
      children: {
        a: {
          children: {
            x: { expression: jsBlock`return 5;` },
            eval: {
              expression: jsBlock`
                return (s) => s * x;
              `
            }
          }
        },
        b: {
          expression: jsBlock`
            return a(3);
          `
        },
        eval: { expression: jsBlock`return b;` }
      }
    });

    const typed = loadPackage(resolver);
    expect(typeOf(typed)).to.equal(FSDataType.Integer);
    expect(valueOf(typed)).to.equal(15);
  });
});
