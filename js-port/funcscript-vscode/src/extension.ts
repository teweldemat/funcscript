import * as vscode from 'vscode';
import { analyzeText, collectFoldRegions, ParseOutcome } from './analysis';
import type { ParseNode } from '@tewelde/funcscript/parser';
import * as fs from 'node:fs';
import * as path from 'node:path';

const tokenTypesLegend: vscode.SemanticTokensLegend['tokenTypes'] = [
  'comment',
  'string',
  'number',
  'keyword',
  'variable',
  'operator',
  'property',
  'function',
  'type'
];

const tokenModifiersLegend: vscode.SemanticTokensLegend['tokenModifiers'] = [];

const legend = new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);

type TokenType = (typeof tokenTypesLegend)[number];

type NodeTypeClassifier = Partial<Record<string, TokenType>>;

const NODE_TYPE_TOKEN: NodeTypeClassifier = {
  RootExpression: 'variable',
  WhiteSpace: 'variable',
  Comment: 'comment',
  StringDelimeter: 'string',
  FunctionParameterList: 'variable',
  FunctionCall: 'function',
  MemberAccess: 'property',
  Selection: 'property',
  InfixExpression: 'operator',
  LiteralInteger: 'number',
  LiteralDouble: 'number',
  LiteralLong: 'number',
  LiteralFloat: 'number',
  LiteralBoolean: 'keyword',
  KeyWord: 'keyword',
  Identifier: 'variable',
  IdentiferList: 'variable',
  Operator: 'operator',
  LambdaArrow: 'operator',
  ThirdOperandDelimeter: 'operator',
  LambdaExpression: 'function',
  ExpressionInBrace: 'operator',
  SwitchExpression: 'keyword',
  IfExpression: 'keyword',
  LiteralString: 'string',
  StringTemplate: 'string',
  KeyValueCollection: 'property',
  List: 'variable',
  Key: 'property',
  Case: 'keyword',
  DataConnection: 'type',
  NormalErrorSink: 'type',
  SigSequence: 'type',
  ErrorKeyWord: 'keyword',
  SignalConnection: 'type',
  GeneralInfixExpression: 'operator',
  PrefixOperatorExpression: 'operator',
  OpenBrace: 'operator',
  CloseBrance: 'operator',
  ListSeparator: 'operator',
  Colon: 'operator'
};

const FALLBACK_TOKEN: TokenType = 'variable';

const SKIP_NODE_TYPES = new Set<string>([
  'RootExpression',
  'WhiteSpace',
  'InfixExpression',
  'GeneralInfixExpression',
  'KeyValuePair'
]);

const outputChannelId = 'FuncScript';
let outputChannel: vscode.OutputChannel | undefined;

const log = (message: string) => {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(outputChannelId);
  }
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[${timestamp}] ${message}`);
};

const readJson = (filePath: string) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Failed to read JSON at ${filePath}: ${message}`);
    return null;
  }
};

class DocumentAnalysisCache {
  private readonly cache = new Map<string, { version: number; outcome: ParseOutcome }>();

  get(document: vscode.TextDocument): ParseOutcome {
    const key = document.uri.toString();
    const current = this.cache.get(key);
    if (current && current.version === document.version) {
      return current.outcome;
    }

    const rawText = document.getText();
    try {
      const outcome = analyzeText(rawText);
      this.cache.set(key, { version: document.version, outcome });
      log(`Analyzed ${document.uri.toString()} (segments=${outcome.segments.length})`);
      return outcome;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Failed to analyze ${document.uri.toString()}: ${message}`);
      const empty: ParseOutcome = { parseNode: null, segments: [], text: rawText };
      this.cache.set(key, { version: document.version, outcome: empty });
      return empty;
    }
  }

  evict(document: vscode.TextDocument) {
    this.cache.delete(document.uri.toString());
    log(`Evicted analysis cache for ${document.uri.toString()}`);
  }
}

const isMeaningful = (text: string) => text.trim().length > 0;

const toRange = (
  document: vscode.TextDocument,
  start: number,
  end: number,
  docLength: number
) => {
  const safeStart = Math.max(0, Math.min(start, docLength));
  const safeEnd = Math.max(safeStart, Math.min(end, docLength));
  const startPos = document.positionAt(safeStart);
  const endPos = document.positionAt(safeEnd);
  return new vscode.Range(startPos, endPos);
};

class FuncScriptSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  constructor(private readonly cache: DocumentAnalysisCache) {}

  async provideDocumentSemanticTokens(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.SemanticTokens> {
    const analysis = this.cache.get(document);
    const { segments, text } = analysis;

    if (segments.length === 0) {
      log(`No semantic segments returned for ${document.uri.toString()}`);
      return new vscode.SemanticTokens(new Uint32Array());
    }

    log(`Segments from analysis for ${document.uri.toString()}: ${segments.length}`);
    for (const segment of segments.slice(0, 20)) {
      log(
        `  segment start=${segment.start} end=${segment.end} length=${segment.end - segment.start} type=${segment.nodeType}`
      );
    }
    if (segments.length > 20) {
      log(`  ... ${segments.length - 20} more segments omitted ...`);
    }

    const builder = new vscode.SemanticTokensBuilder(legend);
    const docLength = analysis.text.length;
    const unknownNodeTypes = new Set<string>();

    let pushed = 0;
    const pushedSegments: Array<{ line: number; character: number; length: number; type: TokenType }> = [];

    for (const segment of segments) {
      if (SKIP_NODE_TYPES.has(segment.nodeType)) {
        continue;
      }

      const explicitToken = NODE_TYPE_TOKEN[segment.nodeType];
      const tokenType = explicitToken ?? FALLBACK_TOKEN;
      if (!explicitToken) {
        unknownNodeTypes.add(segment.nodeType);
      }

      const range = toRange(document, segment.start, segment.end, docLength);
      const emitRange = (start: vscode.Position, end: vscode.Position) => {
        const startOffset = document.offsetAt(start);
        const endOffset = document.offsetAt(end);
        if (endOffset <= startOffset) {
          return;
        }
        builder.push(new vscode.Range(start, end), tokenType);
        pushedSegments.push({
          line: start.line,
          character: start.character,
          length: endOffset - startOffset,
          type: tokenType
        });
        pushed += 1;
        const snippet = text.slice(startOffset, endOffset).replace(/\n/g, '\\n');
        log(
          `  pushing token type=${tokenType} range=(${start.line}:${start.character})-(${end.line}:${end.character}) snippet="${snippet}"`
        );
      };

      if (range.start.line === range.end.line) {
        emitRange(range.start, range.end);
        continue;
      }

      emitRange(
        range.start,
        new vscode.Position(range.start.line, document.lineAt(range.start.line).range.end.character)
      );

      for (let line = range.start.line + 1; line < range.end.line; line += 1) {
        const lineRange = document.lineAt(line).range;
        if (!lineRange.isEmpty) {
          emitRange(new vscode.Position(line, 0), lineRange.end);
        }
      }

      emitRange(new vscode.Position(range.end.line, 0), range.end);
    }

    if (unknownNodeTypes.size > 0) {
      log(
        `Falling back to '${FALLBACK_TOKEN}' for node types in ${document.uri.toString()}: ${Array.from(
          unknownNodeTypes
        ).join(', ')}`
      );
    }

    log(`Semantic tokens emitted for ${document.uri.toString()}: ${pushed}`);
    if (pushed > 0) {
      for (const segment of pushedSegments.slice(0, 20)) {
        log(
          `  token line=${segment.line} col=${segment.character} length=${segment.length} type=${segment.type}`
        );
      }
      if (pushedSegments.length > 20) {
        log(`  ... ${pushedSegments.length - 20} more segments omitted ...`);
      }
    }

    return builder.build();
  }
}

const clampPosition = (
  document: vscode.TextDocument,
  index: number,
  docLength: number
) => {
  const safeIndex = Math.max(0, Math.min(index, docLength));
  return document.positionAt(safeIndex);
};

const foldRegionToRange = (
  document: vscode.TextDocument,
  region: { start: number; end: number },
  docLength: number
) => {
  const start = clampPosition(document, region.start, docLength);
  const end = clampPosition(document, Math.max(region.end - 1, region.start), docLength);
  if (end.line <= start.line) {
    return null;
  }
  return { start, end };
};

class FuncScriptFoldingRangeProvider implements vscode.FoldingRangeProvider {
  constructor(private readonly cache: DocumentAnalysisCache) {}

  provideFoldingRanges(
    document: vscode.TextDocument,
    _context: vscode.FoldingContext,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FoldingRange[]> {
    const analysis = this.cache.get(document);
    const docLength = analysis.text.length;
    const regions = collectFoldRegions(analysis.parseNode as ParseNode | null, docLength);
    if (!regions.length) {
      return [];
    }

    const byLine = new Map<number, vscode.FoldingRange>();

    for (const region of regions) {
      const range = foldRegionToRange(document, region, docLength);
      if (!range) {
        continue;
      }

      const { start, end } = range;
      const existing = byLine.get(start.line);
      if (!existing || existing.end < end.line) {
        const foldingRange = new vscode.FoldingRange(start.line, end.line);
        byLine.set(start.line, foldingRange);
      }
    }

    return Array.from(byLine.values()).sort((a, b) => a.start - b.start);
  }
}

const logInitializationDetails = (context: vscode.ExtensionContext) => {
  log(`Host: node ${process.version}; platform=${process.platform}; arch=${process.arch}`);

  const manifestPath = path.join(context.extensionPath, 'package.json');
  const manifest = readJson(manifestPath) as { version?: string } | null;
  if (manifest?.version) {
    log(`Extension version: ${manifest.version}`);
  }

  try {
    const runtimePackagePath = require.resolve('@tewelde/funcscript/package.json', {
      paths: [context.extensionPath]
    });
    const runtimePackage = readJson(runtimePackagePath) as { version?: string } | null;
    log(
      `Runtime resolved: ${runtimePackagePath} (version=${runtimePackage?.version ?? '<unknown>'})`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Runtime resolution failed: ${message}`);
  }

  try {
    const sample = analyzeText('{ x:1; }');
    log(
      `Runtime self-check: sample parse segments=${sample.segments.length}; parseNode=${
        sample.parseNode ? 'present' : 'null'
      }`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Runtime self-check failed: ${message}`);
  }
};

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel(outputChannelId);
  log('Activating FuncScript extension');
  logInitializationDetails(context);
  const iconThemeSetting = vscode.workspace.getConfiguration('workbench').get<string>('iconTheme');
  log(`Current workbench.iconTheme: ${iconThemeSetting ?? '<unset>'}`);
  const iconUri = vscode.Uri.joinPath(context.extensionUri, 'media', 'funcscript-icon.svg');
  vscode.workspace.fs.stat(iconUri).then(
    () => log(`FuncScript icon resource found at ${iconUri.toString(true)}`),
    (error: unknown) =>
      log(
        `FuncScript icon resource missing: ${error instanceof Error ? error.message : String(error)}`
      )
  );
  const cache = new DocumentAnalysisCache();
  const selector: vscode.DocumentSelector = { language: 'funcscript' };

  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      selector,
      new FuncScriptSemanticTokensProvider(cache),
      legend
    )
  );

  context.subscriptions.push(
    vscode.languages.registerFoldingRangeProvider(
      selector,
      new FuncScriptFoldingRangeProvider(cache)
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => cache.evict(document))
  );

  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('workbench.iconTheme')) {
        const updated = vscode.workspace
          .getConfiguration('workbench')
          .get<string>('iconTheme');
        log(`workbench.iconTheme changed to ${updated ?? '<unset>'}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('funcscript.selectIconTheme', async () => {
      try {
        await vscode.workspace
          .getConfiguration('workbench')
          .update('iconTheme', 'funcscript-icons', vscode.ConfigurationTarget.Global);
        log('workbench.iconTheme updated to funcscript-icons');
        void vscode.window.showInformationMessage('FuncScript icon theme applied.');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`Failed to set icon theme: ${message}`);
        void vscode.window.showErrorMessage(`Failed to apply FuncScript icon theme: ${message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('funcscript.inspectIconMapping', async () => {
      try {
        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        const current = workbenchConfig.get<string>('iconTheme');
        log(`Inspecting icon theme. workbench.iconTheme=${current ?? '<unset>'}`);

        const inspected = workbenchConfig.inspect<string>('iconTheme');
        if (inspected) {
          log(
            `  iconTheme scope -> default=${inspected.defaultValue ?? '<unset>'}, global=${inspected.globalValue ?? '<unset>'}, workspace=${inspected.workspaceValue ?? '<unset>'}`
          );
        }

        const themeUri = vscode.Uri.joinPath(context.extensionUri, 'themes', 'funcscript-icon-theme.json');
        const raw = await vscode.workspace.fs.readFile(themeUri);
        const text = new TextDecoder('utf-8').decode(raw);
        const parsed = JSON.parse(text) as {
          iconDefinitions?: Record<string, { iconPath?: string }>;
          fileExtensions?: Record<string, string>;
          languageIds?: Record<string, string>;
        };

        const iconPath = parsed.iconDefinitions?.funcscriptFile?.iconPath ?? '<missing>';
        const fileExts = parsed.fileExtensions ? Object.entries(parsed.fileExtensions) : [];
        const languageIds = parsed.languageIds ? Object.entries(parsed.languageIds) : [];
        const lookup = (key: string) => fileExts.find(([ext]) => ext === key)?.[1] ?? '<none>';
        const langLookup = (key: string) => languageIds.find(([id]) => id === key)?.[1] ?? '<none>';

        log(
          `  funcscriptFile iconPath=${iconPath}; fileExtensions=${fileExts
            .map(([ext, id]) => `${ext}->${id}`)
            .join(', ') || '<none>'}; languageIds=${languageIds
            .map(([id, value]) => `${id}->${value}`)
            .join(', ') || '<none>'}`
        );
        log(
          `  lookup: fx->${lookup('fx')} (language funcscript->${langLookup('funcscript')}), cs->${lookup(
            'cs'
          )} (language csharp->${langLookup('csharp')})`
        );
        void vscode.window.showInformationMessage('FuncScript icon theme details logged.');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`Icon inspection failed: ${message}`);
        void vscode.window.showErrorMessage(`FuncScript icon inspection failed: ${message}`);
      }
    })
  );
}

export function deactivate() {}
