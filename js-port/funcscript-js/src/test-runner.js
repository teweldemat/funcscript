const { SimpleKeyValueCollection } = require('./model/key-value-collection');

const createTestRunner = ({
  FuncScriptParser,
  DefaultFsDataProvider,
  assertTyped,
  expectType,
  typeOf,
  valueOf,
  typedNull,
  KvcProvider,
  ParameterList,
  FSDataType
}) => {
  class FixedParameterList extends ParameterList {
    constructor(values) {
      super();
      const safeValues = Array.isArray(values) ? values : [];
      this.values = safeValues.map((val) => assertTyped(val ?? typedNull()));
    }

    get count() {
      return this.values.length;
    }

    getParameter(_, index) {
      if (index < 0 || index >= this.values.length) {
        return typedNull();
      }
      return this.values[index];
    }
  }

  function parseBlock(provider, source, label) {
    const { block } = FuncScriptParser.parse(provider, source);
    if (!block) {
      throw new Error(`Failed to parse ${label}.`);
    }
    return block;
  }

  function ensureList(value, message) {
    const typed = expectType(assertTyped(value), FSDataType.List, message);
    return valueOf(typed);
  }

  function ensureKeyValue(value, message) {
    const typed = expectType(assertTyped(value), FSDataType.KeyValueCollection, message);
    return { typed, collection: valueOf(typed) };
  }

  function convertErrorData(data, seenKvcs, seenLists) {
    if (!data) {
      return data;
    }
    if (Array.isArray(data) && data.length === 2 && typeof data[0] === 'number') {
      try {
        return convertValue(data, seenKvcs, seenLists);
      } catch (err) {
        return { error: String(err?.message || err) };
      }
    }
    return data;
  }

  function convertValue(value, seenKvcs = new WeakSet(), seenLists = new WeakSet()) {
    const typed = assertTyped(value);
    const dataType = typeOf(typed);
    switch (dataType) {
      case FSDataType.Null:
      case FSDataType.Boolean:
      case FSDataType.Integer:
      case FSDataType.BigInteger:
      case FSDataType.Float:
      case FSDataType.String:
      case FSDataType.DateTime:
      case FSDataType.Guid:
      case FSDataType.ByteArray:
        return valueOf(typed);
      case FSDataType.List: {
        const list = valueOf(typed);
        if (seenLists.has(list)) {
          return '[Circular]';
        }
        seenLists.add(list);
        const arr = [];
        for (const entry of list) {
          arr.push(convertValue(entry, seenKvcs, seenLists));
        }
        seenLists.delete(list);
        return arr;
      }
      case FSDataType.KeyValueCollection: {
        const collection = valueOf(typed);
        if (seenKvcs.has(collection)) {
          return '[Circular]';
        }
        seenKvcs.add(collection);
        const obj = {};
        for (const [key, val] of collection.getAll()) {
          obj[key] = convertValue(val, seenKvcs, seenLists);
        }
        seenKvcs.delete(collection);
        return obj;
      }
      case FSDataType.Error: {
        const err = valueOf(typed) || {};
        return {
          errorType: err.errorType || 'Error',
          errorMessage: err.errorMessage || '',
          errorData: convertErrorData(err.errorData, seenKvcs, seenLists)
        };
      }
      case FSDataType.Function:
        return '[Function]';
      default:
        return valueOf(typed);
    }
  }

  function formatCaseError(type, error) {
    if (!error) {
      return { type, message: '' };
    }
    if (typeof error === 'string') {
      return { type, message: error };
    }
    return {
      type,
      message: error.message || String(error),
      stack: error.stack
    };
  }

  function caseLabel(suite, caseData) {
    const suiteName = suite?.name || suite?.id || 'Suite';
    return `Case #${caseData.index} in suite "${suiteName}"`;
  }

  function interpretAssertionOutcome(typedResult) {
    const typed = assertTyped(typedResult);
    const resultType = typeOf(typed);
    if (resultType === FSDataType.Error) {
      const err = valueOf(typed) || {};
      return {
        passed: false,
        failure: {
          type: 'assertion',
          reason: 'fs_error',
          fsError: {
            errorType: err.errorType || 'Error',
            errorMessage: err.errorMessage || '',
            errorData: convertErrorData(err.errorData, new WeakSet(), new WeakSet())
          }
        }
      };
    }
    if (resultType === FSDataType.Boolean) {
      const passed = Boolean(valueOf(typed));
      if (!passed) {
        return {
          passed: false,
          failure: {
            type: 'assertion',
            reason: 'boolean_false',
            message: 'Assertion returned false.'
          }
        };
      }
    }
    return { passed: true };
  }

  function invokeFunction(fnTyped, provider, args) {
    const typedFunction = expectType(assertTyped(fnTyped), FSDataType.Function, 'Test definition must be a function.');
    const fn = valueOf(typedFunction);
    const parameters = new FixedParameterList(args);
    const result = fn.evaluate(provider, parameters);
    return assertTyped(result);
  }

  function extractTestList(rawTests, suiteName) {
    const list = ensureList(rawTests, `Suite "${suiteName}" tests must be a list.`);
    const tests = [];
    let index = 0;
    for (const entry of list) {
      index += 1;
      const fn = expectType(assertTyped(entry), FSDataType.Function, `Test #${index} in suite "${suiteName}" must be a function.`);
      tests.push({ fn, index });
    }
    if (tests.length === 0) {
      throw new Error(`Suite "${suiteName}" tests list cannot be empty.`);
    }
    return tests;
  }

  function extractSuites(rawSuites) {
    const suiteList = ensureList(rawSuites, 'Test expression must return a list of testSuit objects.');
    const suites = [];
    let index = 0;
    for (const entry of suiteList) {
      index += 1;
      const { typed, collection } = ensureKeyValue(entry, `Test suite at index ${index} must be an object.`);
      const suiteId = `suite_${index}`;
      const nameValue = collection.get('name');
      let displayName = `Suite ${index}`;
      if (nameValue !== null && nameValue !== undefined) {
        const typedName = assertTyped(nameValue);
        displayName = String(valueOf(typedName));
        if (!displayName.trim()) {
          displayName = `Suite ${index}`;
        }
      }

      const casesRaw = collection.get('cases');
      const cases = [];
      if (casesRaw === null || casesRaw === undefined) {
        cases.push(createEmptyCase());
      } else {
        const caseList = ensureList(casesRaw, `Suite "${displayName}" cases must be a list.`);
        let caseIndex = 0;
        for (const caseEntry of caseList) {
          caseIndex += 1;
          const { typed: caseTyped, collection: caseCollection } = ensureKeyValue(
            caseEntry,
            `Case #${caseIndex} in suite "${displayName}" must be an object.`
          );
          cases.push({ index: caseIndex, typed: caseTyped, collection: caseCollection });
        }
        if (caseList.length === 0) {
          cases.push(createEmptyCase());
        }
      }

      const testRaw = collection.get('test');
      const testsRaw = collection.get('tests');
      let singleTest = null;
      let multipleTests = null;
      if (testRaw !== null && testRaw !== undefined) {
        singleTest = expectType(assertTyped(testRaw), FSDataType.Function, `Suite "${displayName}" test must be a function.`);
      } else if (testsRaw !== null && testsRaw !== undefined) {
        multipleTests = extractTestList(testsRaw, displayName);
      } else {
        throw new Error(`Test suite "${displayName}" is missing a test definition.`);
      }

      suites.push({
        id: suiteId,
        name: displayName,
        cases,
        singleTest,
        multipleTests
      });
    }
    return suites;
  }

  function createEmptyCase() {
    const collection = new SimpleKeyValueCollection(null, []);
    return {
      index: 1,
      typed: [FSDataType.KeyValueCollection, collection],
      collection
    };
  }

  function runSingleTest(testFn, caseProvider, args) {
    try {
      const typedResult = invokeFunction(testFn, caseProvider, args);
      if (typeOf(typedResult) === FSDataType.List) {
        const list = valueOf(typedResult);
        const details = [];
        let aggregateFailure = null;
        let passed = true;
        let index = 0;
        for (const entry of list) {
          index += 1;
          const typedEntry = assertTyped(entry);
          const { passed: childPassed, failure } = interpretAssertionOutcome(typedEntry);
          const detail = {
            index,
            passed: childPassed,
            result: convertValue(typedEntry)
          };
          if (!childPassed) {
            passed = false;
            if (failure) {
              detail.error = failure;
              aggregateFailure = aggregateFailure || failure;
            }
          }
          details.push(detail);
        }
        return {
          passed,
          failure: aggregateFailure,
          plainResult: convertValue(typedResult),
          details
        };
      }
      const plainResult = convertValue(typedResult);
      const { passed, failure } = interpretAssertionOutcome(typedResult);
      return { passed, failure, plainResult };
    } catch (error) {
      return {
        passed: false,
        error: formatCaseError('assertion', error),
        plainResult: null
      };
    }
  }

  function runMultipleTests(testFns, caseProvider, args) {
    const details = [];
    for (const testEntry of testFns) {
      let typedResult;
      try {
        typedResult = invokeFunction(testEntry.fn, caseProvider, args);
      } catch (error) {
        const errInfo = formatCaseError('assertion', error);
        errInfo.testIndex = testEntry.index;
        details.push({ index: testEntry.index, passed: false, result: null, error: errInfo });
        return { passed: false, error: errInfo, details };
      }
      const plainResult = convertValue(typedResult);
      const { passed, failure } = interpretAssertionOutcome(typedResult);
      const detail = { index: testEntry.index, passed, result: plainResult };
      if (!passed && failure) {
        const enrichedFailure = { ...failure, testIndex: testEntry.index };
        detail.error = enrichedFailure;
        details.push(detail);
        return { passed: false, failure: enrichedFailure, details };
      }
      details.push(detail);
    }
    return { passed: true, details };
  }

  function runCase(expressionBlock, baseProvider, suite, caseData, createCaseProvider) {
    const ambientValue = caseData.collection.get('ambient');
    let providerCollection = caseData.collection;
    if (ambientValue !== null && ambientValue !== undefined) {
      const typedAmbient = assertTyped(ambientValue);
      if (typeOf(typedAmbient) === FSDataType.Null) {
        providerCollection = new SimpleKeyValueCollection();
      } else {
        const { collection: ambientCollection } = ensureKeyValue(
          typedAmbient,
          `${caseLabel(suite, caseData)} ambient must be an object.`
        );
        providerCollection = ambientCollection;
      }
    }

    const caseProvider = createCaseProvider
      ? createCaseProvider(providerCollection, baseProvider, suite, caseData)
      : new KvcProvider(providerCollection, baseProvider);
    const caseResult = {
      index: caseData.index,
      input: convertValue(caseData.typed)
    };

    let expressionValue;
    try {
      expressionValue = assertTyped(expressionBlock.evaluate(caseProvider));
      if (typeOf(expressionValue) === FSDataType.Function) {
        const inputValue = caseData.collection.get('input');
        if (inputValue !== null && inputValue !== undefined) {
          const inputList = ensureList(inputValue, `${caseLabel(suite, caseData)} input must be a list.`);
          const args = [];
          for (const entry of inputList) {
            args.push(entry);
          }
          expressionValue = invokeFunction(expressionValue, caseProvider, args);
        }
      }
      caseResult.expressionResult = convertValue(expressionValue);
    } catch (error) {
      caseResult.error = formatCaseError('evaluation', error);
      caseResult.passed = false;
      return caseResult;
    }

    const args = [expressionValue, caseData.typed];
    if (suite.singleTest) {
      const outcome = runSingleTest(suite.singleTest, caseProvider, args);
      caseResult.assertionResult = outcome.details ?? outcome.plainResult;
      if (outcome.error) {
        caseResult.error = outcome.error;
        caseResult.passed = false;
        return caseResult;
      }
      caseResult.passed = outcome.passed;
      if (!outcome.passed && outcome.failure) {
        caseResult.error = outcome.failure;
      }
      return caseResult;
    }

    if (suite.multipleTests) {
      const outcome = runMultipleTests(suite.multipleTests, caseProvider, args);
      caseResult.assertionResult = outcome.details;
      if (outcome.error) {
        caseResult.error = outcome.error;
        caseResult.passed = false;
        return caseResult;
      }
      caseResult.passed = outcome.passed;
      if (!outcome.passed && outcome.failure) {
        caseResult.error = outcome.failure;
      }
      return caseResult;
    }

    caseResult.passed = true;
    return caseResult;
  }

  return function test(expression, testExpression, provider = new DefaultFsDataProvider(), options = null) {
    if (typeof expression !== 'string') {
      throw new TypeError('expression must be a string');
    }
    if (typeof testExpression !== 'string') {
      throw new TypeError('testExpression must be a string');
    }

    const baseProvider = provider ?? new DefaultFsDataProvider();
    const createCaseProvider =
      options && typeof options.createCaseProvider === 'function' ? options.createCaseProvider : null;
    const expressionBlock = parseBlock(baseProvider, expression, 'expression under test');
    const testBlock = parseBlock(baseProvider, testExpression, 'test expression');
    const suitesValue = assertTyped(testBlock.evaluate(baseProvider));
    const suites = extractSuites(suitesValue);

    const suiteResults = [];
    let totalPassed = 0;
    let totalFailed = 0;
    let totalCases = 0;

    for (const suite of suites) {
      const caseResults = [];
      let suitePassed = 0;
      let suiteFailed = 0;
      for (const caseData of suite.cases) {
        const result = runCase(expressionBlock, baseProvider, suite, caseData, createCaseProvider);
        caseResults.push(result);
        if (result.passed) {
          suitePassed += 1;
          totalPassed += 1;
        } else {
          suiteFailed += 1;
          totalFailed += 1;
        }
      }
      totalCases += suite.cases.length;
      suiteResults.push({
        id: suite.id,
        name: suite.name,
        summary: {
          total: suite.cases.length,
          passed: suitePassed,
          failed: suiteFailed
        },
        cases: caseResults
      });
    }

    return {
      suites: suiteResults,
      summary: {
        suites: suiteResults.length,
        cases: totalCases,
        passed: totalPassed,
        failed: totalFailed
      }
    };
  };
};

module.exports = createTestRunner;
