const fs = require('node:fs');
const path = require('node:path');
const runtime = require('@tewelde/funcscript');
const { FuncScriptParser } = require('@tewelde/funcscript/parser');
const pkg = require('../package.json');

const {
  evaluate,
  test,
  DefaultFsDataProvider,
  ensureTyped,
  typeOf,
  valueOf,
  FSDataType,
  getTypeName
} = runtime;

const SCRIPT_EXTENSIONS = new Set(['.fs', '.fx']);
const TEST_FILE_SUFFIX = '.test.fs';
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'bower_components',
  '.git',
  '.hg',
  '.svn',
  '.idea',
  '.vs',
  '.vscode',
  '.gradle',
  '.nuget',
  '.m2',
  'bin',
  'obj',
  'packages',
  'package',
  'dist',
  'build',
  'out',
  'target',
  'gradle',
  'coverage',
  'artifacts',
  'logs',
  'tmp',
  'temp',
  '__pycache__'
].map((name) => name.toLowerCase()));

function stringifyForLog(value) {
  if (value === undefined) {
    return 'undefined';
  }
  try {
    return JSON.stringify(
      value,
      (_, v) => (typeof v === 'bigint' ? v.toString() : v)
    );
  } catch (error) {
    return String(value);
  }
}

function toPlainValue(value, seenKvcs = new WeakSet(), seenLists = new WeakSet()) {
  const typed = ensureTyped(value);
  const dataType = typeOf(typed);
  switch (dataType) {
    case FSDataType.Null:
      return null;
    case FSDataType.Boolean:
    case FSDataType.Integer:
    case FSDataType.Float:
      return valueOf(typed);
    case FSDataType.BigInteger:
      return valueOf(typed).toString();
    case FSDataType.String:
      return valueOf(typed);
    case FSDataType.DateTime: {
      const date = valueOf(typed);
      return date instanceof Date ? date.toISOString() : String(date);
    }
    case FSDataType.Guid:
      return String(valueOf(typed));
    case FSDataType.ByteArray: {
      const buffer = valueOf(typed);
      return Buffer.from(buffer).toString('base64');
    }
    case FSDataType.List: {
      const list = valueOf(typed);
      if (seenLists.has(list)) {
        return '[Circular List]';
      }
      seenLists.add(list);
      const arr = [];
      for (const entry of list) {
        arr.push(toPlainValue(entry, seenKvcs, seenLists));
      }
      seenLists.delete(list);
      return arr;
    }
    case FSDataType.KeyValueCollection: {
      const collection = valueOf(typed);
      if (seenKvcs.has(collection)) {
        return '[Circular Object]';
      }
      seenKvcs.add(collection);
      const obj = {};
      for (const [key, val] of collection.getAll()) {
        obj[key] = toPlainValue(val, seenKvcs, seenLists);
      }
      seenKvcs.delete(collection);
      return obj;
    }
    case FSDataType.Error: {
      const err = valueOf(typed) || {};
      const payload = {
        errorType: err.errorType || 'Error',
        errorMessage: err.errorMessage || ''
      };
      if (err.errorData !== undefined && err.errorData !== null) {
        try {
          payload.errorData = Array.isArray(err.errorData) && err.errorData.length === 2 && typeof err.errorData[0] === 'number'
            ? toPlainValue(err.errorData, seenKvcs, seenLists)
            : err.errorData;
        } catch (inner) {
          payload.errorData = String(inner?.message || inner);
        }
      }
      return payload;
    }
    case FSDataType.Function:
      return '[Function]';
    default:
      return valueOf(typed);
  }
}

function formatJson(value, pretty = true) {
  return JSON.stringify(value, null, pretty ? 2 : 0);
}

function printHelp() {
  const lines = [
    'FuncScript CLI',
    '',
    'Usage:',
    "  fs-cli '<expr>'",
    "  fs-cli --test '<expr>' '<test-expr>'",
    '  fs-cli --scan <path>',
    '',
    'Flags:',
    '  --test, -t        Run the given test expression against the expression output.',
    '  --scan, -s        Recursively parse .fs/.fx files under the provided path and run paired tests.',
    '  --json            Print JSON output only.',
    '  --compact         Use compact JSON output.',
    '  --version, -v     Print CLI version.',
    '  --help, -h        Show this message.',
    '',
    'Examples:',
    "  fs-cli '1 + 2'",
    '  fs-cli --test "a + b" "{ suite: { cases: [{a:1,b:2}], test: (result, data) => result = data.a + data.b }; return [suite]; }"'
  ];
  console.log(lines.join('\n'));
}

function parseArgs(rawArgs) {
  if (!Array.isArray(rawArgs)) {
    return { mode: 'help' };
  }

  const options = {
    mode: 'eval',
    json: false,
    pretty: true,
    expression: null,
    testExpression: null,
    scanPath: null
  };

  const positionals = [];

  for (const arg of rawArgs) {
    switch (arg) {
      case '--help':
      case '-h':
        return { ...options, mode: 'help' };
      case '--version':
      case '-v':
        return { ...options, mode: 'version' };
      case '--self-test':
        return { ...options, mode: 'self-test' };
      case '--test':
      case '-t':
        options.mode = 'test';
        break;
      case '--scan':
      case '-s':
        options.mode = 'scan';
        break;
      case '--json':
        options.json = true;
        options.pretty = true;
        break;
      case '--compact':
        options.pretty = false;
        options.json = true;
        break;
      default:
        positionals.push(arg);
        break;
    }
  }

  if (options.mode === 'test') {
    [options.expression, options.testExpression] = positionals;
  } else if (options.mode === 'scan') {
    [options.scanPath] = positionals;
  } else {
    [options.expression] = positionals;
  }

  return options;
}

function ensureExpression(value, label) {
  if (!value || typeof value !== 'string') {
    throw new Error(`Missing ${label}.`);
  }
  return value;
}

function ensureScanPath(value) {
  if (!value || typeof value !== 'string') {
    throw new Error('Missing scan path.');
  }
  return value;
}

function evaluateExpression(expression) {
  const provider = new DefaultFsDataProvider();
  const typedResult = evaluate(expression, provider);
  const plain = toPlainValue(typedResult);
  const typeName = getTypeName(typeOf(ensureTyped(typedResult)));
  return { type: typeName, value: plain };
}

function runTestSuite(expression, testExpression) {
  const provider = new DefaultFsDataProvider();
  return test(expression, testExpression, provider);
}

function printEvaluation(expression, options) {
  const { json, pretty } = options;
  const result = evaluateExpression(expression);
  if (json) {
    console.log(formatJson(result, pretty));
    return;
  }
  console.log(`Type: ${result.type}`);
  console.log('Value:');
  console.log(formatJson(result.value, pretty));
}

function printTestResults(expression, testExpression, options) {
  const { json, pretty } = options;
  const result = runTestSuite(expression, testExpression);
  const summary = result?.summary || { cases: 0, passed: 0, failed: 0, suites: 0 };
  console.log(`Suites: ${summary.suites} | Cases: ${summary.cases} | Passed: ${summary.passed} | Failed: ${summary.failed}`);
  if (json) {
    console.log(formatJson(result, pretty));
  } else {
    console.log('Details:');
    console.log(formatJson(result, pretty));
  }
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

function shouldSkipDirectory(name) {
  if (!name) {
    return false;
  }
  return SKIPPED_DIRECTORIES.has(name.toLowerCase());
}

function relativeToRoot(root, filePath) {
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith('..')) {
    return filePath;
  }
  return relative || path.basename(filePath);
}

function createScanAggregate(root) {
  return {
    root,
    totalFiles: 0,
    parsedOk: 0,
    parseFailures: 0,
    parseErrors: [],
    testsTriggered: 0,
    testSuites: 0,
    testCases: 0,
    testFailures: 0,
    failedTests: [],
    skippedDirectories: [],
    skippedEntries: []
  };
}

function describeCaseError(error) {
  if (!error) {
    return 'Unknown test failure';
  }
  if (error.fsError) {
    const type = error.fsError.errorType || 'Error';
    const message = error.fsError.errorMessage || 'FuncScript assertion error.';
    return `${type}: ${message}`;
  }
  if (error.message) {
    return error.message;
  }
  if (error.errorMessage) {
    return error.errorMessage;
  }
  if (error.reason) {
    return error.reason;
  }
  return typeof error === 'string' ? error : JSON.stringify(error);
}

function extractCaseFailures(result) {
  const failures = [];
  if (!result || !Array.isArray(result.suites)) {
    return failures;
  }

  for (const suite of result.suites) {
    const suiteName = suite?.name || suite?.id || 'Suite';
    if (!Array.isArray(suite?.cases)) {
      continue;
    }
    for (const caseResult of suite.cases) {
      if (!caseResult || caseResult.passed !== false) {
        continue;
      }
      const errorDescription = describeCaseError(caseResult.error);
      const detail = {
        suite: suiteName,
        caseIndex: caseResult.index ?? null,
        message: errorDescription
      };
      if (caseResult.expressionResult !== undefined) {
        detail.expressionResult = caseResult.expressionResult;
      }
      if (caseResult.input !== undefined) {
        detail.input = caseResult.input;
      }
      if (caseResult.error?.stack) {
        detail.stack = caseResult.error.stack;
      }
      if (caseResult.error?.fsError) {
        detail.fsError = caseResult.error.fsError;
      }
      failures.push(detail);
    }
  }
  return failures;
}

function scanScripts(scanPath, options) {
  const targetPath = path.resolve(scanPath);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Scan path not found: ${scanPath}`);
  }

  const stats = fs.statSync(targetPath);
  const root = stats.isDirectory() ? targetPath : path.dirname(targetPath);
  const aggregate = createScanAggregate(root);

  if (stats.isDirectory()) {
    traverseDirectory(targetPath, aggregate);
  } else {
    processScriptCandidate(targetPath, aggregate);
  }

  printScanSummary(aggregate, options);

  if (aggregate.parseFailures > 0 || aggregate.testFailures > 0) {
    process.exitCode = 1;
  }
}

function traverseDirectory(startPath, aggregate) {
  const stack = [startPath];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      aggregate.skippedEntries.push({
        path: relativeToRoot(aggregate.root, current),
        reason: error?.message || String(error)
      });
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isSymbolicLink && entry.isSymbolicLink()) {
        continue;
      }
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) {
          aggregate.skippedDirectories.push(relativeToRoot(aggregate.root, fullPath));
          continue;
        }
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile()) {
        processScriptCandidate(fullPath, aggregate);
      }
    }
  }
}

function processScriptCandidate(filePath, aggregate) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SCRIPT_EXTENSIONS.has(ext)) {
    return;
  }
  processScriptFile(filePath, aggregate);
}

function processScriptFile(filePath, aggregate) {
  aggregate.totalFiles += 1;
  const relativePath = relativeToRoot(aggregate.root, filePath);
  let contents;
  try {
    contents = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    aggregate.parseFailures += 1;
    aggregate.parseErrors.push({
      file: relativePath,
      errors: [{ message: `Unable to read file: ${error?.message || error}` }]
    });
    console.log(`✖ read error: ${relativePath}`);
    process.exitCode = 1;
    return;
  }

  const errors = [];
  let parseException = null;
  try {
    FuncScriptParser.parse(new DefaultFsDataProvider(), contents, errors);
  } catch (error) {
    parseException = error;
  }

  if (parseException || errors.length > 0) {
    aggregate.parseFailures += 1;
    const errorList = errors.length > 0 ? errors : [{ Message: parseException?.message || String(parseException) }];
    aggregate.parseErrors.push({
      file: relativePath,
      errors: formatSyntaxErrors(errorList)
    });
    console.log(`✖ parse failed: ${relativePath}`);
    process.exitCode = 1;
    return;
  }

  aggregate.parsedOk += 1;
  console.log(`✔ parsed: ${relativePath}`);
  maybeRunCompanionTest(filePath, contents, aggregate);
}

function maybeRunCompanionTest(filePath, expression, aggregate) {
  const lowered = filePath.toLowerCase();
  if (lowered.endsWith(TEST_FILE_SUFFIX)) {
    return;
  }
  const ext = path.extname(filePath);
  const basePath = filePath.slice(0, -ext.length);
  const testPath = `${basePath}${TEST_FILE_SUFFIX}`;

  if (!fs.existsSync(testPath)) {
    return;
  }

  let stats;
  try {
    stats = fs.statSync(testPath);
  } catch (error) {
    aggregate.testFailures += 1;
    aggregate.failedTests.push({
      file: relativeToRoot(aggregate.root, filePath),
      testFile: relativeToRoot(aggregate.root, testPath),
      error: `Unable to stat test file: ${error?.message || error}`
    });
    console.log(`✖ test access failed: ${relativeToRoot(aggregate.root, filePath)}`);
    process.exitCode = 1;
    return;
  }

  if (!stats.isFile()) {
    return;
  }

  aggregate.testsTriggered += 1;
  const relativeScript = relativeToRoot(aggregate.root, filePath);
  const relativeTest = relativeToRoot(aggregate.root, testPath);
  let testExpression;
  try {
    testExpression = fs.readFileSync(testPath, 'utf8');
  } catch (error) {
    aggregate.testFailures += 1;
    aggregate.failedTests.push({
      file: relativeScript,
      testFile: relativeTest,
      error: `Unable to read test file: ${error?.message || error}`
    });
    console.log(`✖ test read failed: ${relativeScript}`);
    process.exitCode = 1;
    return;
  }

  let result;
  try {
    result = runTestSuite(expression, testExpression);
  } catch (error) {
    aggregate.testFailures += 1;
    aggregate.failedTests.push({
      file: relativeScript,
      testFile: relativeTest,
      error: error?.message || String(error)
    });
    console.log(`✖ tests crashed: ${relativeScript}`);
    process.exitCode = 1;
    return;
  }

  const summary = normalizeTestSummary(result?.summary);
  aggregate.testSuites += summary.suites;
  aggregate.testCases += summary.cases;
  aggregate.testFailures += summary.failed;

  if (summary.failed > 0) {
    aggregate.failedTests.push({
      file: relativeScript,
      testFile: relativeTest,
      summary,
      details: result,
      caseFailures: extractCaseFailures(result)
    });
    console.log(`✖ tests failed: ${relativeScript} (${summary.failed} failed)`);
    process.exitCode = 1;
  } else {
    console.log(`✔ tests passed: ${relativeScript} (${summary.cases} cases)`);
  }
}

function formatSyntaxErrors(errors) {
  return errors.map((err) => {
    const formatted = {
      message: err?.Message || err?.message || String(err)
    };
    if (typeof err?.Loc === 'number') {
      formatted.position = err.Loc;
    }
    if (typeof err?.Length === 'number') {
      formatted.length = err.Length;
    }
    return formatted;
  });
}

function normalizeTestSummary(summary) {
  if (!summary) {
    return { suites: 0, cases: 0, passed: 0, failed: 0 };
  }
  return {
    suites: summary.suites ?? 0,
    cases: summary.cases ?? 0,
    passed: summary.passed ?? 0,
    failed: summary.failed ?? 0
  };
}

function buildScanSummary(aggregate) {
  return {
    root: aggregate.root,
    totalFiles: aggregate.totalFiles,
    parsedOk: aggregate.parsedOk,
    parseFailures: aggregate.parseFailures,
    testsTriggered: aggregate.testsTriggered,
    testSuites: aggregate.testSuites,
    testCases: aggregate.testCases,
    testFailures: aggregate.testFailures,
    skippedDirectories: aggregate.skippedDirectories,
    skippedEntries: aggregate.skippedEntries,
    parseErrors: aggregate.parseErrors,
    failedTests: aggregate.failedTests
  };
}

function printScanSummary(aggregate, options) {
  const summary = buildScanSummary(aggregate);
  if (options.json) {
    console.log(formatJson(summary, options.pretty));
    return;
  }

  console.log('');
  console.log('Scan Summary:');
  console.log(`  Root: ${summary.root}`);
  console.log(`  Files parsed successfully: ${summary.parsedOk}/${summary.totalFiles}`);
  console.log(`  Parse failures: ${summary.parseFailures}`);
  console.log(`  Files with tests: ${summary.testsTriggered}`);
  console.log(`  Test cases: ${summary.testCases} (failed: ${summary.testFailures})`);

  if (summary.skippedDirectories.length > 0) {
    console.log('  Skipped directories:');
    for (const dir of summary.skippedDirectories) {
      console.log(`    - ${dir}`);
    }
  }

  if (summary.skippedEntries.length > 0) {
    console.log('  Inaccessible entries:');
    for (const entry of summary.skippedEntries) {
      console.log(`    - ${entry.path}: ${entry.reason}`);
    }
  }

  if (summary.parseErrors.length > 0) {
    console.log('\nParse Failures:');
    for (const failure of summary.parseErrors) {
      console.log(`  - ${failure.file}`);
      for (const err of failure.errors) {
        const loc = typeof err.position === 'number' ? ` @${err.position}` : '';
        const len = typeof err.length === 'number' ? ` len=${err.length}` : '';
        console.log(`      ${loc}${len} ${err.message}`);
      }
    }
  }

  if (summary.failedTests.length > 0) {
    console.log('\nFailed Tests:');
    for (const failure of summary.failedTests) {
      const descriptor = failure.summary
        ? `${failure.summary.failed} failed case(s)`
        : failure.error || 'Unknown test error';
      console.log(`  - ${failure.file} (tests: ${failure.testFile || 'n/a'}): ${descriptor}`);
      if (Array.isArray(failure.caseFailures) && failure.caseFailures.length > 0) {
        for (const caseFailure of failure.caseFailures) {
          const caseLabel = caseFailure.caseIndex != null ? `Case #${caseFailure.caseIndex}` : 'Case';
          const suiteLabel = caseFailure.suite ? ` [${caseFailure.suite}]` : '';
          console.log(`      ${caseLabel}${suiteLabel}: ${caseFailure.message}`);
          if (caseFailure.input !== undefined) {
            console.log(`        Input: ${stringifyForLog(caseFailure.input)}`);
          }
          if (caseFailure.expressionResult !== undefined) {
            console.log(`        Result: ${stringifyForLog(caseFailure.expressionResult)}`);
          }
        }
      }
    }
  }
}

function runSelfTest() {
  const evalResult = evaluateExpression('1 + 2');
  if (evalResult.value !== 3) {
    throw new Error('Self-test evaluation failed.');
  }

  const testExpression = `
{
  sampleSuite: {
    name: "addition";
    cases: [
      { "a": 1, "b": 2 }
    ];
    test: (result, data) => result = data.a + data.b
  };

  return [sampleSuite];
}`;

  const testResult = runTestSuite('a + b', testExpression);
  if (testResult.summary.failed !== 0) {
    throw new Error('Self-test suite reported failures.');
  }
  console.log('Self-test passed.');
}

function runCli(rawArgs) {
  try {
    const options = parseArgs(rawArgs);
    switch (options.mode) {
      case 'help':
        printHelp();
        break;
      case 'version':
        console.log(pkg.version);
        break;
      case 'self-test':
        runSelfTest();
        break;
      case 'scan': {
        const scanPath = ensureScanPath(options.scanPath);
        scanScripts(scanPath, options);
        break;
      }
      case 'test': {
        const expression = ensureExpression(options.expression, 'expression');
        const testExpression = ensureExpression(options.testExpression, 'test expression');
        printTestResults(expression, testExpression, options);
        break;
      }
      case 'eval':
      default: {
        const expression = ensureExpression(options.expression, 'expression');
        printEvaluation(expression, options);
        break;
      }
    }
  } catch (error) {
    console.error(error?.message || error);
    if (error?.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  }
}

module.exports = {
  toPlainValue,
  evaluateExpression,
  runTestSuite,
  runCli
};
