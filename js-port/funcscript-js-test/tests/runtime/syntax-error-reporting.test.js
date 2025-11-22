const { expect } = require('chai');
const { evaluate } = require('@tewelde/funcscript');

const cases = [
  { name: 'Case01_EmptyInput', expression: '' },
  { name: 'Case02_SpaceOnly', expression: ' ' },
  { name: 'Case03_NewlineOnly', expression: '\n' },
  { name: 'Case04_DanglingCloseParen', expression: ')' },
  { name: 'Case05_DanglingPlus', expression: '1 +' },
  { name: 'Case06_LeadingPlus', expression: '+ 2' },
  { name: 'Case07_DoublePlusOperator', expression: '1 ++ 2' },
  { name: 'Case08_DoubleStarOperator', expression: '1 ** 2' },
  { name: 'Case09_ArrowWithoutParameters', expression: '=>1' },
  { name: 'Case10_BareReturn', expression: 'return' },
  { name: 'Case11_BareEval', expression: 'eval' },
  { name: 'Case12_EvalBeforeSemicolon', expression: 'eval ;' },
  { name: 'Case13_MemberAccessWithoutReceiver', expression: '.foo' },
  { name: 'Case14_LineCommentOnly', expression: '//' },
  { name: 'Case15_BlockCommentStartOnly', expression: '/*' },
  { name: 'Case16_BlockCommentUnterminated', expression: '/* unterminated' },
  { name: 'Case17_NestedOpenParens', expression: '(()' },
  { name: 'Case18_IncompleteObject', expression: '{a:1' },
  { name: 'Case19_SemicolonBeforeBrace', expression: '{a:1;' },
  { name: 'Case20_MissingValueInObject', expression: '{a:}' },
  { name: 'Case23_LambdaMissingComma', expression: '(x y)=>x' },
  { name: 'Case24_LambdaTrailingComma', expression: '(x,)=>x' },
  { name: 'Case25_LambdaMissingBody', expression: '(x)=>' },
  { name: 'Case26_LambdaWrongArrow', expression: '(x)->x' },
  { name: 'Case28_LambdaMissingValueInBody', expression: '(x)=>{a:;}' },
  { name: 'Case29_LambdaReturnWithoutValue', expression: '(x)=>{return;}' },
  { name: 'Case30_IfMissingThen', expression: 'if true' },
  { name: 'Case31_IfMissingThenBeforeElse', expression: 'if true else 5' },
  { name: 'Case32_IfMissingBodyAfterThen', expression: 'if true then' },
  { name: 'Case33_SwitchMissingSelector', expression: 'switch' },
  { name: 'Case34_SwitchMissingSelectorBeforeBrace', expression: 'switch {' },
  { name: 'Case35_SwitchMissingSelectorWithCaseBlock', expression: 'switch { case 1: }' },
  { name: 'Case36_CaseMissingCondition', expression: 'case' },
  { name: 'Case37_CaseMissingValue', expression: 'case x:' },
  { name: 'Case38_CaseUsingWhenSyntax', expression: 'case when x then 1' },
  { name: 'Case39_HexLiteralMissingDigits', expression: '0x' },
  { name: 'Case40_BinaryLiteralInvalidDigit', expression: '0b2' },
  { name: 'Case41_DoubleQuotedStringUnterminated', expression: '"unterminated' },
  { name: 'Case42_SingleQuotedStringUnterminated', expression: "'also" },
  { name: 'Case43_DoubleQuotedStringNewline', expression: '"multi\nline' },
  { name: 'Case44_EvalMissingExpression', expression: '{ eval; }' },
  { name: 'Case45_EvalWithColon', expression: '{ eval: 1; }' },
  { name: 'Case46_EvalWithTwoExpressions', expression: '{ eval 1 2; }' },
  { name: 'Case47_EvalWithMissingParen', expression: '{ eval ((1+2); }' },
  { name: 'Case48_EvalWithExtraSemicolon', expression: '{ eval (1+2;; }' },
  { name: 'Case49_LambdaBlockMissingBrace', expression: '(x)=>{a:1;' },
  { name: 'Case50_LambdaReturnMissingValue', expression: '(x)=>{return}' }
];

describe('SyntaxErrorRepro2', () => {
  for (const { name, expression } of cases) {
    it(name, () => {
      expect(() => evaluate(expression)).to.throw();
    });
  }
});
