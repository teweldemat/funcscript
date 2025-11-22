namespace FuncScript.Core
{
    internal static class ExecContext
    {
        private static int s_currentDepth;

        public static int EnterScope()
        {
            var previous = s_currentDepth;
            s_currentDepth = checked(previous + 1);
            return previous;
        }

        public static void ExitScope(int previousDepth)
        {
            s_currentDepth = previousDepth;
        }

        public static int CurrentDepth => s_currentDepth;
    }
}
