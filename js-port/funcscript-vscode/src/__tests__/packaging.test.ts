import { execSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('vsce packaging', () => {
  it('keeps the FuncScript parser runtime in the VSIX payload', () => {
    const extensionRoot = path.resolve(__dirname, '..', '..');
    const output = execSync('npx vsce ls', {
      cwd: extensionRoot,
      encoding: 'utf8'
    });

    expect(output.includes('node_modules/@tewelde/funcscript/src/funcscript.js')).toBe(true);
  });
});
