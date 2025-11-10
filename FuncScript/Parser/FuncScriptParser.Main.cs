using System.Collections.Generic;
using System.Text;
using FuncScript.Block;
using FuncScript.Functions.Math;
using FuncScript.Functions.Logic;

namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        public enum ParseNodeType
        {
            RootExpression,
            NoneExecutable,
            Comment,
            WhiteSpace,
            ListSeparator, //comma, semicolor
            OpenBrace,
            CloseBrance,
            StringDelimeter,
            LambdaArrow,
            Colon,
            FunctionParameterList,
            FunctionCall,
            MemberAccess,
            Selection,
            InfixExpression,
            LiteralInteger,
            KeyWord,
            LiteralDouble,
            LiteralLong,
            Identifier,
            IdentiferList,
            Operator,
            ThirdOperandDelimeter,
            LambdaExpression,
            ExpressionInBrace,
            LiteralString,
            StringTemplate,
            KeyValuePair,
            KeyValueCollection,
            List,
            Key,
            Case,
            IfExpression,
            GeneralInfixExpression,
            PrefixOperatorExpression
        }

        public class SyntaxErrorData
        {
            public int Loc;
            public int Length;
            public String Message;

            public SyntaxErrorData(int loc, int length, string message)
            {
                Loc = loc;
                Message = message;
                Length = length;
            }
        }

        public class ParseNode
        {
            public ParseNodeType NodeType;
            public int Pos;
            public int Length;
            public IList<ParseNode> Childs;

            public ParseNode(ParseNodeType type, int pos, int length)
                : this(type, pos, length, new List<ParseNode>())
            {
                
            }

            public ParseNode(ParseNodeType nodeType, int pos, int length, IList<ParseNode> childs)
            {
                NodeType = nodeType;
                Pos = pos;
                Length = length;
                Childs = childs;
            }

            public ParseNode(ParseNodeType nodeType):this(nodeType,0,0)
            {
                
            }
        }

        static string[][] s_operatorSymols =
        {
            new[] { "^" },
            new[] { "*", "div", "/", "%" },
            new[] { "+", "-" },
            new[] { ">=", "<=", "!=", ">", "<", "in" },
            new[] { "==", "=", "??", "?!", "?." },
            new[] { "or", "and" },
            new[] { "|" },
            new[] { ">>" },
        };

        private static string[][] s_prefixOp =
            { new string[] { "!", NotFunction.SYMBOL }, new string[] { "-", NegateFunction.SYMBOL } };

        const string KW_RETURN = "return";
        const string KW_CASE = "case";
        const string KW_SWITCH = "switch";
        private const string KW_ERROR = "fault";
        
        static HashSet<string> s_KeyWords;

        static FuncScriptParser()
        {
            s_KeyWords = new HashSet<string>();
            s_KeyWords.Add(KW_RETURN);
            s_KeyWords.Add(KW_ERROR);
            s_KeyWords.Add(KW_CASE);
            s_KeyWords.Add(KW_SWITCH);
            s_KeyWords.Add(KW_SWITCH);
            s_KeyWords.Add("then");
            s_KeyWords.Add("else");
        }
    }
}
