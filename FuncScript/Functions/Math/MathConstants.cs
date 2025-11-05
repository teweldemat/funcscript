using FuncScript.Core;

namespace FuncScript.Functions.Math
{
    [FsConstant("math")]
    public static class MathConstants
    {
        [FsConstant("Pi")]
        public const double Pi = System.Math.PI;

        [FsConstant("E")]
        public const double E = System.Math.E;
    }
}
