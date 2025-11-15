import { describe, expect, it } from 'vitest';
import { Engine, DefaultFsDataProvider, valueOf, typeOf, FSDataType } from '../funcscript.js';

function createProviderWithText() {
  const provider = new DefaultFsDataProvider();
  provider.set('text', provider.get('text'));
  return provider;
}

describe('text helpers', () => {
  it('upper and lower convert casing and pass through null', () => {
    const provider = createProviderWithText();

    const upperResult = Engine.evaluate('upper("hello world")', provider);
    const lowerResult = Engine.evaluate('text.lower("HELLO")', provider);
    const nullResult = Engine.evaluate('text.lower(null)', provider);

    expect(valueOf(upperResult)).toBe('HELLO WORLD');
    expect(valueOf(lowerResult)).toBe('hello');
    expect(typeOf(nullResult)).toBe(FSDataType.Null);
  });

  it('exposes text collection members', () => {
    const provider = createProviderWithText();
    const typedText = provider.get('text');

    expect(typedText).not.toBeNull();
    if (typedText == null) return;

    const textCollection = valueOf(typedText);
    expect(textCollection.isDefined('upper')).toBe(true);
    expect(textCollection.isDefined('lower')).toBe(true);
    expect(textCollection.isDefined('regex')).toBe(true);
  });

  it('evaluates regex patterns with optional flags', () => {
    const provider = createProviderWithText();

    expect(valueOf(Engine.evaluate('regex("Hello world", "world")', provider))).toBe(true);
    expect(valueOf(Engine.evaluate('regex("Hello world", "^world$")', provider))).toBe(false);
    expect(valueOf(Engine.evaluate('regex("Hello", "^hello$", "i")', provider))).toBe(true);
    expect(valueOf(Engine.evaluate('regex("Hello\nWorld", "^world$", "mi")', provider))).toBe(true);
    expect(valueOf(Engine.evaluate('regex("abc", "a b c", "x")', provider))).toBe(true);
    expect(valueOf(Engine.evaluate('text.regex("Hello", "^hello$", "i")', provider))).toBe(true);

    const invalid = Engine.evaluate('regex("abc", "abc", "q")', provider);
    expect(typeOf(invalid)).toBe(FSDataType.Error);
  });
});
