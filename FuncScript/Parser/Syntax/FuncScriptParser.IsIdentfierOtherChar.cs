namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static bool IsIdentfierOtherChar(char ch)
        {
            return (ch >= 'A' && ch <= 'Z')
                   || (ch >= 'a' && ch <= 'z')
                   || (ch >= '0' && ch <= '9')
                   || ch == '_';
        }
    }
}
