using FuncScript.Core;
using FuncScript.Model;
using System;

namespace FuncScript.Functions.Misc
{
    public abstract class Fslogger
    {
        public abstract void WriteLine(string text);
        public abstract void Clear();
        
        
        private static Fslogger _fslogger;

        public static void SetDefaultLogger(Fslogger logger)
        {
            _fslogger = logger;
        }
        public static Fslogger DefaultLogger =>_fslogger;

        static Fslogger()
        {
            SetDefaultLogger(new ConsoleLogger());
        }
    }

    public class ConsoleLogger : Fslogger
    {
        public override void WriteLine(string text) => Console.WriteLine(text);
        public override void Clear() => Console.Clear();
    }
    public class LogFunction : IFsFunction
    {
        public int MaxParsCount => 2;

        public CallType CallType => CallType.Infix;

        public string Symbol => "log";

        public int Precedence => 0;

        public object Evaluate(object par)
        {
            var pars = FunctionArgumentHelper.ExpectList(par, this.Symbol);

            if (pars.Length == 0)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH, $"{this.Symbol} function: {this.ParName(0)} expected");

            if (pars.Length > this.MaxParsCount)
                return new FsError(FsError.ERROR_PARAMETER_COUNT_MISMATCH,
                    $"{this.Symbol} function: Invalid parameter count. Expected at most {this.MaxParsCount}, but got {pars.Length}");

            var value = pars[0];

            if (pars.Length > 1)
            {
                var handlerOrMessage = pars[1];
                if (handlerOrMessage is IFsFunction handler)
                {
                    Fslogger.DefaultLogger?.WriteLine(handler.Evaluate(FunctionArgumentHelper.Create(value))?.ToString()??"<null>");
                }
                else
                {
                    Fslogger.DefaultLogger?.WriteLine(handlerOrMessage?.ToString() ?? "<null>");
                }
            }

            return value;
        }
        public string ParName(int index)
        {
            switch(index)
            {
                case 0: return "value";
                case 1: return "messageOrHandler";
                default:return null;
            }
        }
    }
}
