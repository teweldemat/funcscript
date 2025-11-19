const { expect } = require('chai');
const fs = require('fs');
const path = require('path');
const {
  evaluate,
  FuncScriptParser,
  DefaultFsDataProvider,
  valueOf,
  SimpleKeyValueCollection,
  ArrayFsList
} = require('@tewelde/funcscript');
const { toPlain, evaluateWithVars } = require('../helpers/runtime');

// Mirrors key scenarios from FuncScript.Test/BugAnalysis.cs

describe('BugAnalysis', () => {
  it('parses large real-world expression within budget', () => {
    const exp = fs.readFileSync(
      path.join(__dirname, '../../../../FuncScript.Test/data/parse-test-1.fx'),
      'utf8'
    );
    const provider = new DefaultFsDataProvider();
    const errors = [];
    const start = performance.now();
    const result = FuncScriptParser.parse(provider, exp, errors);
    const duration = performance.now() - start;

    expect(errors, 'parser should not report errors').to.be.empty;
    expect(result.block, 'parser should return an expression block').to.exist;
    expect(result.nextIndex).to.equal(exp.length);
    expect(duration).to.be.below(500);
  });

  it('parses deeply nested KVC within budget', () => {
    const exp = '{x:2,y:{x:2,y:{x:2,y:{x:2,y:{x:2,y:{x:2,y:5}}}}}}';
    const provider = new DefaultFsDataProvider();
    const errors = [];
    const start = performance.now();
    const result = FuncScriptParser.parse(provider, exp, errors);
    const duration = performance.now() - start;

    expect(errors).to.be.empty;
    expect(result.block).to.exist;
    expect(result.nextIndex).to.equal(exp.length);
    expect(duration).to.be.below(100);
  });

  it('evaluates expression following comment correctly', () => {
    const exp = '4//3\n +5;';
    const result = evaluate(exp, new DefaultFsDataProvider());
    expect(valueOf(result)).to.equal(9);
  });

  it('evaluates expression with block comments correctly', () => {
    const exp = '4/*3*/\n +5;';
    const result = evaluate(exp, new DefaultFsDataProvider());
    expect(valueOf(result)).to.equal(9);
  });

  it('preserves selector scope inside map iterations (Bug20251120 parity)', () => {
    const query = `
testData.Samples map (sample) => sample 
{
    z: utils.TheLambda(3)
}
`;

    const sample = new SimpleKeyValueCollection(null, [['r', 32]]);
    const samplesList = new ArrayFsList([sample]);
    const testData = new SimpleKeyValueCollection(null, [['Samples', samplesList]]);
    const utils = new SimpleKeyValueCollection(null, [['TheLambda', (x) => 12]]);
    const vars = { testData, utils };

    const result = evaluateWithVars(query, vars);
    const plain = toPlain(result);

    expect(plain).to.be.an('array').with.lengthOf(1);
    expect(plain[0]).to.be.an('object');
    expect(plain[0]).to.have.property('z', 12);
  });

});
