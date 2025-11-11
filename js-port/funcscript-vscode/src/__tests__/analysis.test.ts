import { describe, expect, it } from 'vitest';
import { analyzeText } from '../analysis';

describe('analyzeText semantic segments', () => {
  it('relies on the FuncScript parser for eval + null tokens', () => {
    const text = '{ x:null; eval x; }';
    const outcome = analyzeText(text);

    const evalSegment = outcome.segments.find(
      (segment) => segment.nodeType === 'KeyWord' && text.slice(segment.start, segment.end) === 'eval'
    );
    expect(evalSegment).toBeDefined();

    const nullSegment = outcome.segments.find(
      (segment) => segment.nodeType === 'KeyWord' && text.slice(segment.start, segment.end) === 'null'
    );
    expect(nullSegment).toBeDefined();
  });

  it('highlights literal strings emitted by the parser', () => {
    const text = '{ x:"test"; eval x; }';
    const outcome = analyzeText(text);

    const stringSegment = outcome.segments.find(
      (segment) =>
        segment.nodeType === 'LiteralString' && text.slice(segment.start, segment.end) === '"test"'
    );
    expect(stringSegment).toBeDefined();
  });

  it('distinguishes between key declarations and identifiers', () => {
    const text = '{ x:5; return x; }';
    const outcome = analyzeText(text);

    const keySegment = outcome.segments.find(
      (segment) => segment.nodeType === 'Key' && text.slice(segment.start, segment.end) === 'x'
    );
    expect(keySegment).toBeDefined();

    const identifierSegment = outcome.segments.find(
      (segment) =>
        segment.nodeType === 'Identifier' && segment.start === text.indexOf('return') + 'return '.length
    );
    expect(identifierSegment).toBeDefined();
  });
});
