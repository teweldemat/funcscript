using System.Text;

namespace FuncScript.Core
{
    public interface IFsFunction
    {
        object Evaluate(object pars);
        CallType CallType { get; }
        String Symbol { get; }
        int Precedence { get; }
    }

    public class FunctionAliasAttribute : Attribute
    {
        public string[] Aliaces;
        public FunctionAliasAttribute(params string[] aliaces)
        {
            this.Aliaces = aliaces;
        }
    }

    

    public record CodeLocation(int Position,int Length)
    {
        static CodeLocation SpanTwo(CodeLocation l1, CodeLocation l2)
        {
            if (l1 == null)
                return l2;
            if (l2 == null)
                return l1;
            var pos = Math.Min(l1.Position,l2.Position);
            var max = Math.Min(l1.Position + l1.Length, l2.Position+l2.Length);
            return new CodeLocation(pos,max-pos);
        }
        public static CodeLocation Span(params CodeLocation [] locations)
        {
            CodeLocation total= null;
            foreach (var l in locations)
            {
                total = CodeLocation.SpanTwo(total, l);
            }

            return total;
        }
    }
    public enum CallType
    {
        Infix,
        Prefix,
        Dual
    }
}
