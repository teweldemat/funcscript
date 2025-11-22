import { describe, expect, it } from 'vitest';
import { FuncScriptParser, DefaultFsDataProvider } from '@tewelde/funcscript';
import { computeColoredSegments } from '../funcscriptColoring.js';

const provider = new DefaultFsDataProvider();

const parseExpression = (expression: string) => {
  const { parseNode } = FuncScriptParser.parse(provider, expression);
  return parseNode;
};

describe('computeColoredSegments', () => {
  it('colors identifier keys using the kvKey palette', () => {
    const expression = '{ foo: 1; bar: foo + 2; }';
    const parseNode = parseExpression(expression);
    const segments = computeColoredSegments(expression, parseNode);

    const keySegments = segments.filter((segment) => segment.nodeType === 'Key');
    expect(keySegments).toHaveLength(2);
    expect(keySegments.map((segment) => expression.slice(segment.start, segment.end))).toEqual([
      'foo',
      'bar'
    ]);
    expect(keySegments.every((segment) => segment.color === '#C586C0')).toBe(true);

    const identifierSegments = segments.filter((segment) => segment.nodeType === 'Identifier');
    expect(identifierSegments.some((segment) => expression.slice(segment.start, segment.end) === 'foo')).toBe(true);
  });

  it('colors string literal keys as kvKey tokens', () => {
    const expression = '{ "greeting": "hi"; }';
    const parseNode = parseExpression(expression);
    const segments = computeColoredSegments(expression, parseNode);

    const keySegments = segments.filter((segment) => segment.nodeType === 'Key');
    expect(keySegments).toHaveLength(1);
    expect(expression.slice(keySegments[0].start, keySegments[0].end)).toBe('"greeting"');
    expect(keySegments[0].color).toBe('#C586C0');
  });
});
