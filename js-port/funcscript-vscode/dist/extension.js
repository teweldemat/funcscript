"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const analysis_1 = require("./analysis");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const tokenTypesLegend = [
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
const tokenModifiersLegend = [];
const legend = new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend);
const NODE_TYPE_TOKEN = {
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
const FALLBACK_TOKEN = 'variable';
const SKIP_NODE_TYPES = new Set([
    'RootExpression',
    'WhiteSpace',
    'InfixExpression',
    'GeneralInfixExpression',
    'KeyValuePair'
]);
const outputChannelId = 'FuncScript';
let outputChannel;
const log = (message) => {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel(outputChannelId);
    }
    const timestamp = new Date().toISOString();
    outputChannel.appendLine(`[${timestamp}] ${message}`);
};
const readJson = (filePath) => {
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(raw);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`Failed to read JSON at ${filePath}: ${message}`);
        return null;
    }
};
class DocumentAnalysisCache {
    constructor() {
        this.cache = new Map();
    }
    get(document) {
        const key = document.uri.toString();
        const current = this.cache.get(key);
        if (current && current.version === document.version) {
            return current.outcome;
        }
        const rawText = document.getText();
        try {
            const outcome = (0, analysis_1.analyzeText)(rawText);
            this.cache.set(key, { version: document.version, outcome });
            log(`Analyzed ${document.uri.toString()} (segments=${outcome.segments.length})`);
            return outcome;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Failed to analyze ${document.uri.toString()}: ${message}`);
            const empty = { parseNode: null, segments: [], text: rawText };
            this.cache.set(key, { version: document.version, outcome: empty });
            return empty;
        }
    }
    evict(document) {
        this.cache.delete(document.uri.toString());
        log(`Evicted analysis cache for ${document.uri.toString()}`);
    }
}
const isMeaningful = (text) => text.trim().length > 0;
const toRange = (document, start, end, docLength) => {
    const safeStart = Math.max(0, Math.min(start, docLength));
    const safeEnd = Math.max(safeStart, Math.min(end, docLength));
    const startPos = document.positionAt(safeStart);
    const endPos = document.positionAt(safeEnd);
    return new vscode.Range(startPos, endPos);
};
class FuncScriptSemanticTokensProvider {
    constructor(cache) {
        this.cache = cache;
    }
    async provideDocumentSemanticTokens(document, _token) {
        const analysis = this.cache.get(document);
        const { segments, text } = analysis;
        if (segments.length === 0) {
            log(`No semantic segments returned for ${document.uri.toString()}`);
            return new vscode.SemanticTokens(new Uint32Array());
        }
        log(`Segments from analysis for ${document.uri.toString()}: ${segments.length}`);
        for (const segment of segments.slice(0, 20)) {
            log(`  segment start=${segment.start} end=${segment.end} length=${segment.end - segment.start} type=${segment.nodeType}`);
        }
        if (segments.length > 20) {
            log(`  ... ${segments.length - 20} more segments omitted ...`);
        }
        const builder = new vscode.SemanticTokensBuilder(legend);
        const docLength = analysis.text.length;
        const unknownNodeTypes = new Set();
        let pushed = 0;
        const pushedSegments = [];
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
            const emitRange = (start, end) => {
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
                log(`  pushing token type=${tokenType} range=(${start.line}:${start.character})-(${end.line}:${end.character}) snippet="${snippet}"`);
            };
            if (range.start.line === range.end.line) {
                emitRange(range.start, range.end);
                continue;
            }
            emitRange(range.start, new vscode.Position(range.start.line, document.lineAt(range.start.line).range.end.character));
            for (let line = range.start.line + 1; line < range.end.line; line += 1) {
                const lineRange = document.lineAt(line).range;
                if (!lineRange.isEmpty) {
                    emitRange(new vscode.Position(line, 0), lineRange.end);
                }
            }
            emitRange(new vscode.Position(range.end.line, 0), range.end);
        }
        if (unknownNodeTypes.size > 0) {
            log(`Falling back to '${FALLBACK_TOKEN}' for node types in ${document.uri.toString()}: ${Array.from(unknownNodeTypes).join(', ')}`);
        }
        log(`Semantic tokens emitted for ${document.uri.toString()}: ${pushed}`);
        if (pushed > 0) {
            for (const segment of pushedSegments.slice(0, 20)) {
                log(`  token line=${segment.line} col=${segment.character} length=${segment.length} type=${segment.type}`);
            }
            if (pushedSegments.length > 20) {
                log(`  ... ${pushedSegments.length - 20} more segments omitted ...`);
            }
        }
        return builder.build();
    }
}
const clampPosition = (document, index, docLength) => {
    const safeIndex = Math.max(0, Math.min(index, docLength));
    return document.positionAt(safeIndex);
};
const foldRegionToRange = (document, region, docLength) => {
    const start = clampPosition(document, region.start, docLength);
    const end = clampPosition(document, Math.max(region.end - 1, region.start), docLength);
    if (end.line <= start.line) {
        return null;
    }
    return { start, end };
};
class FuncScriptFoldingRangeProvider {
    constructor(cache) {
        this.cache = cache;
    }
    provideFoldingRanges(document, _context, _token) {
        const analysis = this.cache.get(document);
        const docLength = analysis.text.length;
        const regions = (0, analysis_1.collectFoldRegions)(analysis.parseNode, docLength);
        if (!regions.length) {
            return [];
        }
        const byLine = new Map();
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
const logInitializationDetails = (context) => {
    log(`Host: node ${process.version}; platform=${process.platform}; arch=${process.arch}`);
    const manifestPath = path.join(context.extensionPath, 'package.json');
    const manifest = readJson(manifestPath);
    if (manifest?.version) {
        log(`Extension version: ${manifest.version}`);
    }
    try {
        const runtimePackagePath = require.resolve('@tewelde/funcscript/package.json', {
            paths: [context.extensionPath]
        });
        const runtimePackage = readJson(runtimePackagePath);
        log(`Runtime resolved: ${runtimePackagePath} (version=${runtimePackage?.version ?? '<unknown>'})`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`Runtime resolution failed: ${message}`);
    }
    try {
        const sample = (0, analysis_1.analyzeText)('{ x:1; }');
        log(`Runtime self-check: sample parse segments=${sample.segments.length}; parseNode=${sample.parseNode ? 'present' : 'null'}`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`Runtime self-check failed: ${message}`);
    }
};
function activate(context) {
    outputChannel = vscode.window.createOutputChannel(outputChannelId);
    log('Activating FuncScript extension');
    logInitializationDetails(context);
    const iconThemeSetting = vscode.workspace.getConfiguration('workbench').get('iconTheme');
    log(`Current workbench.iconTheme: ${iconThemeSetting ?? '<unset>'}`);
    const iconUri = vscode.Uri.joinPath(context.extensionUri, 'media', 'funcscript-icon.svg');
    vscode.workspace.fs.stat(iconUri).then(() => log(`FuncScript icon resource found at ${iconUri.toString(true)}`), (error) => log(`FuncScript icon resource missing: ${error instanceof Error ? error.message : String(error)}`));
    const cache = new DocumentAnalysisCache();
    const selector = { language: 'funcscript' };
    context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider(selector, new FuncScriptSemanticTokensProvider(cache), legend));
    context.subscriptions.push(vscode.languages.registerFoldingRangeProvider(selector, new FuncScriptFoldingRangeProvider(cache)));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((document) => cache.evict(document)));
    context.subscriptions.push(outputChannel);
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('workbench.iconTheme')) {
            const updated = vscode.workspace
                .getConfiguration('workbench')
                .get('iconTheme');
            log(`workbench.iconTheme changed to ${updated ?? '<unset>'}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('funcscript.selectIconTheme', async () => {
        try {
            await vscode.workspace
                .getConfiguration('workbench')
                .update('iconTheme', 'funcscript-icons', vscode.ConfigurationTarget.Global);
            log('workbench.iconTheme updated to funcscript-icons');
            void vscode.window.showInformationMessage('FuncScript icon theme applied.');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Failed to set icon theme: ${message}`);
            void vscode.window.showErrorMessage(`Failed to apply FuncScript icon theme: ${message}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('funcscript.inspectIconMapping', async () => {
        try {
            const workbenchConfig = vscode.workspace.getConfiguration('workbench');
            const current = workbenchConfig.get('iconTheme');
            log(`Inspecting icon theme. workbench.iconTheme=${current ?? '<unset>'}`);
            const inspected = workbenchConfig.inspect('iconTheme');
            if (inspected) {
                log(`  iconTheme scope -> default=${inspected.defaultValue ?? '<unset>'}, global=${inspected.globalValue ?? '<unset>'}, workspace=${inspected.workspaceValue ?? '<unset>'}`);
            }
            const themeUri = vscode.Uri.joinPath(context.extensionUri, 'themes', 'funcscript-icon-theme.json');
            const raw = await vscode.workspace.fs.readFile(themeUri);
            const text = new TextDecoder('utf-8').decode(raw);
            const parsed = JSON.parse(text);
            const iconPath = parsed.iconDefinitions?.funcscriptFile?.iconPath ?? '<missing>';
            const fileExts = parsed.fileExtensions ? Object.entries(parsed.fileExtensions) : [];
            const languageIds = parsed.languageIds ? Object.entries(parsed.languageIds) : [];
            const lookup = (key) => fileExts.find(([ext]) => ext === key)?.[1] ?? '<none>';
            const langLookup = (key) => languageIds.find(([id]) => id === key)?.[1] ?? '<none>';
            log(`  funcscriptFile iconPath=${iconPath}; fileExtensions=${fileExts
                .map(([ext, id]) => `${ext}->${id}`)
                .join(', ') || '<none>'}; languageIds=${languageIds
                .map(([id, value]) => `${id}->${value}`)
                .join(', ') || '<none>'}`);
            log(`  lookup: fx->${lookup('fx')} (language funcscript->${langLookup('funcscript')}), cs->${lookup('cs')} (language csharp->${langLookup('csharp')})`);
            void vscode.window.showInformationMessage('FuncScript icon theme details logged.');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            log(`Icon inspection failed: ${message}`);
            void vscode.window.showErrorMessage(`FuncScript icon inspection failed: ${message}`);
        }
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map