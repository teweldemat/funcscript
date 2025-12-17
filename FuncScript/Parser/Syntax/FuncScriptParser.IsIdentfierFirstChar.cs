namespace FuncScript.Core
{
    public partial class FuncScriptParser
    {
        static bool IsIdentfierFirstChar(char ch)
        {
            return (ch >= 'A' && ch <= 'Z')
                   || (ch >= 'a' && ch <= 'z')
                   || ch == '_';
        }
    }
}
