import * as vscode from 'vscode';
import { analyzeText, collectFoldRegions, ParseOutcome } from './analysis';
import type { ParseNode } from '@tewelde/funcscript/parser';

const tokenTypesLegend: vscode.SemanticTokensLegend['tokenTypes'] = [
  'comment',
  'string',
  'number',
  'keyword',
  'variable',
  'operator',
  'property',
  'function'
];

const tokenModifiersLegend: vscode.SemanticTokensLegend['tokenModifiers'] = [];

const legend = new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);

type TokenType = (typeof tokenTypesLegend)[number];

type NodeTypeClassifier = Partial<Record<string, TokenType>>;

const NODE_TYPE_TOKEN: NodeTypeClassifier = {
  Comment: 'comment',
  FunctionParameterList: 'variable',
  FunctionCall: 'function',
  MemberAccess: 'property',
  Selection: 'property',
  InfixExpression: 'operator',
  LiteralInteger: 'number',
  KeyWord: 'keyword',
  LiteralDouble: 'number',
  LiteralLong: 'number',
  Identifier: 'variable',
  IdentiferList: 'variable',
  Operator: 'operator',
  LambdaExpression: 'function',
  ExpressionInBrace: 'operator',
  LiteralString: 'string',
  StringTemplate: 'string',
  KeyValuePair: 'property',
  KeyValueCollection: 'property',
  List: 'variable',
  Key: 'property',
  Case: 'keyword',
  DataConnection: 'function',
  NormalErrorSink: 'keyword',
  SigSequence: 'keyword',
  ErrorKeyWord: 'keyword',
  SignalConnection: 'function',
  GeneralInfixExpression: 'operator',
  PrefixOperatorExpression: 'operator'
};

const FALLBACK_TOKEN: TokenType = 'variable';

const outputChannelId = 'FuncScript';
let outputChannel: vscode.OutputChannel | undefined;

const log = (message: string) => {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(outputChannelId);
  }
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[${timestamp}] ${message}`);
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
      const explicitToken = NODE_TYPE_TOKEN[segment.nodeType];
      const tokenType = explicitToken ?? FALLBACK_TOKEN;
      if (!explicitToken) {
        unknownNodeTypes.add(segment.nodeType);
      }

      const segmentText = text.slice(segment.start, segment.end);
      if (!isMeaningful(segmentText)) {
        log(
          `  skipped segment start=${segment.start} end=${segment.end} type=${segment.nodeType} (non-meaningful)`
        );
        continue;
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

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel(outputChannelId);
  log('Activating FuncScript extension');
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
}

export function deactivate() {}
