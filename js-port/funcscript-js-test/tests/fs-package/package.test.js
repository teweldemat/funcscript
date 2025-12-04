'use strict';

const { expect } = require('chai');
const { loadPackage, typeOf, valueOf, FSDataType } = require('@tewelde/funcscript');
const { createMockResolver } = require('./helpers');

describe('Packages', () => {
  it('evaluates nested resolver structure as key-value collection', () => {
    const resolver = createMockResolver({
      children: {
        constants: {
          children: {
            pi: { expression: '3.14' },
            tau: { expression: 'pi * 2' }
          }
        },
        eval: { expression: 'constants.tau' }
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
          expression: {
            expression: 'return 41 + 1;',
            language: 'javascript'
          }
        },
        eval: { expression: 'fortyTwo' }
      }
    });

    const rootResolver = createMockResolver(
      {
        children: {
          total: { expression: 'package("math") + 8' },
          eval: { expression: 'total' }
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
            doubler: { expression: '(value)=>value * 2' }
          }
        },
        consumer: { expression: 'helpers.doubler(21)' },
        eval: { expression: 'consumer' }
      }
    });

    const typed = loadPackage(resolver);
    expect(typeOf(typed)).to.equal(FSDataType.Integer);
    expect(valueOf(typed)).to.equal(42);
  });

  it('invokes function expressions exported from sibling resolvers without helper folder', () => {
    const resolver = createMockResolver({
      children: {
        doubler: { expression: '(value)=>value * 2' },
        consumer: { expression: 'doubler(21)' },
        eval: { expression: 'consumer' }
      }
    });

    const typed = loadPackage(resolver);
    expect(typeOf(typed)).to.equal(FSDataType.Integer);
    expect(valueOf(typed)).to.equal(42);
  });

  it('ignores syntax errors in siblings when resolving eval expression', () => {
    const resolver = createMockResolver({
      children: {
        x: { expression: '1+{' }, // intentionally malformed
        y: { expression: '2' },
        eval: { expression: 'y' }
      }
    });

    const typed = loadPackage(resolver);
    expect(typeOf(typed)).to.equal(FSDataType.Integer);
    expect(valueOf(typed)).to.equal(2);
  });

  it('returns key-value collection and delays syntax errors until access', () => {
    const resolver = createMockResolver({
      children: {
        x: { expression: '1+{' }, // intentionally malformed
        y: { expression: '2' }
      }
    });

    const typed = loadPackage(resolver);
    expect(typeOf(typed)).to.equal(FSDataType.KeyValueCollection);

    const kvc = valueOf(typed);
    const y = kvc.get('y');
    expect(typeOf(y)).to.equal(FSDataType.Integer);
    expect(valueOf(y)).to.equal(2);
    expect(() => kvc.get('x')).to.throw(/Failed to parse expression/i);
  });
});
