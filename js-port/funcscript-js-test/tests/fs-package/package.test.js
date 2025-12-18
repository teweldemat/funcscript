'use strict';

const { expect } = require('chai');
const { loadPackage, typeOf, valueOf, FSDataType, FormatToJson } = require('@tewelde/funcscript');
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

    const typed = loadPackage(resolver)();
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

    const typed = loadPackage(rootResolver)();
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

    const typed = loadPackage(resolver)();
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

    const typed = loadPackage(resolver)();
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

    const typed = loadPackage(resolver)();
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

    const typed = loadPackage(resolver)();
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
    })();

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
    })();

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
    })();

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
    })();

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
    })();

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

  it('mirrors multiStepProfile call pattern and stays stable on replay', () => {
    const resolver = createMockResolver({
      children: {
        eval: {
          expression: `
{
  scaleVectorToLength:(point, origin, length)=> {
    ox:if origin = null then 0 else origin[0];
    oy:if origin = null then 0 else origin[1];
    dx:if point = null then 0 else point[0] - ox;
    dy:if point = null then 0 else point[1] - oy;
    distance:math.sqrt(dx * dx + dy * dy);
    target:math.max(length, 0);
    eval if distance < 0.000001 then [ox, oy - target] else {
      scale:if distance = 0 then 0 else target / distance;
      eval [ox + dx * scale, oy + dy * scale];
    };
  };

  subtractPoints:(a, b)=> {
    pa:if a = null then [0,0] else a;
    pb:if b = null then [0,0] else b;
    eval [pa[0] - pb[0], pa[1] - pb[1]];
  };

  averagePoints:(a, b)=> {
    eval if a = null and b = null then null else [
      ((if a = null then 0 else a[0]) + (if b = null then 0 else b[0])) / ((if a = null then 0 else 1) + (if b = null then 0 else 1)),
      ((if a = null then 0 else a[1]) + (if b = null then 0 else b[1])) / ((if a = null then 0 else 1) + (if b = null then 0 else 1))
    ];
  };

  stepper:(ctx)=> {
    fixedSide:ctx.fixedSide ?? "left";
    movingSide:if fixedSide = "left" then "right" else "left";
    fixedPoint:ctx.fixedPoint ?? [0,0];
    movingStart:ctx.movingStart ?? [0,0];
    movingTarget:ctx.movingTarget ?? [0,0];
    anchorCandidateA:subtractPoints(fixedPoint, if fixedSide = "left" then ctx.leftOffset else ctx.rightOffset);
    anchorCandidateB:subtractPoints(movingTarget, if movingSide = "left" then ctx.leftOffset else ctx.rightOffset);
    anchor:averagePoints(anchorCandidateA, anchorCandidateB);
    arcPoint:scaleVectorToLength(movingTarget, movingStart, ctx.arcLength ?? 0);
    eval {
      step:{
        fixedSide:fixedSide;
        movingSide:movingSide;
        fixedPoint:fixedPoint;
        movingPoint:arcPoint;
        anchorPoint:anchor;
        progress:ctx.progress ?? 0;
      };
      anchor:anchor;
      moving:arcPoint;
    };
  };

  defaults:{
    fixedPoint:[11,0];
    movingStart:[11,0];
    movingTarget:[19,0];
    leftOffset:[3.5,-18.6];
    rightOffset:[-3.5,-18.6];
    progress:1;
    arcLength:0;
  };

  ctx:defaults + {
    fixedSide:"left";
    movingStart:defaults.fixedPoint;
  };

  warm:stepper(ctx + {
    fixedSide:"right";
    movingStart:[-3.5,0];
    movingTarget:[11,0];
  });

  first:stepper(ctx);
  second:stepper(ctx);

  eval { warm:warm; first:first; second:second };
}
          `
        }
      }
    });

    const typed = loadPackage(resolver)();
    expect(typeOf(typed)).to.equal(FSDataType.KeyValueCollection);
    const kvc = valueOf(typed);
    const first = kvc.get('first');
    const second = kvc.get('second');

    expect(typeOf(first)).to.equal(FSDataType.KeyValueCollection);
    expect(typeOf(second)).to.equal(FSDataType.KeyValueCollection);

    const warmStep = valueOf(valueOf(kvc.get('warm')).get('step'));
    const firstStep = valueOf(valueOf(first).get('step'));
    const secondStep = valueOf(valueOf(second).get('step'));
    const toPlain = (stepKvc) => ({
      fixedSide: valueOf(stepKvc.get('fixedSide')),
      movingSide: valueOf(stepKvc.get('movingSide')),
      fixedPoint: FormatToJson(stepKvc.get('fixedPoint')),
      movingPoint: FormatToJson(stepKvc.get('movingPoint')),
      anchorPoint: FormatToJson(stepKvc.get('anchorPoint')),
      progress: FormatToJson(stepKvc.get('progress'))
    });

  const warmPlain = toPlain(warmStep);
  const firstPlain = toPlain(firstStep);
  const secondPlain = toPlain(secondStep);

  expect(warmPlain.fixedSide).to.equal('right');
  expect(firstPlain).to.deep.equal(secondPlain);
  });

  it('does not expose intermediate members when eval is present', () => {
    const libResolver = createMockResolver({
      children: {
        bugexp: {
          expression: `
{
  piOverTwo: math.Pi / 2;
  eval { angle: piOverTwo; };
}
`
        }
      }
    });

    const rootResolver = createMockResolver(
      {
        children: {
          eval: { expression: 'package("lib").bugexp.piOverTwo' }
        }
      },
      { lib: libResolver }
    );

    const typed = loadPackage(rootResolver)();
    expect(typeOf(typed)).to.equal(FSDataType.Null);
    expect(valueOf(typed)).to.equal(null);
  });
});
