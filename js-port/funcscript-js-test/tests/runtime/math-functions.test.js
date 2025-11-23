const { expect } = require('chai');
const {
  evaluate,
  DefaultFsDataProvider,
  typeOf,
  valueOf,
  FSDataType
} = require('@tewelde/funcscript');

describe('MathFunctions', () => {
  it('exposes math collection with shared function instances', () => {
    const provider = new DefaultFsDataProvider();
    const mathValue = provider.get('math');
    expect(typeOf(mathValue)).to.equal(FSDataType.KeyValueCollection);

    const mathCollection = valueOf(mathValue);
    expect(mathCollection.isDefined('sin')).to.be.true;
    expect(mathCollection.isDefined('sqrt')).to.be.true;
    expect(mathCollection.isDefined('pi')).to.be.true;

    const sinFromCollection = mathCollection.get('sin');
    expect(typeOf(sinFromCollection)).to.equal(FSDataType.Function);

    const sinGlobal = provider.get('sin');
    expect(sinGlobal).to.equal(null);
  });

  it('evaluates math namespace functions', () => {
    const cases = [
      { expression: 'math.sin(0)', expected: 0, type: FSDataType.Float },
      { expression: 'math.cos(0)', expected: 1, type: FSDataType.Float },
      { expression: 'math.tan(0)', expected: 0, type: FSDataType.Float },
      { expression: 'math.sqrt(9)', expected: 3, type: FSDataType.Float },
      { expression: 'math.exp(0)', expected: 1, type: FSDataType.Float },
      { expression: 'math.log(math.e)', expected: 1, type: FSDataType.Float },
      { expression: 'math.log(8,2)', expected: 3, type: FSDataType.Float },
      { expression: 'math.log10(1000)', expected: 3, type: FSDataType.Float },
      { expression: 'math.abs(-5.1)', expected: 5.1, type: FSDataType.Float },
      { expression: 'math.round(2.345,2)', expected: 2.35, type: FSDataType.Float },
      { expression: 'math.trunc(2.9)', expected: 2, type: FSDataType.Float },
      { expression: 'math.min(5, 2.5, 10)', expected: 2.5, type: FSDataType.Float },
      { expression: 'math.max(5, 20, 10)', expected: 20, type: FSDataType.Integer }
    ];

    for (const { expression, expected, type } of cases) {
      const result = evaluate(expression);
      expect(typeOf(result)).to.equal(type);
      expect(valueOf(result)).to.be.closeTo(expected, 1e-10);
    }
  });

  it('maintains integer semantics for abs and sign', () => {
    const absInteger = evaluate('math.abs(-5)');
    expect(typeOf(absInteger)).to.equal(FSDataType.Integer);
    expect(valueOf(absInteger)).to.equal(5);

    const signInteger = evaluate('math.sign(-12)');
    expect(typeOf(signInteger)).to.equal(FSDataType.Integer);
    expect(valueOf(signInteger)).to.equal(-1);
  });

  it('clamps values within bounds', () => {
    const result = evaluate('math.clamp(10, 0, 5)');
    expect(typeOf(result)).to.equal(FSDataType.Integer);
    expect(valueOf(result)).to.equal(5);
  });

  it('returns deterministic seeded math.random values', () => {
    const missingSeed = evaluate('math.random()');
    expect(typeOf(missingSeed)).to.equal(FSDataType.Error);

    const zeroSeed = evaluate('math.random(0)');
    const zeroSeedAgain = evaluate('math.random(0)');
    expect(typeOf(zeroSeed)).to.equal(FSDataType.Float);
    expect(valueOf(zeroSeed)).to.equal(valueOf(zeroSeedAgain));
    expect(valueOf(zeroSeed)).to.be.within(0, 1);

    const seeded = evaluate('math.random(42)');
    const seededAgain = evaluate('math.random(42)');
    expect(valueOf(seeded)).to.equal(valueOf(seededAgain));

    const differentSeed = evaluate('math.random(7.5)');
    expect(Math.abs(valueOf(seeded) - valueOf(differentSeed))).to.be.greaterThan(Number.EPSILON);
    expect(valueOf(seeded)).to.be.within(0, 1);
    expect(valueOf(differentSeed)).to.be.within(0, 1);
  });

  it('exposes pi and e values', () => {
    const piValue = evaluate('math.pi');
    expect(typeOf(piValue)).to.equal(FSDataType.Float);
    expect(valueOf(piValue)).to.be.closeTo(Math.PI, 1e-10);

    const eValue = evaluate('math.e');
    expect(typeOf(eValue)).to.equal(FSDataType.Float);
    expect(valueOf(eValue)).to.be.closeTo(Math.E, 1e-10);
  });

  it('exposes pi and e only through the math namespace', () => {
    const piGlobal = evaluate('pi');
    expect(typeOf(piGlobal)).to.equal(FSDataType.Null);
    expect(valueOf(piGlobal)).to.equal(null);

    const eGlobal = evaluate('e');
    expect(typeOf(eGlobal)).to.equal(FSDataType.Null);
    expect(valueOf(eGlobal)).to.equal(null);
  });

  it('guards math functions from the global namespace', () => {
    const cases = ['sin(0)', 'cos(0)', 'abs(-1)', 'sqrt(4)', 'random(0)'];
    for (const expression of cases) {
      expect(() => evaluate(expression)).to.throw();
    }
  });
});
