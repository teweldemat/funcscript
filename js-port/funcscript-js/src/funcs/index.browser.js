const { ensureTyped } = require('../core/value');

const { IFFunction } = require('./logic/if-function');
const { EqualsFunction } = require('./logic/equals-function');
const { NotEqualsFunction } = require('./logic/not-equals-function');
const { GreaterThanFunction } = require('./logic/greater-than-function');
const { GreaterThanOrEqualFunction } = require('./logic/greater-than-or-equal-function');
const { LessThanFunction } = require('./logic/less-than-function');
const { LessThanOrEqualFunction } = require('./logic/less-than-or-equal-function');
const { AndFunction } = require('./logic/and-function');
const { OrFunction } = require('./logic/or-function');
const { InFunction } = require('./logic/in-function');
const { ReplaceIfNullFunction } = require('./logic/replace-if-null');
const { EvaluateIfNotNullFunction } = require('./logic/evaluate-if-not-null');
const { NotFunction } = require('./logic/not-function');
const { CaseFunction } = require('./logic/case-function');
const { SwitchFunction } = require('./logic/switch-function');

const { AddFunction } = require('./math/add-function');
const { SubtractFunction } = require('./math/subtract-function');
const { MultiplyFunction } = require('./math/multiply-function');
const { DivisionFunction } = require('./math/division-function');
const { DivFunction } = require('./math/div-function');
const { NegateFunction } = require('./math/negate-function');
const { ModuloFunction } = require('./math/modulo-function');
const {
  SineFunction,
  CosineFunction,
  TangentFunction,
  ArcSineFunction,
  ArcCosineFunction,
  ArcTangentFunction
} = require('./math/trigonometry-functions');
const {
  SquareRootFunction,
  AbsoluteValueFunction,
  PowerFunction,
  ExponentialFunction,
  NaturalLogFunction,
  Log10Function,
  CeilingFunction,
  FloorFunction,
  RoundFunction,
  TruncateFunction,
  SignFunction,
  MinFunction,
  MaxFunction,
  ClampFunction,
  RandomFunction
} = require('./math/advanced-functions');

const { MapListFunction } = require('./list/map-list-function');
const { ReduceListFunction } = require('./list/reduce-list-function');
const { FilterListFunction } = require('./list/filter-list-function');
const { ReverseListFunction } = require('./list/reverse-list-function');
const { DistinctListFunction } = require('./list/distinct-list-function');
const { AnyMatchFunction } = require('./list/any-match-function');
const { ContainsFunction } = require('./list/contains-function');
const { SortListFunction } = require('./list/sort-list-function');
const { LengthFunction } = require('./list/length-function');
const { RangeFunction } = require('./list/range-function');
const { TakeFunction } = require('./list/take-function');
const { SkipFunction } = require('./list/skip-function');
const { FindFirstFunction } = require('./list/find-first-function');

const { KvcMemberFunction } = require('./keyvalue/kvc-member-function');
const { KvcNoneNullMemberFunction } = require('./keyvalue/kvc-none-null-member-function');
const { KvSelectFunction } = require('./keyvalue/kv-select-function');

const { IsBlankFunction } = require('./text/is-blank-function');
const { EndsWithFunction } = require('./text/ends-with-function');
const { SubStringFunction } = require('./text/sub-string-function');
const { JoinTextFunction } = require('./text/join-text-function');
const { FindTextFunction } = require('./text/find-text-function');
const { ParseTextFunction } = require('./text/parse-text-function');
const { FormatValueFunction } = require('./text/format-value-function');
const { TemplateMergeFunction } = require('./text/template-merge-function');
const { UpperTextFunction } = require('./text/upper-text-function');
const { LowerTextFunction } = require('./text/lower-text-function');
const { RegexFunction } = require('./text/regex-function');

const { DateFunction } = require('./date/date-function');
const { TicksToDateFunction } = require('./date/ticks-to-date-function');

const { HtmlEncodeFunction } = require('./html/html-encode-function');

const { GuidFunction } = require('./misc/guid-function');
const { LogFunction } = require('./misc/log-function');
const { ErrorFunction } = require('./misc/error-function');

const {
  AssertEqualFunction,
  AssertNotEqualFunction,
  AssertGreaterFunction,
  AssertLessFunction,
  AssertTrueFunction,
  AssertFalseFunction,
  AssertApproxFunction,
  AssertNoErrorFunction,
  AssertIsErrorFunction,
  AssertIsErrorTypeFunction,
  AssertHasErrorMessageFunction,
  AssertIsNullFunction,
  AssertIsNotNullFunction
} = require('./assert/assert-functions');

module.exports = function buildBrowserBuiltinMap() {
  const entries = [
    { fn: new IFFunction(), names: ['if'] },
    { fn: new EqualsFunction(), names: ['=', '=='] },
    { fn: new NotEqualsFunction(), names: ['!='] },
    { fn: new GreaterThanFunction(), names: ['>'] },
    { fn: new GreaterThanOrEqualFunction(), names: ['>='] },
    { fn: new LessThanFunction(), names: ['<'] },
    { fn: new LessThanOrEqualFunction(), names: ['<='] },
    { fn: new AndFunction(), names: ['and'] },
    { fn: new OrFunction(), names: ['or'] },
    { fn: new InFunction(), names: ['in'] },
    { fn: new ReplaceIfNullFunction(), names: ['??'] },
    { fn: new EvaluateIfNotNullFunction(), names: ['?!'] },
    { fn: new NotFunction(), names: ['!', 'not'] },
    { fn: new CaseFunction(), names: ['case'] },
    { fn: new SwitchFunction(), names: ['switch'] },
    { fn: new AddFunction(), names: ['+'] },
    { fn: new SubtractFunction(), names: ['-'] },
    { fn: new MultiplyFunction(), names: ['*'] },
    { fn: new DivisionFunction(), names: ['/'] },
    { fn: new DivFunction(), names: ['div'] },
    { fn: new NegateFunction(), names: ['negate'] },
    { fn: new ModuloFunction(), names: ['%'] },
    { fn: new SineFunction(), collections: { math: ['sin'] } },
    { fn: new CosineFunction(), collections: { math: ['cos'] } },
    { fn: new TangentFunction(), collections: { math: ['tan'] } },
    { fn: new ArcSineFunction(), collections: { math: ['asin'] } },
    { fn: new ArcCosineFunction(), collections: { math: ['acos'] } },
    { fn: new ArcTangentFunction(), collections: { math: ['atan'] } },
    { fn: new SquareRootFunction(), collections: { math: ['sqrt'] } },
    { fn: new AbsoluteValueFunction(), collections: { math: ['abs'] } },
    { fn: new PowerFunction(), collections: { math: ['pow'] } },
    { fn: new ExponentialFunction(), collections: { math: ['exp'] } },
    { fn: new NaturalLogFunction(), collections: { math: ['ln', 'log'] } },
    { fn: new Log10Function(), collections: { math: ['log10'] } },
    { fn: new CeilingFunction(), collections: { math: ['ceiling', 'ceil'] } },
    { fn: new FloorFunction(), collections: { math: ['floor'] } },
    { fn: new RoundFunction(), collections: { math: ['round'] } },
    { fn: new TruncateFunction(), collections: { math: ['trunc'] } },
    { fn: new SignFunction(), collections: { math: ['sign'] } },
    { fn: new MinFunction(), collections: { math: ['min'] } },
    { fn: new MaxFunction(), collections: { math: ['max'] } },
    { fn: new ClampFunction(), collections: { math: ['clamp'] } },
    { fn: new RandomFunction(), collections: { math: ['random'] } },
    { value: Math.PI, names: [], collections: { math: ['pi'] } },
    { value: Math.E, names: [], collections: { math: ['e'] } },
    { fn: new MapListFunction(), names: ['map'] },
    { fn: new ReduceListFunction(), names: ['reduce'] },
    { fn: new FilterListFunction(), names: ['filter'] },
    { fn: new ReverseListFunction(), names: ['reverse'] },
    { fn: new DistinctListFunction(), names: ['distinct'] },
    { fn: new AnyMatchFunction(), names: ['any'] },
    { fn: new ContainsFunction(), names: ['contains'] },
    { fn: new SortListFunction(), names: ['sort'] },
    { fn: new LengthFunction(), names: ['length'] },
    { fn: new RangeFunction(), names: ['range', 'series'] },
    { fn: new TakeFunction(), names: ['take'] },
    { fn: new SkipFunction(), names: ['skip'] },
    { fn: new FindFirstFunction(), names: ['first'] },
    { fn: new KvcMemberFunction(), names: ['.'] },
    { fn: new KvcNoneNullMemberFunction(), names: ['?.'] },
    { fn: new KvSelectFunction(), names: ['select'] },
    { fn: new IsBlankFunction(), names: ['isblank'] },
    { fn: new EndsWithFunction(), names: ['endswith'] },
    { fn: new SubStringFunction(), names: ['substring'] },
    { fn: new JoinTextFunction(), names: ['join'] },
    { fn: new FindTextFunction(), names: ['find'] },
    { fn: new ParseTextFunction(), names: ['parse'] },
    { fn: new FormatValueFunction(), names: ['format'] },
    { fn: new TemplateMergeFunction(), names: ['_templatemerge'] },
    { fn: new AssertEqualFunction(), names: [], collections: { assert: ['equal'] } },
    { fn: new AssertNotEqualFunction(), names: [], collections: { assert: ['notEqual'] } },
    { fn: new AssertGreaterFunction(), names: [], collections: { assert: ['greater'] } },
    { fn: new AssertLessFunction(), names: [], collections: { assert: ['less'] } },
    { fn: new AssertTrueFunction(), names: [], collections: { assert: ['true'] } },
    { fn: new AssertFalseFunction(), names: [], collections: { assert: ['false'] } },
    { fn: new AssertApproxFunction(), names: [], collections: { assert: ['approx'] } },
    { fn: new AssertNoErrorFunction(), names: [], collections: { assert: ['noerror'] } },
    { fn: new AssertIsErrorFunction(), names: [], collections: { assert: ['iserror'] } },
    { fn: new AssertIsErrorTypeFunction(), names: [], collections: { assert: ['iserrortype'] } },
    { fn: new AssertHasErrorMessageFunction(), names: [], collections: { assert: ['haserrormessage'] } },
    { fn: new AssertIsNullFunction(), names: [], collections: { assert: ['isnull'] } },
    { fn: new AssertIsNotNullFunction(), names: [], collections: { assert: ['isnotnull'] } },
    { fn: new UpperTextFunction(), names: ['upper'], collections: { text: ['upper'] } },
    { fn: new LowerTextFunction(), names: [], collections: { text: ['lower'] } },
    { fn: new RegexFunction(), names: ['regex'], collections: { text: ['regex'] } },
    { fn: new DateFunction(), names: ['date'] },
    { fn: new TicksToDateFunction(), names: ['tickstoday'] },
    { fn: new HtmlEncodeFunction(), names: ['hencode'] },
    { fn: new GuidFunction(), names: ['guid'] },
    { fn: new ErrorFunction(), names: ['error'] },
    { fn: new LogFunction(), names: ['log'] }
  ];

  const symbolMap = {};
  const collections = {};

  for (const entry of entries) {
    const source = Object.prototype.hasOwnProperty.call(entry, 'value') ? entry.value : entry.fn;
    const typedValue = ensureTyped(source);
    const symbolNames = new Set();
    if (Array.isArray(entry.names)) {
      for (const name of entry.names) {
        symbolNames.add(String(name).toLowerCase());
      }
    }

    for (const name of symbolNames) {
      symbolMap[name] = typedValue;
    }

    if (entry.collections) {
      for (const [collectionName, extraMembers] of Object.entries(entry.collections)) {
        const lowerCollection = collectionName.toLowerCase();
        if (!collections[lowerCollection]) {
          collections[lowerCollection] = [];
        }
        const combinedMembers = new Set([...symbolNames]);
        if (Array.isArray(extraMembers)) {
          for (const member of extraMembers) {
            combinedMembers.add(String(member).toLowerCase());
          }
        }
        for (const memberName of combinedMembers) {
          collections[lowerCollection].push({ name: memberName, value: typedValue });
        }
      }
    }
  }

  Object.defineProperty(symbolMap, '__collections', {
    value: collections,
    enumerable: false,
    configurable: false,
    writable: false
  });

  return symbolMap;
};
