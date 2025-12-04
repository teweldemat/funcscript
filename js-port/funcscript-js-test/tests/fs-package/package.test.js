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
    const x = kvc.get('x');
    expect(typeOf(x)).to.equal(FSDataType.Error);
  });

  it('traces eval expression during package load', () => {
    const traces = [];
    const resolver = createMockResolver({
      children: {
        x: { expression: '1+{' }, // intentionally malformed
        y: { expression: '2' },
        eval: { expression: 'y+1' }
      }
    });

    const typed = loadPackage(resolver, undefined, (path, info) => {
      traces.push({ path, info });
    });

    expect(typeOf(typed)).to.equal(FSDataType.Integer);
    expect(valueOf(typed)).to.equal(3);
    expect(traces.length).to.be.greaterThan(0);
    expect(traces.some((t) => t.path === 'eval')).to.be.true;
    expect(traces.some((t) => t.path === 'eval' && t.info?.result === 3)).to.be.true;
  });

  it('traces lazy member evaluation and syntax errors', () => {
    const traces = [];
    const resolver = createMockResolver({
      children: {
        x: { expression: '1+{' }, // intentionally malformed
        y: { expression: '1+1' }
      }
    });

    const typed = loadPackage(resolver, undefined, (path, info) => {
      traces.push({ path, info });
    });

    expect(typeOf(typed)).to.equal(FSDataType.KeyValueCollection);
    expect(traces.length).to.equal(0);

    const kvc = valueOf(typed);
    const y = kvc.get('y');
    expect(typeOf(y)).to.equal(FSDataType.Integer);
    expect(valueOf(y)).to.equal(2);
    expect(traces.length).to.be.greaterThan(0);
    expect(traces.every((t) => t.path === 'y')).to.be.true;
    expect(traces.some((t) => t.info?.result === 2)).to.be.true;

    traces.length = 0;
    const x = kvc.get('x');
    expect(typeOf(x)).to.equal(FSDataType.Error);
    expect(traces.length).to.be.greaterThan(0);
    expect(traces.every((t) => t.path === 'x')).to.be.true;
    expect(traces[0].info?.result?.__fsKind).to.equal('FsError');
  });

  it('traces syntax errors with line info', () => {
    const traces = [];
    const resolver = createMockResolver({
      children: {
        eval: { expression: '1+\n{' }
      }
    });

    const typed = loadPackage(resolver, undefined, (path, info) => {
      traces.push({ path, info });
    });

    expect(typeOf(typed)).to.equal(FSDataType.Error);
    expect(traces.length).to.be.greaterThan(0);
    const trace = traces.find((t) => t.path === 'eval');
    expect(trace).to.exist;
    expect(trace.info.startLine).to.be.greaterThan(0);
    expect(trace.info.endLine).to.be.at.least(trace.info.startLine);
    expect(trace.info.snippet).to.include('{');
  });

  it('traces detailed package evaluation results and snippets', () => {
    const traces = [];
    const resolver = createMockResolver({
      children: {
        x: { expression: 'math.abs(-2)' },
        eval: { expression: '3+x' }
      }
    });

    const typed = loadPackage(resolver, undefined, (path, info) => {
      traces.push({ path, info });
    });

    expect(typeOf(typed)).to.equal(FSDataType.Integer);
    expect(valueOf(typed)).to.equal(5);
    expect(traces.length).to.be.at.least(2);

    const xTrace = traces.find((t) => t.path === 'x');
    expect(xTrace).to.exist;
    expect(xTrace.info.snippet).to.equal('math.abs(-2)');
    expect(xTrace.info.result).to.equal(2);
    expect(xTrace.info.startLine).to.be.greaterThan(0);

    const evalTrace = traces.find((t) => t.path === 'eval');
    expect(evalTrace).to.exist;
    expect(evalTrace.info.snippet).to.equal('3+x');
    expect(evalTrace.info.result).to.equal(5);
    expect(evalTrace.info.startLine).to.be.greaterThan(0);
  });

  it('traces nested helper evaluation with snippets and results', () => {
    const traces = [];
    const resolver = createMockResolver({
      children: {
        h: {
          children: {
            f: { expression: 'math.abs(-2)' }
          }
        },
        eval: { expression: '3+h.f' }
      }
    });

    const typed = loadPackage(resolver, undefined, (path, info) => {
      traces.push({ path, info });
    });

    expect(typeOf(typed)).to.equal(FSDataType.Integer);
    expect(valueOf(typed)).to.equal(5);
    expect(traces.length).to.be.at.least(2);

    const helperTrace = traces.find(
      (t) => typeof t.path === 'string' && t.path.toLowerCase().startsWith('h')
    );
    expect(helperTrace).to.exist;
    expect(helperTrace.info.snippet).to.equal('math.abs(-2)');
    expect(helperTrace.info.result).to.equal(2);
    expect(helperTrace.info.startLine).to.be.greaterThan(0);

    const evalTrace = traces.find((t) => t.path === 'eval');
    expect(evalTrace).to.exist;
    expect(evalTrace.info.snippet).to.equal('3+h.f');
    expect(evalTrace.info.result).to.equal(5);
    expect(evalTrace.info.startLine).to.be.greaterThan(0);
  });
});
