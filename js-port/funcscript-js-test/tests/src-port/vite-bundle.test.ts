import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testPackageRoot = resolve(__dirname, '../..');
const funcscriptPackageRoot = resolve(testPackageRoot, '../funcscript-js');
const viteBin = join(testPackageRoot, 'node_modules', '.bin', 'vite');

function run(command: string, args: string[], cwd: string) {
  execFileSync(command, args, {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    },
  });
}

describe('Vite production bundle compatibility', () => {
  it('bundles parse(text, "fs") without browser-entry circular initialization', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'funcscript-vite-bundle-'));

    try {
      const packOutput = execFileSync(
        'npm',
        ['pack', funcscriptPackageRoot, '--pack-destination', tempDir, '--silent'],
        { cwd: tempDir, encoding: 'utf8' }
      ).trim();
      const packedTarball = join(tempDir, packOutput.split('\n').at(-1) ?? packOutput);

      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({
          type: 'module',
          dependencies: {
            '@tewelde/funcscript': `file:${packedTarball}`,
          },
        })
      );
      writeFileSync(
        join(tempDir, 'main.js'),
        [
          'import { evaluate, FSDataType, typeOf, valueOf } from "@tewelde/funcscript";',
          'const result = evaluate(\'parse("40 + 2", "fs")\');',
          'if (typeOf(result) !== FSDataType.Integer) throw new Error(`Expected integer, got ${typeOf(result)}`);',
          'export default valueOf(result);',
        ].join('\n')
      );
      writeFileSync(
        join(tempDir, 'vite.config.mjs'),
        [
          'export default {',
          '  build: {',
          '    lib: {',
          '      entry: "./main.js",',
          '      formats: ["es"],',
          '      fileName: () => "funcscript-vite-smoke.mjs"',
          '    }',
          '  }',
          '};',
        ].join('\n')
      );

      run('npm', ['install', '--ignore-scripts', '--silent'], tempDir);
      run(viteBin, ['build', '--config', 'vite.config.mjs'], tempDir);

      const bundleUrl = pathToFileURL(
        join(tempDir, 'dist', 'funcscript-vite-smoke.mjs')
      ).href;
      const bundledModule = await import(`${bundleUrl}?cache=${Date.now()}`);

      expect(bundledModule.default).toBe(42);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }, 120_000);
});
