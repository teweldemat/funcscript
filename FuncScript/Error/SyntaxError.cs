using FuncScript.Core;
using System.Runtime.Serialization;
using System.Text;
using Microsoft.VisualBasic;
using FuncScript.Core;

namespace FuncScript.Error
{
    public class EvaluationTimeException : Exception
    {
        public EvaluationTimeException(string message) : base(message)
        {
        }
    }
    public class EvaluationTooDeepTimeException : Exception
    {
    }
    public class SyntaxError : Exception
    {
        private readonly List<FuncScriptParser.SyntaxErrorData> data;
        private readonly string exp;
        public SyntaxError(string exp,List<FuncScriptParser.SyntaxErrorData> data):base("Syntax error")
        {
            this.data= data;
            this.exp = exp;
        }
        public override string Message
        {
            get
            {
                if (data == null || data.Count == 0)
                    return "";
                var ret = data[0].Message;
                for(int i=1;i<data.Count;i++)
                    ret += "\n"+data[i].Message;
                var line = this.Line;
                if (!string.IsNullOrEmpty(line))
                    ret += "\nError occured at line: " + line;
                return ret;
            }
        }

        public string Line
        {
            get
            {
                if (this.data == null || data.Count == 0)
                    return "";
                var sb = new StringBuilder();
                foreach (var d in this.data)
                {
                    if (d.Loc < this.exp.Length)
                    {
                        var lineEnd =  exp.IndexOf("\n", d.Loc);
                        lineEnd = lineEnd == -1 ? exp.Length : lineEnd + 1;
                        var line = exp.Substring(d.Loc, lineEnd - d.Loc);
                        if (sb.Length == 0)
                            sb.Append(line.TrimEnd());
                        else
                        {
                            sb.Append("\n");
                            sb.Append(line.TrimEnd());
                        }
                    }
                }

                return sb.ToString();
            }
        }
    }
}