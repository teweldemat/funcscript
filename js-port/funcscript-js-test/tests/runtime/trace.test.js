const { expect } = require('chai');
const {
  trace,
  DefaultFsDataProvider,
  FsError
} = require('@tewelde/funcscript');
const { toPlain, makeProvider } = require('../helpers/runtime');

function captureLogs(action) {
  const original = console.log;
  const buffer = [];
  console.log = (...args) => buffer.push(args.join(' '));
  try {
    action();
  } finally {
    console.log = original;
  }
  return buffer.join('\n');
}

describe('Trace', () => {
  it('invokes hook with the final result', () => {
    const infos = [];
    const result = trace('1+2', (res, info) => {
      expect(info).to.not.be.null;
      infos.push(info);
    });

    expect(toPlain(result)).to.equal(3);
    expect(infos.length).to.be.greaterThan(0);
    const last = infos[infos.length - 1];
    expect(last.result).to.equal(3);
  });

  it('logs location and snippet when no hook is provided', () => {
    const output = captureLogs(() => trace('1+2'));
    expect(output).to.contain('Evaluating 1:');
    expect(output).to.contain('1+2');
  });

  it('handles multiline snippets', () => {
    const output = captureLogs(() => trace('1+\n2'));
    expect(output).to.contain('2:1-2:1');
    expect(output).to.contain('1+\n2');
  });

  it('passes location data to the hook', () => {
    const infos = [];
    trace('1+2', (res, info) => infos.push(info));

    expect(infos).to.not.be.empty;
    const last = infos[infos.length - 1];
    expect(last.snippet).to.contain('1+2');
    expect(last.startLine).to.equal(1);
    expect(last.startColumn).to.be.greaterThan(0);
  });

  it('reports inclusive endIndex', () => {
    let last = null;
    trace('1+2', (res, info) => {
      if (res === 3) {
        last = info;
      }
    });

    expect(last).to.not.be.null;
    expect(last.startIndex).to.equal(0);
    expect(last.endIndex).to.equal(2);
  });

  it('counts evaluations for common shapes', () => {
    const infos1 = [];
    trace('1+2', (res, info) => infos1.push(info));
    expect(infos1.length).to.be.greaterThan(0);
    expect(infos1.some((i) => i.snippet && i.snippet.includes('1+2'))).to.be.true;

    const infos2 = [];
    trace('math.round(2)', (res, info) => infos2.push(info));
    expect(infos2.length).to.be.greaterThan(0);
    expect(infos2.some((i) => i.snippet && i.snippet.includes('math.round(2)'))).to.be.true;

    const provider = makeProvider({ f: (x) => x });
    const infos3 = [];
    trace('f(3)', provider, (res, info) => infos3.push(info));
    expect(infos3.length).to.be.greaterThan(0);
    expect(infos3.some((i) => i.snippet && i.snippet.includes('f(3)'))).to.be.true;
  });

  it('surfaces evaluation errors to the hook', () => {
    const infos = [];
    trace("error('boom')", (res, info) => infos.push(info));

    expect(infos).to.not.be.empty;
    const last = infos[infos.length - 1];
    expect(last.result).to.be.instanceOf(FsError);
    expect(last.result.errorMessage).to.equal('boom');
  });

  it('does not log when a hook is supplied', () => {
    const output = captureLogs(() => trace('1+2', () => {}));
    expect(output).to.equal('');
  });

  it('uses entry and exit hooks to build evaluation tree', () => {
    const stack = [];
    let root = null;

    const entryHook = (info) => {
      const node = { snippet: info?.snippet, children: [] };
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      } else {
        root = node;
      }
      stack.push(node);
      return node;
    };

    trace(
      '1+2*3',
      (result, info, entryState) => {
        const node = entryState;
        if (node) {
          node.result = result;
        }
        stack.pop();
      },
      entryHook
    );

    expect(stack.length).to.equal(0);
    expect(root).to.not.be.null;
    expect(root.snippet).to.contain('1+2*3');

    const toHierarchy = (node) => ({
      [node.snippet]: node.children.map(toHierarchy)
    });

    const expected = {
      '1+2*3': [
        { '+': [] },
        { '1': [] },
        {
          '2*3': [
            { '*': [] },
            { '2': [] },
            { '3': [] }
          ]
        }
      ]
    };

    expect(toHierarchy(root)).to.deep.equal(expected);
  });
});
