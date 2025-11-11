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
        class SingleValueParameterList : IParameterList
        {
            private readonly object _value;

            public SingleValueParameterList(object value)
            {
                _value = value;
            }

            public override int Count => 1;

            public override object GetParameter(IFsDataProvider provider, int index)
            {
                return index == 0 ? _value : null;
            }
        }

        public int MaxParsCount => 2;

        public CallType CallType => CallType.Infix;

        public string Symbol => "log";

        public int Precedence => 0;

        public object Evaluate(IFsDataProvider parent, IParameterList pars)
        {
            if (pars.Count == 0)
                throw new Error.EvaluationTimeException($"{this.Symbol} function: {this.ParName(0)} expected");

            if (pars.Count > this.MaxParsCount)
                throw new Error.EvaluationTimeException($"{this.Symbol} function: Invalid parameter count. Expected at most {this.MaxParsCount}, but got {pars.Count}");

            var value = pars.GetParameter(parent, 0);

            if (pars.Count > 1)
            {
                var handlerOrMessage = pars.GetParameter(parent, 1);
                if (handlerOrMessage is IFsFunction handler)
                {
                    handler.Evaluate(parent, new SingleValueParameterList(value));
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
