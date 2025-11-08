declare module '@tewelde/funcscript-editor' {
  import type { ComponentType } from 'react';

  export const FuncScriptEditor: ComponentType<any>;
  export const FuncScriptTester: ComponentType<any>;
  export function funcscriptColoring(source: string): Array<{ start: number; end: number; type: string }>;
}
